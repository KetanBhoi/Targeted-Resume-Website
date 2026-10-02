import { useState } from 'react';
import type { WorkspaceRecord } from '@workspace/api-client-react';
import { CareerRecordEditor, Field } from '@/components/career-record-editor';
import {
  CURRENCIES, DEFAULT_WEIGHTS, RATING_KEYS, blankOffer, buildOffer, offerSummary, offerToDraft, readOffer,
  weightedScore, weightsTotal, weightsValid, type Currency, type RatingKey, type Weights,
} from '@/lib/career-tools';

const LABEL: Record<RatingKey, string> = { salary: 'Salary', benefits: 'Benefits', location: 'Location', hours: 'Hours', growth: 'Growth' };
const NA = <span className="ct-muted">Not entered</span>;
const money = (n: number | null, c: string) => (n === null ? NA : `${c} ${n.toLocaleString('en-US')}`);

function Comparison({ records }: { records: WorkspaceRecord[] }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const offers = records.map(readOffer);
  const valid = weightsValid(weights);
  const total = valid ? weightsTotal(weights) : 0;
  const sameCurrency = offers.length > 0 && offers.every((o) => o.currency === offers[0].currency);

  return (
    <section className="workspace-panel" style={{ marginTop: 18 }} aria-label="Compare offers" data-testid="section-offer-compare">
      <div className="workspace-panel-head"><div><div className="workspace-eyebrow">Side by side</div><h2>Compare what you entered</h2></div><span className="workspace-count">{offers.length}</span></div>
      {offers.length < 2 ? (
        <div className="workspace-empty"><div><h3>{offers.length === 0 ? 'No offers to compare' : 'One offer saved'}</h3><p>Save at least two offers to see them side by side. Values appear exactly as you entered them.</p></div></div>
      ) : (
        <div style={{ padding: 24 }}>
          <p className="ct-hint" style={{ marginBottom: 14 }}>These are your own ratings and weights, local page preferences that reset when you reload. They show your judgment, not a recommendation, and no exchange rates or market benchmarks are used.</p>
          <span className="workspace-eyebrow">Your priorities (relative weights, 0 or more)</span>
          <div className="ct-weights workspace-form">
            {RATING_KEYS.map((k) => (
              <Field key={k} label={LABEL[k]}>
                <input type="number" inputMode="decimal" min={0} step="any" value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: e.target.value }))} data-testid={`input-weight-${k}`} />
              </Field>
            ))}
          </div>
          {!valid && <p className="ct-warn" role="alert" data-testid="text-weights-invalid">Weights must be numbers of zero or more. Scores cannot be compared until fixed.</p>}
          {valid && total === 0 && <p className="ct-warn" role="alert" data-testid="text-weights-zero">All weights are zero, so scores cannot be compared. Give at least one priority a weight above zero.</p>}
          {!sameCurrency && <p className="ct-warn" data-testid="text-currency-mismatch">Offers use different currencies. Money is shown as entered and is not comparable; no conversion is applied.</p>}
          <div className="ct-compare">
            <table className="ct-table">
              <thead><tr><th scope="col">&nbsp;</th>{offers.map((o) => <th key={o.id} scope="col">{o.company}{o.role ? ` - ${o.role}` : ''}</th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">Annual salary</th>{offers.map((o) => <td key={o.id} data-testid={`cell-salary-${o.id}`}>{money(o.annualSalary, o.currency)}</td>)}</tr>
                <tr><th scope="row">Annual bonus</th>{offers.map((o) => <td key={o.id}>{money(o.annualBonus, o.currency)}</td>)}</tr>
                <tr><th scope="row">Salary + bonus</th>{offers.map((o) => <td key={o.id}>{o.annualSalary !== null && o.annualBonus !== null ? money(o.annualSalary + o.annualBonus, o.currency) : <span className="ct-muted">Needs both values</span>}</td>)}</tr>
                <tr><th scope="row">Hours / week</th>{offers.map((o) => <td key={o.id}>{o.hoursPerWeek === null ? NA : o.hoursPerWeek}</td>)}</tr>
                <tr><th scope="row">Location</th>{offers.map((o) => <td key={o.id}>{o.location || NA}{o.arrangement ? ` (${o.arrangement})` : ''}</td>)}</tr>
                <tr><th scope="row">Benefits</th>{offers.map((o) => <td key={o.id} style={{ whiteSpace: 'pre-wrap' }}>{o.benefits || NA}</td>)}</tr>
                {RATING_KEYS.map((k) => <tr key={k}><th scope="row">Your {LABEL[k].toLowerCase()} rating</th>{offers.map((o) => <td key={o.id}>{o.ratings[k]} / 5</td>)}</tr>)}
                <tr><th scope="row">Your weighted score</th>{offers.map((o) => { const s = weightedScore(o.ratings, weights); return <td key={o.id} data-testid={`cell-score-${o.id}`}>{s === null ? <span className="ct-muted">Cannot compare</span> : `${s.toFixed(2)} / 5`}</td>; })}</tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function OfferComparison() {
  return (
    <CareerRecordEditor
      kind="offer"
      prefix="offer"
      eyebrow="Offer comparison"
      heading="Your offers, on your terms."
      intro="Enter real offers you received. Leave unknown numbers blank; blank is not zero. Compare them with ratings and weights you set."
      privacy="Offers and notes are private to your account and are not used for analytics. Values are never converted between currencies and no market data is added."
      newLabel="New offer"
      noun="Offers"
      emptyTitle="No offers entered"
      emptyBody="Add an offer you have received. Nothing is pre-filled."
      blank={blankOffer}
      toDraft={offerToDraft}
      build={buildOffer}
      summary={offerSummary}
      renderExtra={(records) => <Comparison records={records} />}
      renderForm={(d, patch) => (
        <>
          <div className="ct-grid">
            <Field label="Company"><input value={d.company} maxLength={200} required onChange={(e) => patch({ company: e.target.value })} data-testid="input-offer-company" /></Field>
            <Field label="Role"><input value={d.role} maxLength={200} onChange={(e) => patch({ role: e.target.value })} data-testid="input-offer-role" /></Field>
            <Field label="Currency"><select value={d.currency} onChange={(e) => patch({ currency: e.target.value as Currency })} data-testid="select-offer-currency">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Annual salary" hint="Blank means unknown."><input type="number" inputMode="decimal" min={0} step="any" value={d.annualSalary} onChange={(e) => patch({ annualSalary: e.target.value })} data-testid="input-offer-salary" /></Field>
            <Field label="Annual bonus" hint="Blank means unknown."><input type="number" inputMode="decimal" min={0} step="any" value={d.annualBonus} onChange={(e) => patch({ annualBonus: e.target.value })} data-testid="input-offer-bonus" /></Field>
            <Field label="Hours per week" hint="Optional. Above zero."><input type="number" inputMode="decimal" min={0} step="any" value={d.hoursPerWeek} onChange={(e) => patch({ hoursPerWeek: e.target.value })} data-testid="input-offer-hours" /></Field>
            <Field label="Location"><input value={d.location} maxLength={200} onChange={(e) => patch({ location: e.target.value })} data-testid="input-offer-location" /></Field>
            <Field label="Arrangement" hint="For example on-site or hybrid, as offered."><input value={d.arrangement} maxLength={100} onChange={(e) => patch({ arrangement: e.target.value })} data-testid="input-offer-arrangement" /></Field>
          </div>
          <Field label="Benefits"><textarea rows={4} maxLength={5000} value={d.benefits} onChange={(e) => patch({ benefits: e.target.value })} data-testid="input-offer-benefits" /></Field>
          <div>
            <span className="workspace-eyebrow">Your ratings, 1 (low) to 5 (high)</span>
            <div className="ct-ratings" style={{ marginTop: 8 }}>
              {RATING_KEYS.map((k) => (
                <Field key={k} label={LABEL[k]}>
                  <select value={d.ratings[k]} onChange={(e) => patch({ ratings: { ...d.ratings, [k]: Number(e.target.value) } })} data-testid={`select-rating-${k}`}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
              ))}
            </div>
            <p className="ct-hint">Ratings start at a neutral 3 and are your own judgment, not a measurement. Change each one to reflect how you see the offer.</p>
          </div>
          <Field label="Personal notes"><textarea rows={6} maxLength={50000} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} data-testid="input-offer-notes" /></Field>
        </>
      )}
    />
  );
}
