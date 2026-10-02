import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortfolioOwnerAccessQueryKey,
  getListOwnerCaseStudiesQueryKey,
  getListPublicCaseStudiesQueryKey,
  useCreateCaseStudy,
  useDeleteCaseStudy,
  useGetPortfolioOwnerAccess,
  useListOwnerCaseStudies,
  useListWorkspaceRecords,
  useUpdateCaseStudy,
  type CaseStudyInput,
  type OwnerCaseStudy,
} from '@workspace/api-client-react';
import { SCENARIOS, parseLab } from '@/lib/simulation-scenarios';
import '@/styles/application-sharing.css';

const blank = (): CaseStudyInput => ({ simulationId: 0, title: '', summary: '', jobDescription: '', outreach: '', reasoning: '', lessons: '', fictionalConfirmed: false, published: false });
const LIMITS = { title: 200, summary: 3000, jobDescription: 10000, outreach: 5000, reasoning: 10000, lessons: 5000 } as const;
const TEXT_FIELDS: [keyof typeof LIMITS, string][] = [['title', 'Title'], ['summary', 'Summary'], ['jobDescription', 'Job description'], ['outreach', 'Outreach draft'], ['reasoning', 'Reasoning'], ['lessons', 'Lessons']];

export default function CaseStudyEditorPage() {
  const qc = useQueryClient();
  const access = useGetPortfolioOwnerAccess({ query: { queryKey: getGetPortfolioOwnerAccessQueryKey(), retry: false, staleTime: 0 } });
  const isOwner = access.data?.isOwner === true;
  const sims = useListWorkspaceRecords({ kind: 'simulation' }, { query: { queryKey: ['/api/workspace/records', { kind: 'simulation' }], enabled: isOwner } });
  const cases = useListOwnerCaseStudies({ query: { queryKey: getListOwnerCaseStudiesQueryKey(), enabled: isOwner } });
  const create = useCreateCaseStudy();
  const update = useUpdateCaseStudy();
  const del = useDeleteCaseStudy();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CaseStudyInput>(blank);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const busy = create.isPending || update.isPending || del.isPending;
  const set = <K extends keyof CaseStudyInput>(k: K, v: CaseStudyInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const refresh = () => { qc.invalidateQueries({ queryKey: getListOwnerCaseStudiesQueryKey() }); qc.invalidateQueries({ queryKey: getListPublicCaseStudiesQueryKey() }); };
  const reset = () => { setEditing(null); setForm(blank()); setConfirmSave(false); setErr(''); };

  if (access.isLoading) return <div className="workspace-skeleton" data-testid="status-owner-loading"><div className="workspace-skeleton-line workspace-skeleton-wide" /></div>;
  if (access.isError) return <div className="workspace-error" role="alert"><div><h2>Could not verify access</h2></div><button type="button" className="workspace-button workspace-button-dark" onClick={() => access.refetch()} data-testid="button-retry-owner">Retry</button></div>;
  if (!isOwner) return <div className="workspace-empty" data-testid="status-not-owner"><h3>Owner only</h3><p>Only the verified portfolio owner can manage public practice cases.</p></div>;

  const sim = sims.data?.find((s) => s.id === form.simulationId);
  const prefill = () => {
    if (!sim) return;
    const scenario = SCENARIOS.find((s) => s.id === (sim.metadata as { scenarioId?: string }).scenarioId);
    if (!scenario) { setErr('This simulation uses an unknown scenario; nothing was prefilled.'); return; }
    const lab = parseLab(sim.content, scenario);
    setForm((f) => ({ ...f, jobDescription: lab.jobDescription, outreach: lab.outreach }));
  };
  const valid = form.simulationId > 0 && form.title.trim() && form.summary.trim() && form.fictionalConfirmed;
  const save = () => {
    setErr('');
    const done = { onSuccess: () => { reset(); refresh(); }, onError: () => { setConfirmSave(false); setErr('Save failed. Nothing was changed; try again.'); } };
    if (editing) update.mutate({ id: editing, data: (({ simulationId: _s, ...rest }) => rest)(form) }, done); else create.mutate({ data: form }, done);
  };
  const startEdit = (c: OwnerCaseStudy) => { setEditing(c.id); setConfirmSave(false); setErr(''); setForm({ simulationId: c.simulationId, title: c.title, summary: c.summary, jobDescription: c.jobDescription, outreach: c.outreach, reasoning: c.reasoning, lessons: c.lessons, fictionalConfirmed: c.fictionalConfirmed, published: c.published }); };

  return (
    <div data-testid="page-case-studies">
      <header className="workspace-page-header"><div>
        <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Public practice cases</div>
        <h1>Publish only what you wrote.</h1>
        <p>Only the fields below are copied. Scores, notes and reflections stay private. Every public case is labelled fictional recruiting practice, never employment evidence.</p>
      </div></header>
      <div className="as-grid">
        <section className="workspace-panel" aria-labelledby="cs-form-h">
          <div className="workspace-panel-head"><div><div className="workspace-eyebrow">{editing ? 'Editing' : 'New case'}</div><h2 id="cs-form-h">Editor</h2></div></div>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="as-body">
            <label className="as-field"><span>Source simulation (private)</span>
              <select value={form.simulationId || ''} onChange={(e) => set('simulationId', Number(e.target.value))} disabled={!!editing} data-testid="select-case-simulation">
                <option value="">Choose a simulation</option>
                {(sims.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select></label>
            <div><button type="button" className="workspace-button workspace-button-quiet" disabled={!sim} onClick={prefill} data-testid="button-prefill-case">Prefill job description and outreach</button></div>
            {TEXT_FIELDS.map(([k, label]) => (
              <label key={k} className="as-field"><span>{label} ({form[k].length}/{LIMITS[k]})</span>
                {k === 'title' ? <input value={form[k]} maxLength={LIMITS[k]} onChange={(e) => set(k, e.target.value)} data-testid={`input-case-${k}`} />
                  : <textarea value={form[k]} maxLength={LIMITS[k]} onChange={(e) => set(k, e.target.value)} data-testid={`input-case-${k}`} />}</label>
            ))}
            <label className="as-check"><input type="checkbox" checked={form.fictionalConfirmed} onChange={(e) => set('fictionalConfirmed', e.target.checked)} data-testid="checkbox-case-fictional" /><span>I confirm all content is fictional practice with no real candidates, companies or private data.</span></label>
            <label className="as-check"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} data-testid="checkbox-case-published" /><span>Published (visible on the public portfolio)</span></label>
            {err && <p className="as-err" role="alert" data-testid="text-case-error">{err}</p>}
            {confirmSave ? (
              <div className="as-row"><span className="as-note">{form.published ? 'This will be visible publicly. Save?' : 'Save as private draft?'}</span>
                <button type="button" className="workspace-button workspace-button-dark" onClick={save} data-testid="button-confirm-save-case">{busy ? 'Saving…' : 'Confirm save'}</button>
                <button type="button" className="workspace-text-button" onClick={() => setConfirmSave(false)}>Cancel</button></div>
            ) : (
              <div className="as-row"><button type="button" className="workspace-button workspace-button-dark" disabled={!valid} onClick={() => (form.published ? setConfirmSave(true) : save())} data-testid="button-save-case">{editing ? 'Save changes' : 'Create case'}</button>
                {editing && <button type="button" className="workspace-button workspace-button-quiet" onClick={reset} data-testid="button-cancel-edit-case">Cancel edit</button>}</div>
            )}
          </fieldset>
        </section>
        <section className="workspace-panel" aria-labelledby="cs-prev-h">
          <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Public view</div><h2 id="cs-prev-h">Preview</h2></div></div>
          <div className="as-body"><div className="as-public-card" data-testid="panel-case-preview">
            <span className="as-label">Fictional recruiting practice—not professional experience</span>
            <h3>{form.title || 'Untitled'}</h3><p>{form.summary}</p>
            {TEXT_FIELDS.slice(2).map(([k, label]) => form[k] ? <div key={k}><h4>{label}</h4><p>{form[k]}</p></div> : null)}
          </div></div>
        </section>
      </div>
      <section className="workspace-panel" style={{ marginTop: 18 }} aria-labelledby="cs-list-h">
        <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Saved</div><h2 id="cs-list-h">Your cases</h2></div></div>
        <div className="as-body">
          <p className="as-note as-warn">Deleting a private simulation does not delete or unpublish its public case. Manage cases here separately.</p>
          {cases.isLoading && <div className="workspace-skeleton"><div className="workspace-skeleton-line workspace-skeleton-wide" /></div>}
          {cases.isError && <div className="workspace-error" role="alert"><div><h2>Cases did not load</h2></div><button type="button" className="workspace-button workspace-button-dark" onClick={() => cases.refetch()} data-testid="button-retry-cases">Retry</button></div>}
          {cases.data?.length === 0 && <div className="workspace-empty" data-testid="empty-cases"><h3>No cases yet</h3><p>Draft one from a simulation. Nothing is public until you publish.</p></div>}
          {cases.data?.map((c) => (
            <article key={c.id} className="as-item" data-testid={`card-case-${c.id}`}>
              <h3>{c.title || 'Untitled'}</h3>
              <span className={`workspace-status ${c.published ? 'workspace-status-fact-reviewed' : ''}`}>{c.published ? 'published' : 'private draft'}</span>
              <div className="as-row">
                <button type="button" className="workspace-text-button" disabled={busy} onClick={() => startEdit(c)} data-testid={`button-edit-case-${c.id}`}>Edit</button>
                {c.published && <button type="button" className="workspace-text-button" disabled={busy} data-testid={`button-unpublish-case-${c.id}`}
                  onClick={() => update.mutate({ id: c.id, data: { title: c.title, summary: c.summary, jobDescription: c.jobDescription, outreach: c.outreach, reasoning: c.reasoning, lessons: c.lessons, fictionalConfirmed: c.fictionalConfirmed, published: false } }, { onSuccess: refresh, onError: () => setErr('Unpublish failed. Try again.') })}>Unpublish</button>}
                {confirmDel === c.id ? (<>
                  <button type="button" className="workspace-delete-button" disabled={busy} data-testid={`button-confirm-delete-case-${c.id}`} onClick={() => del.mutate({ id: c.id }, { onSuccess: () => { setConfirmDel(null); if (editing === c.id) reset(); refresh(); }, onError: () => setErr('Delete failed. Try again.') })}>Confirm delete</button>
                  <button type="button" className="workspace-text-button" onClick={() => setConfirmDel(null)}>Cancel</button></>
                ) : <button type="button" className="workspace-delete-button" disabled={busy} onClick={() => setConfirmDel(c.id)} data-testid={`button-delete-case-${c.id}`}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
