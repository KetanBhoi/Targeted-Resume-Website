import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, Layers3, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import {
  getListWorkspaceRecordsQueryKey,
  useDeleteWorkspaceRecord,
  useListWorkspaceRecords,
  useUpdateWorkspaceRecord,
  type WorkspaceRecord,
} from '@workspace/api-client-react';
import { PRACTICE_KIND, fmtDate, fmtDuration } from '@/lib/simulation-scenarios';
import '@/styles/practice-tools.css';

const STAR = ['Situation', 'Task', 'Action', 'Result'];

function read(r: WorkspaceRecord) {
  const m = r.metadata ?? {};
  const checks = Array.isArray(m.checks) ? m.checks : [];
  return {
    question: typeof m.question === 'string' ? m.question : r.title,
    category: typeof m.category === 'string' ? m.category : 'Practice',
    duration: typeof m.duration === 'number' ? m.duration : 0,
    checks: STAR.map((_, i) => checks[i] === true),
    reflection: typeof m.reflection === 'string' ? m.reflection : '',
  };
}

function Entry({ r, onChanged }: { r: WorkspaceRecord; onChanged: () => void }) {
  const info = read(r);
  const update = useUpdateWorkspaceRecord();
  const del = useDeleteWorkspaceRecord();
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState(r.content);
  const [reflection, setReflection] = useState(info.reflection);
  const [checks, setChecks] = useState(info.checks);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');

  const save = () => {
    setErr('');
    update.mutate(
      { id: r.id, data: { content: answer, metadata: { question: info.question, category: info.category, duration: info.duration, checks, reflection } } },
      { onSuccess: () => { setEditing(false); onChanged(); }, onError: () => setErr('Could not save changes. Try again.') },
    );
  };
  const remove = () => {
    setErr('');
    del.mutate({ id: r.id }, { onSuccess: onChanged, onError: () => setErr('Could not delete. Try again.') });
  };

  return (
    <article className="pt-card" data-testid={`card-practice-${r.id}`}>
      <div className="pt-tags">
        <span className="pt-tag">{info.category}</span>
        <span className="pt-tag">{info.duration ? fmtDuration(info.duration) : 'No limit'}</span>
        <span className="pt-tag">{fmtDate(r.createdAt)}</span>
        <span className="pt-tag">STAR {info.checks.filter(Boolean).length}/4</span>
      </div>
      <h3>{info.question}</h3>
      {editing ? (
        <fieldset className="pt-modal" disabled={update.isPending || del.isPending} style={{ display: 'grid', gap: 10, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <label className="pt-field"><span>Written answer</span><textarea rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} data-testid={`input-edit-answer-${r.id}`} /></label>
          <label className="pt-field"><span>Reflection</span><textarea rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} /></label>
          <ul className="pt-checks">{STAR.map((s, i) => <li key={s}><label><input type="checkbox" checked={checks[i]} onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))} /> {s}</label></li>)}</ul>
          <div className="pt-actions">
            <button type="button" className="workspace-button workspace-button-dark" onClick={save} disabled={update.isPending || !answer.trim()} data-testid={`button-save-practice-${r.id}`}>{update.isPending ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="workspace-button workspace-button-quiet" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </fieldset>
      ) : (
        <>
          <p>{r.content}</p>
          {info.reflection && <p><strong>Reflection: </strong>{info.reflection}</p>}
          <div className="pt-tags">{STAR.map((s, i) => <span key={s} className="pt-tag" style={info.checks[i] ? { background: 'hsl(66 70% 55%)' } : { opacity: 0.55 }}>{s}</span>)}</div>
          <div className="pt-actions">
            <button type="button" className="workspace-text-button" disabled={del.isPending} onClick={() => setEditing(true)} data-testid={`button-edit-practice-${r.id}`}><Pencil size={13} /> Edit</button>
            {!confirm && <button type="button" className="workspace-delete-button" disabled={update.isPending} onClick={() => setConfirm(true)} data-testid={`button-delete-practice-${r.id}`}><Trash2 size={13} /> Delete</button>}
          </div>
        </>
      )}
      {confirm && (
        <div className="pt-confirm" role="alertdialog" aria-label="Confirm delete">
          <span>Delete this saved answer permanently?</span>
          <button type="button" className="workspace-button workspace-button-dark" onClick={remove} disabled={del.isPending} data-testid={`button-confirm-delete-practice-${r.id}`}>{del.isPending ? 'Deleting…' : 'Delete'}</button>
          <button type="button" className="workspace-button workspace-button-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}
      {err && <p role="alert" className="pt-feedback is-error">{err}</p>}
    </article>
  );
}

export default function PracticeHistory() {
  const qc = useQueryClient();
  const list = useListWorkspaceRecords({ kind: PRACTICE_KIND });
  const records = useMemo(() => list.data ?? [], [list.data]);
  const refresh = () => void qc.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() });

  return (
    <div className="pt-page">
      <div className="workspace-page-header">
        <div>
          <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Practice history</div>
          <h1>Your saved answers, in your words.</h1>
          <p>Only written answers you chose to save appear here. They are private to your account. Recordings are never stored.</p>
        </div>
        <Link href="/workspace/studio" className="workspace-button workspace-button-dark" data-testid="link-back-studio">Open studio</Link>
      </div>
      {list.isLoading && <div className="workspace-skeleton" aria-label="Loading practice history"><div className="workspace-skeleton-card" style={{ minHeight: 140 }} /><div className="workspace-skeleton-card" style={{ minHeight: 140 }} /></div>}
      {list.isError && (
        <div className="workspace-error" role="alert"><AlertTriangle size={20} /><div><h2>History did not load</h2><p>Check your connection and try again.</p></div><button type="button" className="workspace-button workspace-button-quiet" onClick={() => void list.refetch()} data-testid="button-retry-practice"><RefreshCw size={13} /> Retry</button></div>
      )}
      {!list.isLoading && !list.isError && records.length === 0 && (
        <div className="workspace-panel"><div className="workspace-empty"><div className="workspace-empty-mark"><Layers3 size={18} /></div><div><h3>Nothing saved yet</h3><p>In the interview studio, write a draft and choose Save written practice. It will show up here.</p></div><Link href="/workspace/studio" className="workspace-text-button">Go to studio</Link></div></div>
      )}
      {records.map((r) => <Entry key={r.id} r={r} onChanged={refresh} />)}
    </div>
  );
}
