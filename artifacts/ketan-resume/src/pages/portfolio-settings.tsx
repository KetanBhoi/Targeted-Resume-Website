import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetOwnerPortfolioContentQueryKey,
  getGetPortfolioOwnerAccessQueryKey,
  getGetPublicPortfolioContentQueryKey,
  useGetOwnerPortfolioContent,
  useGetPortfolioOwnerAccess,
  useUpdateOwnerPortfolioContent,
  type PortfolioContentInput,
} from '@workspace/api-client-react';
import { CertificatesEditor, RecommendationsEditor } from '@/components/portfolio-content-editors';
import '@/styles/portfolio-content.css';

const DEFAULT_TZ = 'Asia/Kolkata';

function validZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

function toDraft(d: PortfolioContentInput): PortfolioContentInput {
  return {
    booking: { ...d.booking, timezone: d.booking.timezone || DEFAULT_TZ },
    availability: { ...d.availability },
    certificates: d.certificates.map((x) => ({ ...x })),
    recommendations: d.recommendations.map((x) => ({ ...x })),
  };
}

function Gate({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl px-5 py-10" data-testid="page-portfolio-settings">{children}</div>;
}

export default function PortfolioSettings() {
  const { isLoaded, isSignedIn } = useUser();
  const qc = useQueryClient();
  const access = useGetPortfolioOwnerAccess({ query: { queryKey: getGetPortfolioOwnerAccessQueryKey(), enabled: isSignedIn === true, retry: false, staleTime: 0 } });
  const owner = access.data?.isOwner === true;
  const content = useGetOwnerPortfolioContent({ query: { queryKey: getGetOwnerPortfolioContentQueryKey(), enabled: owner, refetchOnWindowFocus: false } });
  const save = useUpdateOwnerPortfolioContent();
  const [draft, setDraft] = useState<PortfolioContentInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (content.data && !dirtyRef.current && !draft) setDraft(toDraft(content.data));
  }, [content.data, draft]);

  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const edit = (fn: (d: PortfolioContentInput) => PortfolioContentInput) => {
    if (save.isPending) return;
    setConfirming(false);
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
    setSaved(false);
  };

  if (!isLoaded || (isSignedIn && access.isLoading)) return <Gate><div className="pc-skel" data-testid="status-settings-loading" /></Gate>;
  if (!isSignedIn) return <Gate><p data-testid="status-settings-signin">Sign in with the owner account to edit portfolio content.</p></Gate>;
  if (access.isError) return <Gate><p className="pc-error" role="alert" data-testid="status-settings-access-error">Access could not be verified. <button className="pc-retry" onClick={() => access.refetch()} data-testid="button-settings-access-retry">Retry</button></p></Gate>;
  if (!owner) return <Gate><p data-testid="status-settings-denied">Access denied. This account is not the portfolio owner.</p></Gate>;
  if (content.isError) return <Gate><p className="pc-error" role="alert" data-testid="status-settings-load-error">Content could not be loaded. <button className="pc-retry" onClick={() => content.refetch()} data-testid="button-settings-retry">Retry</button></p></Gate>;
  if (!draft) return <Gate><div className="pc-skel" data-testid="status-settings-loading" /></Gate>;

  const tzOk = validZone(draft.booking.timezone.trim());
  const urlTrim = draft.booking.url.trim();
  const urlOk = urlTrim === '' || /^https:\/\//i.test(urlTrim);
  const bookingBlocked = draft.booking.enabled && (urlTrim === '' || !urlOk);
  const certBad = draft.certificates.some((x) => x.verificationUrl.trim() !== '' && !/^https:\/\//i.test(x.verificationUrl.trim()));
  const invalid = !tzOk || !urlOk || bookingBlocked || certBad;

  const hasPublic = draft.booking.enabled || draft.availability.published || draft.certificates.some((x) => x.published) || draft.recommendations.some((x) => x.published);
  const onSaveClick = () => { if (hasPublic) setConfirming(true); else onSave(); };
  const onSave = () => {
    setConfirming(false);
    save.mutate({ data: draft }, {
      onSuccess: (res) => {
        setDraft(toDraft(res));
        setDirty(false);
        setSaved(true);
        qc.setQueryData(getGetOwnerPortfolioContentQueryKey(), res);
        qc.invalidateQueries({ queryKey: getGetOwnerPortfolioContentQueryKey() });
        qc.invalidateQueries({ queryKey: getGetPublicPortfolioContentQueryKey() });
      },
    });
  };
  const err = save.error as { data?: { error?: string } } | null;
  const errMsg = save.isError ? err?.data?.error ?? 'Saving failed. Please retry.' : null;
  const b = draft.booking;
  const a = draft.availability;

  return (
    <Gate>
      <h1 className="font-display text-4xl">Portfolio content</h1>
      <p className="pc-note mt-2">Save applies every publish choice you have made below to the public site at once. Scheduling happens on your external provider; this app does not book slots.</p>
      <div className="pc-form mt-6">
        <fieldset disabled={save.isPending} className="pc-form" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} data-testid="fieldset-settings">
        <section className="pc-panel" aria-labelledby="pc-booking">
          <h2 id="pc-booking">Booking</h2>
          <label className="pc-check"><input type="checkbox" checked={b.enabled} onChange={(e) => edit((d) => ({ ...d, booking: { ...d.booking, enabled: e.target.checked } }))} data-testid="checkbox-booking-enabled" /> Show booking on the public site. Turning this off hides the link and booking availability.</label>
          <label className="pc-field"><span>Scheduling link (https)</span><input type="url" value={b.url} maxLength={2048} aria-invalid={!urlOk || bookingBlocked} onChange={(e) => edit((d) => ({ ...d, booking: { ...d.booking, url: e.target.value } }))} data-testid="input-booking-url" />{(!urlOk || bookingBlocked) && <em className="pc-error">An https:// link is required to enable booking.</em>}</label>
          <label className="pc-field"><span>Your timezone (IANA)</span><input value={b.timezone} maxLength={100} aria-invalid={!tzOk} onChange={(e) => edit((d) => ({ ...d, booking: { ...d.booking, timezone: e.target.value } }))} data-testid="input-booking-timezone" />{!tzOk && <em className="pc-error">Not a valid IANA timezone, for example Asia/Kolkata.</em>}</label>
          <label className="pc-field"><span>Availability description (in your timezone)</span><textarea rows={3} value={b.availability} maxLength={2000} onChange={(e) => edit((d) => ({ ...d, booking: { ...d.booking, availability: e.target.value } }))} data-testid="input-booking-availability" /></label>
        </section>
        <section className="pc-panel" aria-labelledby="pc-avail">
          <h2 id="pc-avail">Hiring availability</h2>
          <label className="pc-check"><input type="checkbox" checked={a.published} onChange={(e) => edit((d) => ({ ...d, availability: { ...d.availability, published: e.target.checked } }))} data-testid="checkbox-availability-published" /> Publish hiring availability. Off hides these fields publicly.</label>
          {([['roles', 'Roles', 2000], ['workArrangement', 'Work arrangement', 1000], ['locations', 'Locations', 1000], ['joining', 'Joining', 1000]] as const).map(([k, label, max]) => (
            <label key={k} className="pc-field"><span>{label}</span><textarea rows={2} value={a[k]} maxLength={max} onChange={(e) => edit((d) => ({ ...d, availability: { ...d.availability, [k]: e.target.value } }))} data-testid={`input-availability-${k}`} /></label>
          ))}
        </section>
        <section className="pc-panel" aria-labelledby="pc-certs">
          <h2 id="pc-certs">Additional credentials</h2>
          <p className="pc-note">These are separate from the certificates in the static resume, which are unchanged.</p>
          <CertificatesEditor items={draft.certificates} onChange={(v) => edit((d) => ({ ...d, certificates: v }))} />
        </section>
        <section className="pc-panel" aria-labelledby="pc-recs">
          <h2 id="pc-recs">Recommendations</h2>
          <p className="pc-note">Publishing requires both author consent and your approval. Consent means you obtained the author's permission outside this app.</p>
          <RecommendationsEditor items={draft.recommendations} onChange={(v) => edit((d) => ({ ...d, recommendations: v }))} />
        </section>
        </fieldset>
        {confirming && (
          <div className="pc-panel" role="alertdialog" aria-labelledby="pc-confirm" data-testid="dialog-publish-confirm">
            <h2 id="pc-confirm">Apply these publish choices?</h2>
            <p className="pc-note">Saving makes every item currently marked as published or enabled visible on the public portfolio, including your edits to content that is already live.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pc-btn" onClick={onSave} data-testid="button-confirm-publish">Save and apply publicly</button>
              <button type="button" className="pc-btn pc-btn-quiet" onClick={() => setConfirming(false)} data-testid="button-cancel-publish">Cancel, keep editing</button>
            </div>
          </div>
        )}
        <div className="pc-savebar">
          <span className="pc-mono" role="status" data-testid="status-settings-save">
            {save.isPending ? 'Saving' : errMsg ? '' : saved ? 'Saved and published as chosen' : dirty ? 'Unsaved changes' : 'No changes'}
            {errMsg && <span className="pc-error" role="alert" data-testid="status-settings-save-error">{errMsg}</span>}
          </span>
          <button type="button" className="pc-btn" disabled={!dirty || invalid || save.isPending || confirming} onClick={onSaveClick} data-testid="button-settings-save">{errMsg ? 'Retry save' : 'Save'}</button>
        </div>
      </div>
    </Gate>
  );
}
