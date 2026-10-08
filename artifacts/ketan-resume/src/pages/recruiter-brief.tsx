import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import QRCode from 'qrcode';
import { ArrowLeft, Copy, Download, AlertTriangle } from 'lucide-react';
import { portfolio } from '@/data/portfolio';
import { portfolioViews, publicPortfolioUrl, readPortfolioView, type PortfolioView } from '@/lib/portfolio-view';
import { trackEvent } from '@/lib/analytics';
import { careerBriefLimitation, careerBriefUrl, createCareerBriefPdf } from '@/lib/career-brief-pdf';

const limitation = careerBriefLimitation;

function shareUrl(view: PortfolioView) {
  return careerBriefUrl(view);
}

async function buildPdf(view: PortfolioView) {
  const doc = await createCareerBriefPdf(view);
  doc.save(`ketan-bhoi-brief-${view}.pdf`);
}

export default function RecruiterBrief() {
  const [loc] = useLocation();
  const [view, setView] = useState<PortfolioView>(readPortfolioView());
  const [qr, setQr] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const cfg = portfolioViews.find((v) => v.value === view) ?? portfolioViews[0];

  useEffect(() => { setView(readPortfolioView()); }, [loc]);
  useEffect(() => { QRCode.toDataURL(shareUrl(view), { margin: 1, width: 240 }).then(setQr).catch(() => setQr('')); }, [view]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl(view));
      setNotice({ ok: true, text: 'Link copied.' });
      trackEvent('brief_link_copied', { roleView: view });
    } catch {
      setNotice({ ok: false, text: `Copy failed. Copy manually: ${shareUrl(view)}` });
    }
  }
  async function download() {
    try {
      await buildPdf(view);
      setNotice({ ok: true, text: 'PDF downloaded.' });
      trackEvent('brief_downloaded', { roleView: view });
    } catch {
      setNotice({ ok: false, text: 'The PDF could not be created. Please retry.' });
    }
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-5 py-10" data-testid="page-recruiter-brief">
      <Link href="/portfolio" data-testid="link-back-portfolio" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Full portfolio</Link>
      <article className="mt-6 rounded-xl border border-border bg-card p-6 md:p-10">
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career brief - {cfg.label} view</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{portfolio.name}</h1>
            <p className="mt-1 text-lg">{portfolio.targetRole}</p>
          </div>
          {qr && <img src={qr} alt="QR code linking to this brief" width={96} height={96} className="h-24 w-24 shrink-0" data-testid="img-brief-qr" />}
        </div>
        <p className="mt-5 text-sm leading-relaxed">{portfolio.positioning}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {portfolioViews.map((v) => (
            <Link key={v.value} href={`/brief?view=${v.value}`} data-testid={`link-brief-view-${v.value}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${v.value === view ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{v.label}</Link>
          ))}
        </div>
        <Section title="Focus evidence"><p><strong>{cfg.focus}.</strong> {cfg.evidence}</p></Section>
        <Section title="Relevant work">
          {portfolio.experiences.map((e) => (
            <p key={e.company} className="mb-2"><strong>{e.title}</strong>, {e.company} ({e.dates}). {e.bullets[0]}</p>
          ))}
        </Section>
        <Section title="Current work sample (not employment)"><p><strong>{portfolio.projects[1].name}.</strong> {portfolio.projects[1].contribution}</p></Section>
        <Section title="Education">
          {portfolio.education.map((e) => <p key={e.credential}>{e.credential}, {e.institution}, {e.completed}{e.result ? ` (${e.result})` : ''}</p>)}
        </Section>
        <Section title="Limitations"><p>{limitation}</p></Section>
        <Section title="Contact">
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <a className="underline" href={publicPortfolioUrl} data-testid="link-brief-portfolio">Portfolio</a>
            {portfolio.publicLinks.linkedin && <a className="underline" href={portfolio.publicLinks.linkedin} data-testid="link-brief-linkedin">LinkedIn</a>}
            {portfolio.publicContact && <a className="underline" href={portfolio.publicContact.url} data-testid="link-brief-email">{portfolio.publicContact.url.replace('mailto:', '')}</a>}
          </p>
        </Section>
      </article>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={download} data-testid="button-download-brief" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" /> Download PDF</button>
        <button type="button" onClick={copy} data-testid="button-copy-brief-link" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold"><Copy className="h-4 w-4" /> Copy share link</button>
      </div>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} data-testid="status-brief-notice" className={`mt-3 flex items-center gap-2 break-all text-sm ${notice.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {!notice.ok && <AlertTriangle className="h-4 w-4 shrink-0" />}{notice.text}
        </p>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-border pt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
