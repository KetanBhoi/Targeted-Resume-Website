import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  getListWorkspaceRecordsQueryKey,
  useCreateWorkspaceRecord,
  useDeleteWorkspaceRecord,
  useListWorkspaceRecords,
  useUpdateWorkspaceRecord,
  type WorkspaceRecord,
  type WorkspaceRecordCreateKind,
} from '@workspace/api-client-react';
import { errorText, type BuildResult } from '@/lib/career-tools';
import '@/styles/career-tools.css';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label>
      <span>{label}</span>
      {children}
      {hint && <p className="ct-hint">{hint}</p>}
    </label>
  );
}

interface Props<D> {
  kind: WorkspaceRecordCreateKind;
  prefix: string;
  eyebrow: string;
  heading: string;
  intro: string;
  privacy: string;
  newLabel: string;
  emptyTitle: string;
  emptyBody: string;
  noun: string;
  blank: () => D;
  toDraft: (r: WorkspaceRecord) => D;
  build: (d: D) => BuildResult;
  summary: (r: WorkspaceRecord) => { primary: string; secondary: string; tag: string };
  renderForm: (draft: D, patch: (p: Partial<D>) => void, disabled: boolean) => ReactNode;
  renderExtra?: (records: WorkspaceRecord[]) => ReactNode;
}

export function CareerRecordEditor<D>(p: Props<D>) {
  const qc = useQueryClient();
  const list = useListWorkspaceRecords({ kind: p.kind });
  const records = useMemo(() => list.data ?? [], [list.data]);
  const create = useCreateWorkspaceRecord();
  const update = useUpdateWorkspaceRecord();
  const del = useDeleteWorkspaceRecord();
  const [sel, setSel] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<D>(() => p.blank());
  const [base, setBase] = useState(() => JSON.stringify(p.blank()));
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingTarget, setPendingTarget] = useState<WorkspaceRecord | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const selRef = useRef<number | 'new' | null>(null);

  const busy = create.isPending || update.isPending || del.isPending;
  const dirty = sel !== null && JSON.stringify(draft) !== base;
  const refresh = () => void qc.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() });

  const show = (key: number | 'new', d: D) => {
    selRef.current = key;
    setSel(key);
    setDraft(d);
    setBase(JSON.stringify(d));
  };
  const open = (t: WorkspaceRecord | 'new') => {
    setErr(''); setNotice(''); setConfirmDel(false); setPendingTarget(null);
    if (t === 'new') show('new', p.blank());
    else show(t.id, p.toDraft(t));
  };
  const go = (t: WorkspaceRecord | 'new') => {
    const key = t === 'new' ? 'new' : t.id;
    if (key === sel && t !== 'new') return;
    if (dirty) { setPendingTarget(t); return; }
    open(t);
  };

  const save = () => {
    setErr(''); setNotice('');
    const r = p.build(draft);
    if (!r.ok) { setErr(r.error); return; }
    const data = { title: r.title, content: r.content, metadata: r.metadata };
    if (sel === 'new') {
      create.mutate({ data: { kind: p.kind, ...data } }, {
        onSuccess: (rec) => {
          refresh();
          if (selRef.current === 'new') { show(rec.id, p.toDraft(rec)); setNotice('Saved.'); }
        },
        onError: (e) => setErr(errorText(e)),
      });
    } else if (typeof sel === 'number') {
      const id = sel;
      update.mutate({ id, data }, {
        onSuccess: (rec) => {
          refresh();
          if (selRef.current === id) { show(id, p.toDraft(rec)); setNotice('Saved.'); }
        },
        onError: (e) => setErr(errorText(e)),
      });
    }
  };
  const remove = () => {
    if (typeof sel !== 'number') return;
    const id = sel;
    setErr('');
    del.mutate({ id }, {
      onSuccess: () => {
        refresh();
        setConfirmDel(false);
        if (selRef.current === id) { selRef.current = null; setSel(null); setBase(JSON.stringify(p.blank())); setNotice(''); }
      },
      onError: (e) => setErr(errorText(e)),
    });
  };

  const t = p.prefix;
  return (
    <div className="ct-page">
      <div className="workspace-page-header">
        <div>
          <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />{p.eyebrow}</div>
          <h1>{p.heading}</h1>
          <p>{p.intro}</p>
        </div>
        <button type="button" className="workspace-button workspace-button-dark" onClick={() => go('new')} disabled={busy} data-testid={`button-new-${t}`}><Plus size={14} /> {p.newLabel}</button>
      </div>
      <div className="ct-privacy"><Lock size={14} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 3 }} /><span>{p.privacy}</span></div>

      {list.isLoading && <div className="workspace-skeleton" aria-label={`Loading ${p.noun}`}><div className="workspace-skeleton-card" style={{ minHeight: 160 }} /></div>}
      {list.isError && (
        <div className="workspace-error" role="alert"><AlertTriangle size={20} /><div><h2>Records did not load</h2><p>{errorText(list.error)}</p></div><button type="button" className="workspace-button workspace-button-quiet" onClick={() => void list.refetch()} data-testid={`button-retry-${t}`}><RefreshCw size={13} /> Retry</button></div>
      )}

      {!list.isLoading && !list.isError && (
        <div className="ct-layout">
          <section className="workspace-panel" aria-label={`Saved ${p.noun}`}>
            <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Saved</div><h2>{p.noun}</h2></div><span className="workspace-count" data-testid={`text-count-${t}`}>{records.length}</span></div>
            {records.length === 0 ? (
              <div className="workspace-empty"><div className="workspace-empty-mark"><Plus size={16} /></div><div><h3>{p.emptyTitle}</h3><p>{p.emptyBody}</p></div></div>
            ) : (
              <div className="ct-list">
                {records.map((r) => {
                  const s = p.summary(r);
                  return (
                    <button key={r.id} type="button" disabled={busy} onClick={() => go(r)} className={`ct-item ${sel === r.id ? 'ct-item-active' : ''}`} aria-current={sel === r.id} data-testid={`item-${t}-${r.id}`}>
                      <strong>{s.primary}</strong><small>{s.secondary}</small><span className="ct-tag">{s.tag}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="workspace-panel" aria-label="Editor">
            <div className="workspace-panel-head"><div><div className="workspace-eyebrow">{sel === 'new' ? 'New entry' : sel === null ? 'Editor' : 'Editing'}</div><h2>{sel === null ? 'Pick or add an entry' : sel === 'new' ? p.newLabel : 'Edit entry'}</h2></div>{dirty && <span className="ct-tag" data-testid={`status-dirty-${t}`}>Unsaved changes</span>}</div>
            {pendingTarget && (
              <div className="ct-banner ct-fade" role="alertdialog" aria-label="Discard unsaved changes" style={{ marginTop: 16 }}>
                <span>You have unsaved changes. Switching will discard them.</span>
                <button type="button" className="workspace-button workspace-button-dark" onClick={() => open(pendingTarget)} data-testid={`button-discard-${t}`}>Discard and switch</button>
                <button type="button" className="workspace-button workspace-button-quiet" onClick={() => setPendingTarget(null)} data-testid={`button-keep-editing-${t}`}>Keep editing</button>
              </div>
            )}
            {sel === null ? (
              <div className="workspace-empty"><div><h3>Nothing open</h3><p>Choose a saved entry to edit it, or start a new one.</p></div></div>
            ) : (
              <form className="ct-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <fieldset disabled={busy} className="workspace-form" style={{ padding: 0 }}>
                  {p.renderForm(draft, (patch) => setDraft((d) => ({ ...d, ...patch })), busy)}
                </fieldset>
                {err && <p role="alert" className="ct-error" style={{ margin: 0 }} data-testid={`text-error-${t}`}>{err}</p>}
                {notice && !dirty && <p role="status" className="ct-ok" style={{ margin: 0 }}>{notice}</p>}
                <div className="ct-actions">
                  <button type="submit" className="workspace-button workspace-button-dark" disabled={busy} data-testid={`button-save-${t}`}>{create.isPending || update.isPending ? 'Saving...' : sel === 'new' ? 'Save entry' : 'Save changes'}</button>
                  {typeof sel === 'number' && !confirmDel && <button type="button" className="workspace-button workspace-button-quiet" disabled={busy} onClick={() => setConfirmDel(true)} data-testid={`button-delete-${t}`}><Trash2 size={13} /> Delete</button>}
                  {dirty && typeof sel === 'number' && <button type="button" className="workspace-text-button" disabled={busy} onClick={() => { const r = records.find((x) => x.id === sel); if (r) open(r); }} data-testid={`button-reload-${t}`}>Reload saved version</button>}
                </div>
                {confirmDel && (
                  <div className="ct-banner ct-banner-danger ct-fade" role="alertdialog" aria-label="Confirm delete" style={{ margin: 0 }}>
                    <span>Delete this entry permanently? This cannot be undone.</span>
                    <button type="button" className="workspace-button workspace-button-dark" disabled={busy} onClick={remove} data-testid={`button-confirm-delete-${t}`}>{del.isPending ? 'Deleting...' : 'Delete'}</button>
                    <button type="button" className="workspace-button workspace-button-quiet" disabled={busy} onClick={() => setConfirmDel(false)} data-testid={`button-cancel-delete-${t}`}>Keep</button>
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      )}
      {!list.isLoading && !list.isError && p.renderExtra?.(records)}
    </div>
  );
}
