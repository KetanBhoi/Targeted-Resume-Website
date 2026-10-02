import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PortfolioCertificate, PortfolioRecommendation } from '@workspace/api-client-react';
import '@/styles/portfolio-content.css';

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Confirm({ id, label, onConfirm }: { id: string; label: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className="pc-btn pc-btn-danger" onClick={() => setAsking(true)} data-testid={`button-remove-${id}`}><Trash2 className="size-3.5" aria-hidden="true" /> {label}</button>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2" role="alert">
      <span className="pc-error">Delete this entry? It is removed from the site once you save.</span>
      <button type="button" className="pc-btn pc-btn-danger" onClick={onConfirm} data-testid={`button-confirm-remove-${id}`}>Confirm delete</button>
      <button type="button" className="pc-btn pc-btn-quiet" onClick={() => setAsking(false)} data-testid={`button-cancel-remove-${id}`}>Cancel</button>
    </span>
  );
}

export function CertificatesEditor({ items, onChange }: { items: PortfolioCertificate[]; onChange: (v: PortfolioCertificate[]) => void }) {
  const patch = (id: string, p: Partial<PortfolioCertificate>) => onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <div className="pc-form">
      {items.length === 0 && <p className="pc-note" data-testid="status-certificates-empty">No additional credentials yet.</p>}
      {items.map((x, i) => {
        const urlBad = x.verificationUrl.trim() !== '' && !/^https:\/\//i.test(x.verificationUrl.trim());
        return (
          <div key={x.id} className="pc-card pc-form" data-testid={`editor-certificate-${x.id}`}>
            <div className="pc-two">
              <label className="pc-field"><span>Title</span><input value={x.title} maxLength={200} onChange={(e) => patch(x.id, { title: e.target.value })} data-testid={`input-cert-title-${x.id}`} /></label>
              <label className="pc-field"><span>Issuer</span><input value={x.issuer} maxLength={200} onChange={(e) => patch(x.id, { issuer: e.target.value })} data-testid={`input-cert-issuer-${x.id}`} /></label>
              <label className="pc-field"><span>Completed</span><input type="date" value={x.completed} onChange={(e) => patch(x.id, { completed: e.target.value })} data-testid={`input-cert-date-${x.id}`} /></label>
              <label className="pc-field"><span>Verification URL (https, optional)</span><input type="url" value={x.verificationUrl} maxLength={2048} aria-invalid={urlBad} onChange={(e) => patch(x.id, { verificationUrl: e.target.value })} data-testid={`input-cert-url-${x.id}`} />{urlBad && <em className="pc-error">Must start with https://</em>}</label>
            </div>
            <label className="pc-check"><input type="checkbox" checked={x.published} onChange={(e) => patch(x.id, { published: e.target.checked })} data-testid={`checkbox-cert-publish-${x.id}`} /> Publish credential {i + 1} on the public site</label>
            <Confirm id={`cert-${x.id}`} label="Remove" onConfirm={() => onChange(items.filter((y) => y.id !== x.id))} />
          </div>
        );
      })}
      <div><button type="button" className="pc-btn pc-btn-quiet" disabled={items.length >= 30} onClick={() => onChange([...items, { id: newId(), title: '', issuer: '', completed: '', verificationUrl: '', published: false }])} data-testid="button-add-certificate"><Plus className="size-3.5" aria-hidden="true" /> Add credential</button></div>
    </div>
  );
}

export function RecommendationsEditor({ items, onChange }: { items: PortfolioRecommendation[]; onChange: (v: PortfolioRecommendation[]) => void }) {
  const patch = (id: string, p: Partial<PortfolioRecommendation>) => onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <div className="pc-form">
      {items.length === 0 && <p className="pc-note" data-testid="status-recommendations-empty">No recommendations yet.</p>}
      {items.map((x) => {
        const ready = x.consent && x.approved;
        return (
          <div key={x.id} className="pc-card pc-form" data-testid={`editor-recommendation-${x.id}`}>
            <div className="pc-two">
              <label className="pc-field"><span>Author</span><input value={x.author} maxLength={160} onChange={(e) => patch(x.id, { author: e.target.value })} data-testid={`input-rec-author-${x.id}`} /></label>
              <label className="pc-field"><span>Relationship</span><input value={x.relationship} maxLength={160} onChange={(e) => patch(x.id, { relationship: e.target.value })} data-testid={`input-rec-relationship-${x.id}`} /></label>
            </div>
            <label className="pc-field"><span>Recommendation text</span><textarea rows={4} value={x.text} maxLength={3000} onChange={(e) => patch(x.id, { text: e.target.value })} data-testid={`input-rec-text-${x.id}`} /></label>
            <label className="pc-check"><input type="checkbox" checked={x.consent} onChange={(e) => patch(x.id, { consent: e.target.checked, published: e.target.checked ? x.published : false })} data-testid={`checkbox-rec-consent-${x.id}`} /> Author consent: I attest that I obtained this author's permission to publish their words, outside this app.</label>
            <label className="pc-check"><input type="checkbox" checked={x.approved} onChange={(e) => patch(x.id, { approved: e.target.checked, published: e.target.checked ? x.published : false })} data-testid={`checkbox-rec-approved-${x.id}`} /> Owner approval: I have reviewed this text and approve it.</label>
            <label className="pc-check"><input type="checkbox" checked={x.published} disabled={!ready} onChange={(e) => patch(x.id, { published: e.target.checked })} data-testid={`checkbox-rec-publish-${x.id}`} /> Publish on the public site {!ready && <em>(requires consent and approval)</em>}</label>
            <Confirm id={`rec-${x.id}`} label="Remove" onConfirm={() => onChange(items.filter((y) => y.id !== x.id))} />
          </div>
        );
      })}
      <div><button type="button" className="pc-btn pc-btn-quiet" disabled={items.length >= 30} onClick={() => onChange([...items, { id: newId(), author: '', relationship: '', text: '', consent: false, approved: false, published: false }])} data-testid="button-add-recommendation"><Plus className="size-3.5" aria-hidden="true" /> Add recommendation</button></div>
    </div>
  );
}
