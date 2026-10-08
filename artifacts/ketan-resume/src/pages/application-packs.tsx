import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import {
  getListApplicationSharesQueryKey,
  useCreateApplicationPack,
  useCreateApplicationShare,
  useDeleteWorkspaceRecord,
  useListApplicationShares,
  useListWorkspaceRecords,
  useRevokeApplicationShareById,
  type ApplicationPackLink,
  type ApplicationShare,
  type WorkspaceRecord,
} from '@workspace/api-client-react';
import { parseApplicationPack } from '@/lib/application-pack';
import ApplicationPackDownloads from '@/components/application-pack-downloads';
import '@/styles/application-sharing.css';

const RECORDS_KEY = ['/api/workspace/records'] as const;
const DAYS = [1, 7, 14, 30] as const;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const shareUrl = (token: string) => `${window.location.origin}${basePath}/shared#${token}`;
const needsReview = (r: WorkspaceRecord) => (r.metadata as { verificationStatus?: string }).verificationStatus === 'needs-review';
const isHttps = (u: string) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

function shareStatus(s: ApplicationShare) {
  if (s.revokedAt) return 'revoked';
  return new Date(s.expiresAt).getTime() <= Date.now() ? 'expired' : 'active';
}

function SharePanel({ pack, shares }: { pack: WorkspaceRecord; shares: ApplicationShare[] }) {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const [days, setDays] = useState<(typeof DAYS)[number]>(7);
  const [ok, setOk] = useState(false);
  const [freshState, setFresh] = useState<{ id: string; token: string } | null>(null);
  const fresh = freshState?.token ?? null;
  const [copyFailed, setCopyFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const create = useCreateApplicationShare();
  const revoke = useRevokeApplicationShareById();
  useEffect(() => { setFresh(null); }, [userId]);
  const refresh = () => qc.invalidateQueries({ queryKey: getListApplicationSharesQueryKey() });

  const copy = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(shareUrl(fresh)); setCopied(true); setCopyFailed(false); } catch { setCopyFailed(true); }
  };
  return (
    <div className="as-share" data-testid={`panel-share-${pack.id}`}>
      <div className="as-row">
        <label className="as-field" style={{ minWidth: 130 }}><span>Link expires after</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof DAYS)[number])} data-testid={`select-expiry-${pack.id}`}>
            {DAYS.map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
          </select></label>
      </div>
      <label className="as-check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid={`checkbox-share-confirm-${pack.id}`} />
        <span>I understand anyone with the link can open this pack until it expires or I revoke it. Revoking cannot erase copies recipients already saved.</span></label>
      <button type="button" className="workspace-button workspace-button-dark" disabled={!ok || create.isPending} data-testid={`button-create-share-${pack.id}`}
        onClick={() => { setErr(''); setCopied(false); setCopyFailed(false);
          create.mutate({ data: { packId: pack.id, expiresInDays: days, sharingConfirmed: true } }, {
            onSuccess: (r) => { setFresh({ id: r.share.id, token: r.token }); setOk(false); refresh(); },
            onError: () => setErr('Could not create the link. Try again.'),
          }); }}><Link2 size={14} aria-hidden="true" />{create.isPending ? 'Creating…' : 'Create share link'}</button>
      {err && <p className="as-err" role="alert">{err}</p>}
      {fresh && (
        <div data-testid={`panel-fresh-link-${pack.id}`}>
          <label className="as-field"><span>Your new link</span>
            <input className="as-url" readOnly value={shareUrl(fresh)} onFocus={(e) => e.currentTarget.select()} data-testid={`input-share-url-${pack.id}`} /></label>
          <div className="as-row" style={{ marginTop: 8 }}>
            <button type="button" className="workspace-button workspace-button-quiet" onClick={copy} data-testid={`button-copy-share-${pack.id}`}><Copy size={14} aria-hidden="true" />{copied ? 'Copied' : 'Copy link'}</button>
            <button type="button" className="workspace-text-button" onClick={() => setFresh(null)}>Hide link</button>
          </div>
          {copyFailed && <p className="as-err" role="alert">Copy was blocked. Select the link above and copy it manually.</p>}
          <p className="as-note as-warn" style={{ marginTop: 8 }}>This secret link is shown once and cannot be recovered after reload. Preview links work only in this environment until the app is published.</p>
        </div>
      )}
      {shares.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {shares.map((s) => { const st = shareStatus(s); return (
            <li key={s.id} className="as-row" style={{ justifyContent: 'space-between' }} data-testid={`row-share-${s.id}`}>
              <span className="as-note"><span className={`workspace-status ${st === 'active' ? 'workspace-status-fact-reviewed' : ''}`} data-testid={`status-share-${s.id}`}>{st}</span> expires {new Date(s.expiresAt).toLocaleDateString()}</span>
              {st === 'active' && (confirmRevoke === s.id ? (
                <span className="as-row">
                  <button type="button" className="workspace-delete-button" disabled={revoke.isPending} data-testid={`button-confirm-revoke-${s.id}`}
                    onClick={() => revoke.mutate({ id: s.id }, { onSuccess: () => { setConfirmRevoke(null); setFresh((f) => (f?.id === s.id ? null : f)); refresh(); }, onError: () => setErr('Could not revoke. Try again.') })}>Confirm revoke</button>
                  <button type="button" className="workspace-text-button" onClick={() => setConfirmRevoke(null)}>Cancel</button>
                </span>
              ) : <button type="button" className="workspace-delete-button" onClick={() => setConfirmRevoke(s.id)} data-testid={`button-revoke-${s.id}`}>Revoke</button>)}
            </li>); })}
        </ul>
      )}
    </div>
  );
}

export default function ApplicationPacksPage() {
  const qc = useQueryClient();
  const resumes = useListWorkspaceRecords({ kind: 'resume' });
  const covers = useListWorkspaceRecords({ kind: 'cover-letter' });
  const packs = useListWorkspaceRecords({ kind: 'pack' });
  const shares = useListApplicationShares();
  const createPack = useCreateApplicationPack();
  const delPack = useDeleteWorkspaceRecord();
  const [title, setTitle] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [coverId, setCoverId] = useState('');
  const [brief, setBrief] = useState('');
  const [links, setLinks] = useState<ApplicationPackLink[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [dlErr, setDlErr] = useState('');

  const resume = resumes.data?.find((r) => String(r.id) === resumeId);
  const cover = covers.data?.find((r) => String(r.id) === coverId);
  const blocked = resume ? needsReview(resume) : false;
  const badLink = links.some((l) => !isHttps(l.url));
  const canCreate = !!title.trim() && !!brief.trim() && !!resume && !blocked && reviewed && !badLink && !createPack.isPending;
  const refreshAll = () => { qc.invalidateQueries({ queryKey: RECORDS_KEY }); qc.invalidateQueries({ queryKey: getListApplicationSharesQueryKey() }); };
  const sharesByPack = useMemo(() => { const m = new Map<number, ApplicationShare[]>(); (shares.data ?? []).forEach((s) => m.set(s.packRecordId, [...(m.get(s.packRecordId) ?? []), s])); return m; }, [shares.data]);

  const submit = () => {
    if (!resume) return;
    setErr('');
    createPack.mutate({ data: { title: title.trim(), resumeId: resume.id, coverLetterId: cover?.id ?? null, brief: brief.trim(), links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })), reviewConfirmed: true } }, {
      onSuccess: () => { setTitle(''); setBrief(''); setLinks([]); setReviewed(false); setCoverId(''); refreshAll(); },
      onError: () => setErr('The pack could not be created. Check the selected resume is fact-reviewed and try again.'),
    });
  };

  return (
    <div data-testid="page-application-packs">
      <header className="workspace-page-header"><div>
        <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Application packs</div>
        <h1>Send one reviewed bundle.</h1>
        <p>A pack is a frozen snapshot of a resume, optional cover letter, brief and links. Later edits to the originals do not change it. Download a formatted PDF or a ZIP of original text files. PDFs support English, Hindi and Gujarati text without translating your documents.</p>
      </div></header>
      <div className="as-grid">
        <section className="workspace-panel" aria-labelledby="pack-create-h">
          <div className="workspace-panel-head"><div><div className="workspace-eyebrow">New pack</div><h2 id="pack-create-h">Compose</h2></div></div>
          <div className="as-body">
            <label className="as-field"><span>Pack title</span><input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="input-pack-title" /></label>
            <label className="as-field"><span>Source resume</span>
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} data-testid="select-pack-resume">
                <option value="">Choose a resume</option>
                {(resumes.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.title}{needsReview(r) ? ' (needs review)' : ''}</option>)}
              </select></label>
            {resumes.isError && <p className="as-err" role="alert">Resumes did not load. <button type="button" className="workspace-text-button" onClick={() => resumes.refetch()}>Retry</button></p>}
            {blocked && <p className="as-err" role="alert" data-testid="text-pack-blocked">This generated resume still needs review. Fact-check it in the workspace first; it cannot go in a pack.</p>}
            <label className="as-field"><span>Cover letter (optional)</span>
              <select value={coverId} onChange={(e) => setCoverId(e.target.value)} data-testid="select-pack-cover">
                <option value="">None</option>
                {(covers.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select></label>
            <label className="as-field"><span>Recruiter brief, required ({brief.length}/10000)</span><textarea required value={brief} maxLength={10000} onChange={(e) => setBrief(e.target.value)} data-testid="input-pack-brief" /></label>
            <div className="as-field"><span>Supporting links (HTTPS only)</span>
              {links.map((l, i) => (
                <div key={i} className="as-link-row">
                  <input aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} maxLength={200} onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} data-testid={`input-link-label-${i}`} />
                  <input aria-label={`Link ${i + 1} URL`} placeholder="https://" value={l.url} maxLength={2048} onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} data-testid={`input-link-url-${i}`} />
                  <button type="button" className="workspace-icon-button workspace-danger-icon" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, j) => j !== i))} data-testid={`button-remove-link-${i}`}><Trash2 size={14} aria-hidden="true" /></button>
                  {l.url && !isHttps(l.url) && <p className="as-err">Must start with https://</p>}
                </div>
              ))}
              <div><button type="button" className="workspace-button workspace-button-quiet" disabled={links.length >= 30} onClick={() => setLinks([...links, { label: '', url: '' }])} data-testid="button-add-link"><Plus size={14} aria-hidden="true" />Add link</button></div>
            </div>
          </div>
        </section>
        <section className="workspace-panel" aria-labelledby="pack-preview-h">
          <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Exact contents</div><h2 id="pack-preview-h">Preview</h2></div></div>
          <div className="as-body">
            {!resume ? <p className="as-note" data-testid="text-preview-empty">Choose a resume to preview what will be frozen. Private notes are never included.</p> : (
              <div className="as-preview" data-testid="panel-pack-preview">
                <h3>Resume — {resume.title}</h3><pre>{resume.content}</pre>
                {cover && <><h3>Cover letter — {cover.title}</h3><pre>{cover.content}</pre></>}
                {brief.trim() && <><h3>Recruiter brief</h3><pre>{brief}</pre></>}
                {links.length > 0 && <><h3>Supporting links</h3><pre>{links.map((l) => `${l.label}: ${l.url}`).join('\n')}</pre></>}
              </div>
            )}
            <label className="as-check"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="checkbox-pack-reviewed" />
              <span>I reviewed every fact in the selected documents above and they are accurate.</span></label>
            {err && <p className="as-err" role="alert" data-testid="text-pack-error">{err}</p>}
            <button type="button" className="workspace-button workspace-button-dark" disabled={!canCreate} onClick={submit} data-testid="button-create-pack">{createPack.isPending ? 'Creating…' : 'Create pack snapshot'}</button>
          </div>
        </section>
      </div>
      <section className="workspace-panel" style={{ marginTop: 18 }} aria-labelledby="pack-list-h">
        <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Saved</div><h2 id="pack-list-h">Your packs</h2></div><span className="workspace-count">{packs.data?.length ?? 0}</span></div>
        <div className="as-body">
          {dlErr && <p className="as-err" role="alert">{dlErr}</p>}
          {packs.isLoading && <div className="workspace-skeleton"><div className="workspace-skeleton-line workspace-skeleton-wide" /></div>}
          {packs.isError && <div className="workspace-error" role="alert"><div><h2>Packs did not load</h2></div><button type="button" className="workspace-button workspace-button-dark" onClick={() => packs.refetch()} data-testid="button-retry-packs">Retry</button></div>}
          {packs.data && packs.data.length === 0 && <div className="workspace-empty" data-testid="empty-packs"><h3>No packs yet</h3><p>Create one on the left, then share it by link or download it.</p></div>}
          {packs.data?.map((p) => {
            const snap = parseApplicationPack(p.content);
            return (
              <article key={p.id} className="as-item" data-testid={`card-pack-${p.id}`}>
                <h3>{p.title}</h3>
                <p className="as-note">Snapshot {new Date(p.createdAt).toLocaleString()}{snap ? ` · resume "${snap.resume.title}"${snap.coverLetter ? ` · cover letter "${snap.coverLetter.title}"` : ''} · ${snap.links.length} link(s)` : ' · snapshot unreadable'}</p>
                <div className="as-row">
                  <ApplicationPackDownloads pack={snap} zipTestId={`button-download-pack-${p.id}`} pdfTestId={`button-download-pdf-pack-${p.id}`} />
                  {confirmDel === p.id ? (
                    <span className="as-row"><span className="as-note">Delete pack and revoke its share links?</span>
                      <button type="button" className="workspace-delete-button" disabled={delPack.isPending} data-testid={`button-confirm-delete-pack-${p.id}`} onClick={() => delPack.mutate({ id: p.id }, { onSuccess: () => { setConfirmDel(null); refreshAll(); }, onError: () => setDlErr('Delete failed. Try again.') })}>Confirm delete</button>
                      <button type="button" className="workspace-text-button" onClick={() => setConfirmDel(null)}>Cancel</button></span>
                  ) : <button type="button" className="workspace-delete-button" onClick={() => setConfirmDel(p.id)} data-testid={`button-delete-pack-${p.id}`}><Trash2 size={12} aria-hidden="true" />Delete</button>}
                </div>
                <SharePanel pack={p} shares={sharesByPack.get(p.id) ?? []} />
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
