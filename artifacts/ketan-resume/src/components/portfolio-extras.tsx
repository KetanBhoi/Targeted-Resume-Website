import { useEffect, useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { getGetPublicPortfolioContentQueryKey, useGetPublicPortfolioContent } from '@workspace/api-client-react';
import '@/styles/portfolio-content.css';

function isHttps(url: string): boolean {
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

function validZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

function fmtTime(now: Date, tz?: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now);
}

function fmtDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

export default function PortfolioExtras() {
  const q = useGetPublicPortfolioContent({ query: { queryKey: getGetPublicPortfolioContentQueryKey() } });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (q.isError) {
    return (
      <p className="pc-mono mx-auto max-w-[1380px] px-5 py-4 lg:px-10" role="alert" data-testid="status-portfolio-extras-error">
        Extra portfolio details did not load. <button type="button" className="pc-retry" onClick={() => q.refetch()} data-testid="button-portfolio-extras-retry">Retry</button>
      </p>
    );
  }
  const c = q.data;
  if (!c) return null;

  const b = c.booking;
  const a = c.availability;
  const showBooking = b.enabled && isHttps(b.url);
  const hostZone = validZone(b.timezone) ? b.timezone : '';
  const availFields = [
    ['Roles', a.roles],
    ['Work arrangement', a.workArrangement],
    ['Locations', a.locations],
    ['Joining', a.joining],
  ].filter(([, v]) => v.trim());
  const showAvail = a.published && availFields.length > 0;
  const certs = c.certificates.filter((x) => x.published && x.title.trim());
  const recs = c.recommendations.filter((x) => x.published && x.approved && x.consent && x.text.trim());

  return (
    <>
      {showBooking && (
        <section id="booking" className="anchor-target pc-section bg-secondary/55" data-testid="section-booking">
          <div className="pc-wrap pc-grid">
            <div>
              <p className="pc-mono">Book a conversation</p>
              <h2 className="pc-h2 mt-3">Pick a time that suits you.</h2>
              <p className="pc-lead">Scheduling happens on an external provider's page. This site does not reserve slots itself.</p>
            </div>
            <div className="pc-list">
              {b.availability.trim() && <p className="whitespace-pre-wrap text-sm leading-6" data-testid="text-booking-availability">{b.availability}</p>}
              {hostZone && (
                <div className="pc-times" data-testid="list-booking-times">
                  <div className="pc-time"><span className="pc-mono">Host: {hostZone}</span><strong data-testid="text-time-host">{fmtTime(now, hostZone)}</strong></div>
                  <div className="pc-time"><span className="pc-mono">You: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><strong data-testid="text-time-viewer">{fmtTime(now)}</strong></div>
                </div>
              )}
              <div>
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="pc-btn" data-testid="link-booking">
                  Open scheduling page <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}
      {showAvail && (
        <section id="hiring-availability" className="anchor-target pc-section" data-testid="section-hiring-availability">
          <div className="pc-wrap pc-grid">
            <div>
              <p className="pc-mono">Hiring availability</p>
              <h2 className="pc-h2 mt-3">What Ketan is open to.</h2>
            </div>
            <dl className="pc-two">
              {availFields.map(([label, value]) => (
                <div key={label} className="pc-card">
                  <dt className="pc-mono">{label}</dt>
                  <dd className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ margin: 0, marginTop: 8 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
      {certs.length > 0 && (
        <section id="credentials" className="anchor-target pc-section bg-secondary/55" data-testid="section-credentials">
          <div className="pc-wrap pc-grid">
            <div>
              <p className="pc-mono">Additional credentials</p>
              <h2 className="pc-h2 mt-3">Detailed credentials.</h2>
            </div>
            <ul className="pc-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {certs.map((x) => (
                <li key={x.id} className="pc-card" data-testid={`card-credential-${x.id}`}>
                  <div className="flex items-start gap-3">
                    <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-2xl leading-tight">{x.title}</h3>
                      <p className="pc-mono mt-2">{[x.issuer, x.completed && fmtDate(x.completed)].filter(Boolean).join(' / ')}</p>
                      {isHttps(x.verificationUrl) && (
                        <a href={x.verificationUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 border-b border-primary text-xs font-bold" data-testid={`link-verify-${x.id}`}>
                          Verify credential <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {recs.length > 0 && (
        <section id="recommendations" className="anchor-target pc-section" data-testid="section-recommendations">
          <div className="pc-wrap pc-grid">
            <div>
              <p className="pc-mono">Recommendations</p>
              <h2 className="pc-h2 mt-3">In their words.</h2>
            </div>
            <div className="pc-list">
              {recs.map((x) => (
                <figure key={x.id} className="pc-card" style={{ margin: 0 }} data-testid={`card-recommendation-${x.id}`}>
                  <blockquote className="whitespace-pre-wrap font-display text-xl leading-8" style={{ margin: 0 }}>{x.text}</blockquote>
                  <figcaption className="pc-mono mt-4">{[x.author, x.relationship].filter(Boolean).join(' / ')}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
