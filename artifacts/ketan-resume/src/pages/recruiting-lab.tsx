import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FlaskConical, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  getListWorkspaceRecordsQueryKey,
  useCreateWorkspaceRecord,
  useDeleteWorkspaceRecord,
  useListWorkspaceRecords,
  useUpdateWorkspaceRecord,
  type WorkspaceRecord,
} from '@workspace/api-client-react';
import {
  CRITERIA,
  JD_CHECKLIST,
  LAB_DISCLAIMER,
  OUTREACH_CHECKLIST,
  REVIEW_PROMPTS,
  SCENARIOS,
  SCORE_LABELS,
  SIMULATION_KIND,
  STAGES,
  emptyLab,
  fmtDate,
  parseLab,
  totalScore,
  type LabContent,
} from '@/lib/simulation-scenarios';
import '@/styles/practice-tools.css';

const scenarioById = (id: unknown) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

export default function RecruitingLab() {
  const qc = useQueryClient();
  const list = useListWorkspaceRecords({ kind: SIMULATION_KIND });
  const create = useCreateWorkspaceRecord();
  const update = useUpdateWorkspaceRecord();
  const del = useDeleteWorkspaceRecord();

  const [recordId, setRecordId] = useState<number | null>(null);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [stage, setStage] = useState<string>(STAGES[0].id);
  const [lab, setLab] = useState<LabContent>(() => emptyLab(SCENARIOS[0]));
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const scenario = scenarioById(scenarioId);
  const records = useMemo(() => list.data ?? [], [list.data]);
  const busy = create.isPending || update.isPending || del.isPending;
  const refresh = () => qc.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() });

  const startNew = (id: string) => {
    setRecordId(null); setScenarioId(id); setStage(STAGES[0].id); setLab(emptyLab(scenarioById(id))); setMsg(null); setConfirmDel(false);
  };
  const open = (r: WorkspaceRecord) => {
    const sc = scenarioById(r.metadata?.scenarioId);
    setRecordId(r.id); setScenarioId(sc.id);
    setStage(typeof r.metadata?.stage === 'string' && STAGES.some((s) => s.id === r.metadata.stage) ? (r.metadata.stage as string) : STAGES[0].id);
    setLab(parseLab(r.content, sc)); setMsg(null); setConfirmDel(false);
  };

  const patch = (p: Partial<LabContent>) => { setLab((l) => ({ ...l, ...p })); setMsg(null); };
  const setScore = (cid: string, key: string, v: number) =>
    patch({ candidates: lab.candidates.map((c) => (c.id === cid ? { ...c, scores: { ...c.scores, [key]: v } } : c)) });
  const setNotes = (cid: string, notes: string) =>
    patch({ candidates: lab.candidates.map((c) => (c.id === cid ? { ...c, notes } : c)) });
  const toggle = (k: 'jdChecks' | 'outreachChecks', i: number) => patch({ [k]: lab[k].map((v, j) => (j === i ? !v : v)) } as Partial<LabContent>);

  const save = () => {
    const data = {
      kind: SIMULATION_KIND as typeof SIMULATION_KIND,
      title: `${scenario.role} · ${scenario.company}`.slice(0, 160),
      content: JSON.stringify(lab),
      metadata: { scenarioId, stage },
    };
    const ok = (r: WorkspaceRecord) => {
      void refresh(); setRecordId(r.id); setMsg({ text: 'Saved privately to your account.', error: false }); };
    const fail = () => setMsg({ text: 'Could not save. Your edits are still here, try again.', error: true });
    if (recordId) update.mutate({ id: recordId, data: { title: data.title, content: data.content, metadata: data.metadata } }, { onSuccess: ok, onError: fail });
    else create.mutate({ data }, { onSuccess: ok, onError: fail });
  };
  const remove = () => {
    if (!recordId) return;
    del.mutate({ id: recordId }, {
      onSuccess: () => { startNew(scenarioId); setMsg({ text: 'Exercise deleted.', error: false }); void refresh(); },
      onError: () => setMsg({ text: 'Could not delete. Try again.', error: true }),
    });
  };

  return (
    <div className="pt-page">
      <div className="workspace-page-header">
        <div>
          <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Recruiting simulation lab</div>
          <h1>Practice the craft on invented people.</h1>
          <p>Draft a job description, compare fictional candidates on one scorecard, and write outreach that is never sent.</p>
        </div>
      </div>
      <div className="pt-note" role="note" data-testid="text-lab-disclaimer"><AlertTriangle size={15} /><span>{LAB_DISCLAIMER} Checklists are fixed prompts, not automated grading.</span></div>

      <div className="pt-layout">
        <section className="workspace-panel">
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Saved</span><h2>Exercises</h2></div><span className="workspace-count">{records.length}</span></div>
          {list.isLoading && <div className="workspace-skeleton" style={{ padding: 16 }} aria-label="Loading exercises"><div className="workspace-skeleton-line" /><div className="workspace-skeleton-line workspace-skeleton-mid" /></div>}
          {list.isError && (
            <div className="workspace-error" role="alert"><AlertTriangle size={18} /><div><h2>Could not load</h2><p>Saved exercises are unavailable.</p></div><button type="button" className="workspace-button workspace-button-quiet" onClick={() => void list.refetch()}><RefreshCw size={13} /> Retry</button></div>
          )}
          {!list.isLoading && !list.isError && records.length === 0 && (
            <div className="workspace-empty"><div className="workspace-empty-mark"><FlaskConical size={18} /></div><div><h3>No saved exercises</h3><p>Pick a scenario and save when you want to return to it.</p></div></div>
          )}
          <div className="pt-list">
            {records.map((r) => (
              <button key={r.id} type="button" className={`pt-item ${recordId === r.id ? 'is-on' : ''}`} disabled={busy} onClick={() => open(r)} data-testid={`button-open-lab-${r.id}`}>
                <strong>{r.title}</strong><small>Updated {fmtDate(r.updatedAt)}</small>
              </button>
            ))}
          </div>
          <div className="workspace-panel-foot"><button type="button" className="workspace-button workspace-button-quiet" disabled={busy} onClick={() => startNew(scenarioId)} data-testid="button-new-lab"><Plus size={13} /> New exercise</button></div>
        </section>

        <section className="workspace-panel">
          <fieldset className="pt-body" key={recordId ?? 'new'} disabled={busy} style={{ border: 0, margin: 0, minWidth: 0 }}>
            <div className="pt-scenarios" role="group" aria-label="Scenario">
              {SCENARIOS.map((s) => (
                <button key={s.id} type="button" className={`pt-scenario ${s.id === scenarioId ? 'is-on' : ''}`} disabled={recordId !== null && s.id !== scenarioId} onClick={() => startNew(s.id)} data-testid={`button-scenario-${s.id}`}>
                  <strong>{s.role}</strong><small>{s.company} · fictional</small><small>{s.blurb}</small>
                </button>
              ))}
            </div>
            <p className="pt-meta" style={{ margin: 0 }}>{scenario.brief}</p>
            <div className="pt-stages" role="tablist">
              {STAGES.map((s) => <button key={s.id} type="button" role="tab" aria-selected={stage === s.id} className={stage === s.id ? 'is-on' : ''} onClick={() => setStage(s.id)} data-testid={`tab-stage-${s.id}`}>{s.label}</button>)}
            </div>

            {stage === 'job-description' && (
              <>
                <label className="pt-field"><span>Draft job description (fictional role)</span>
                  <textarea rows={11} value={lab.jobDescription} onChange={(e) => patch({ jobDescription: e.target.value })} placeholder="Purpose of the role, daily tasks, required skills, nice-to-have skills, hours, next steps." data-testid="input-lab-jd" />
                </label>
                <ul className="pt-checks">{JD_CHECKLIST.map((c, i) => <li key={c}><label><input type="checkbox" checked={lab.jdChecks[i]} onChange={() => toggle('jdChecks', i)} /> {c}</label></li>)}</ul>
              </>
            )}

            {stage === 'scorecard' && (
              <>
                <div className="pt-score-wrap">
                  <table className="pt-score">
                    <caption className="pt-meta" style={{ textAlign: 'left', paddingBottom: 8 }}>Same job-related criteria for every fictional candidate. Score from evidence in the summary only.</caption>
                    <thead><tr><th>Criterion</th>{lab.candidates.map((c) => <th key={c.id}>{c.name}</th>)}</tr></thead>
                    <tbody>
                      {CRITERIA.map((k) => (
                        <tr key={k.id}>
                          <td><strong>{k.label}</strong><small>{k.hint}</small></td>
                          {lab.candidates.map((c) => (
                            <td key={c.id}>
                              <select aria-label={`${k.label}, ${c.name}`} value={c.scores[k.id] ?? 0} onChange={(e) => setScore(c.id, k.id, Number(e.target.value))} data-testid={`select-score-${c.id}-${k.id}`}>
                                {SCORE_LABELS.map((l, v) => <option key={l} value={v}>{v === 0 ? '-' : v} {v ? `· ${l}` : ''}</option>)}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr><td><strong>Total</strong><small>Sum of scored criteria</small></td>{lab.candidates.map((c) => { const t = totalScore(c); return <td key={c.id}><span className="pt-total" data-testid={`text-total-${c.id}`}>{t.sum}</span><small>{t.scored} of {CRITERIA.length} scored</small></td>; })}</tr>
                    </tbody>
                  </table>
                </div>
                <div className="pt-scenarios">
                  {scenario.candidates.map((c) => {
                    const st = lab.candidates.find((x) => x.id === c.id);
                    return (
                      <div key={c.id} style={{ display: 'grid', gap: 8 }}>
                        <div className="pt-cand"><strong>{c.name}</strong><br />{c.summary}</div>
                        <label className="pt-field"><span>Evidence notes</span><textarea rows={3} value={st?.notes ?? ''} onChange={(e) => setNotes(c.id, e.target.value)} placeholder="Quote the evidence behind each score." data-testid={`input-notes-${c.id}`} /></label>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {stage === 'outreach' && (
              <>
                <label className="pt-field"><span>Draft outreach (not sent, no email connection)</span>
                  <textarea rows={9} value={lab.outreach} onChange={(e) => patch({ outreach: e.target.value })} placeholder="Write to a fictional candidate. This text is only saved in your private lab." data-testid="input-lab-outreach" />
                </label>
                <ul className="pt-checks">{OUTREACH_CHECKLIST.map((c, i) => <li key={c}><label><input type="checkbox" checked={lab.outreachChecks[i]} onChange={() => toggle('outreachChecks', i)} /> {c}</label></li>)}</ul>
              </>
            )}

            {stage === 'review' && (
              <>
                <ul className="pt-checks">{REVIEW_PROMPTS.map((p) => <li key={p}>{p}</li>)}</ul>
                <label className="pt-field"><span>Your reflection</span><textarea rows={6} value={lab.reviewNotes} onChange={(e) => patch({ reviewNotes: e.target.value })} data-testid="input-lab-review" /></label>
              </>
            )}

            <div className="pt-actions">
              <button type="button" className="workspace-button workspace-button-dark" onClick={save} disabled={busy} data-testid="button-save-lab"><Save size={14} /> {busy ? 'Saving…' : recordId ? 'Save changes' : 'Save exercise'}</button>
              {recordId && !confirmDel && <button type="button" className="workspace-button workspace-button-quiet" onClick={() => setConfirmDel(true)} data-testid="button-delete-lab"><Trash2 size={14} /> Delete</button>}
              {msg && <span role="status" className={`pt-feedback ${msg.error ? 'is-error' : ''}`}>{msg.text}</span>}
            </div>
            {confirmDel && (
              <div className="pt-confirm" role="alertdialog" aria-label="Confirm delete">
                <span>Delete this saved exercise permanently?</span>
                <button type="button" className="workspace-button workspace-button-dark" onClick={remove} disabled={busy} data-testid="button-confirm-delete-lab">Delete</button>
                <button type="button" className="workspace-button workspace-button-quiet" onClick={() => setConfirmDel(false)}>Keep</button>
              </div>
            )}
          </fieldset>
        </section>
      </div>
    </div>
  );
}
