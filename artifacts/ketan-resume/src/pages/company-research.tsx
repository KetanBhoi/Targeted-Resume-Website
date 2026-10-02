import { Plus, X } from 'lucide-react';
import { CareerRecordEditor, Field } from '@/components/career-record-editor';
import { blankResearch, buildResearch, researchSummary, researchToDraft } from '@/lib/career-tools';

export default function CompanyResearch() {
  return (
    <CareerRecordEditor
      kind="research"
      prefix="research"
      eyebrow="Company research"
      heading="What you found, where you found it."
      intro="A private notebook. You add the sources and notes yourself; nothing here is looked up or filled in for you."
      privacy="Entries are private to your account. Ketan Workbench does not search the web or fetch these links. Record what you read and the date you checked it."
      newLabel="New research entry"
      noun="Research entries"
      emptyTitle="No research saved yet"
      emptyBody="Add a company, the sources you read, and the questions you want answered."
      blank={blankResearch}
      toDraft={researchToDraft}
      build={buildResearch}
      summary={researchSummary}
      renderForm={(d, patch, disabled) => (
        <>
          <div className="ct-grid">
            <Field label="Company"><input value={d.companyName} maxLength={200} required onChange={(e) => patch({ companyName: e.target.value })} data-testid="input-research-company" /></Field>
            <Field label="Role (optional)"><input value={d.role} maxLength={200} onChange={(e) => patch({ role: e.target.value })} data-testid="input-research-role" /></Field>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <span className="workspace-eyebrow">Sources you checked</span>
            {d.sources.length === 0 && <p className="ct-hint">No sources added. Add the pages you read yourself.</p>}
            {d.sources.map((s, i) => {
              const set = (k: 'label' | 'url' | 'checkedOn', v: string) => patch({ sources: d.sources.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
              return (
                <div key={i} className="ct-source ct-fade" data-testid={`row-source-${i}`}>
                  <Field label={`Source ${i + 1} label`}><input value={s.label} maxLength={200} onChange={(e) => set('label', e.target.value)} data-testid={`input-source-label-${i}`} /></Field>
                  <div className="ct-grid">
                    <Field label="Link (https only)"><input type="url" inputMode="url" value={s.url} maxLength={2048} placeholder="https://" onChange={(e) => set('url', e.target.value)} data-testid={`input-source-url-${i}`} /></Field>
                    <Field label="Checked on (optional)"><input type="date" value={s.checkedOn} onChange={(e) => set('checkedOn', e.target.value)} data-testid={`input-source-date-${i}`} /></Field>
                  </div>
                  <button type="button" className="workspace-delete-button" disabled={disabled} onClick={() => patch({ sources: d.sources.filter((_, j) => j !== i) })} data-testid={`button-remove-source-${i}`}><X size={13} /> Remove source {i + 1}</button>
                </div>
              );
            })}
            <div><button type="button" className="workspace-button workspace-button-quiet" disabled={disabled || d.sources.length >= 30} onClick={() => patch({ sources: [...d.sources, { label: '', url: '', checkedOn: '' }] })} data-testid="button-add-source"><Plus size={13} /> Add source</button></div>
          </div>
          <Field label="Questions to ask" hint="One per line. Up to 30."><textarea rows={4} value={d.questions} onChange={(e) => patch({ questions: e.target.value })} data-testid="input-research-questions" /></Field>
          <Field label="Reasons this company interests you" hint="One per line. Up to 30."><textarea rows={4} value={d.reasons} onChange={(e) => patch({ reasons: e.target.value })} data-testid="input-research-reasons" /></Field>
          <Field label="Notes"><textarea rows={7} maxLength={50000} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} data-testid="input-research-notes" /></Field>
        </>
      )}
    />
  );
}
