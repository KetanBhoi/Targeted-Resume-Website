import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Loader2, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSubmitPortfolioFeedback } from '@workspace/api-client-react';
import { portfolioViews, type PortfolioView } from '@/lib/portfolio-view';
import { trackEvent } from '@/lib/analytics';
import { usePortfolioLanguage } from '@/lib/portfolio-language';

const signals = [
  { value: 'strong-fit', label: 'Strong fit' },
  { value: 'explore', label: 'Worth exploring' },
  { value: 'needs-evidence', label: 'Needs more evidence' },
] as const;

export function RecruiterTools({ view, onViewChange }: { view: PortfolioView; onViewChange: (view: PortfolioView) => void }) {
  const { t, language } = usePortfolioLanguage();
  const current = portfolioViews.find((v) => v.value === view) ?? portfolioViews[0];
  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-7" data-testid="section-recruiter-tools" aria-label={t('Role view and feedback')}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('Read this portfolio as')}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('Reviewer perspective')}>
        {portfolioViews.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={v.value === view}
            onClick={() => onViewChange(v.value)}
            data-testid={`button-view-${v.value}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${v.value === view ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
          >
            {t(v.label)}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-1" data-testid="text-view-evidence">
        <p className="text-sm font-semibold">{t('Focus:')} {t(current.focus)}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(current.evidence)}</p>
      </div>
      <Link href={`/brief?view=${view}`} data-testid="link-share-brief" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        {t('Open the one-page brief for this view')}{language !== 'en' ? ` ${t('(English brief)')}` : ''} <ArrowRight className="h-4 w-4" />
      </Link>

    </section>
  );
}

export function RecruiterFeedback({ view }: { view: PortfolioView }) {
  const { t } = usePortfolioLanguage();
  const [signal, setSignal] = useState<(typeof signals)[number]['value']>('explore');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sent, setSent] = useState(false);
  const submit = useSubmitPortfolioFeedback();
  const mutateRef = useRef(submit.mutate);
  mutateRef.current = submit.mutate;
  const trimmed = message.trim();
  const valid = trimmed.length >= 10 && trimmed.length <= 1200;

  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!valid || submit.isPending) return;
    mutateRef.current(
      { data: { roleView: view, signal, message: trimmed, website } },
      {
        onSuccess: () => {
          setSent(true);
          setMessage('');
          trackEvent('feedback_submitted', { roleView: view, signal });
        },
      },
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-7" data-testid="section-recruiter-feedback" aria-label={t('Private feedback')}>
      <div>
        <h3 className="text-base font-semibold">{t('Leave a private note (optional)')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('Only the portfolio owner can read this. Please do not include personal or sensitive information.')}</p>
        {sent ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted p-4" role="status" data-testid="status-feedback-success">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="text-sm">
              {t('Thank you, your note was sent privately.')}{' '}
              <button type="button" className="font-semibold underline" onClick={() => { setSent(false); submit.reset(); }} data-testid="button-feedback-another">{t('Send another')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="mt-4 grid gap-3" data-testid="form-feedback">
            <label className="grid gap-1 text-sm font-medium">
              {t('Signal')}
              <select value={signal} onChange={(e) => setSignal(e.target.value as typeof signal)} data-testid="select-feedback-signal" className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                {signals.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('Note')}
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1200} rows={4} data-testid="input-feedback-message" placeholder={t('What evidence would help you decide? (10-1200 characters)')} className="rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
              <span className="text-xs font-normal text-muted-foreground">{trimmed.length}/1200{trimmed.length > 0 && trimmed.length < 10 ? t(' - at least 10 characters') : ''}</span>
            </label>
            <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" data-testid="input-feedback-website" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
            {submit.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive" role="alert" data-testid="status-feedback-error">
                <AlertTriangle className="h-4 w-4" /> {t('The note could not be sent.')}
                <button type="button" onClick={() => send()} className="font-semibold underline" data-testid="button-feedback-retry">{t('Retry')}</button>
              </div>
            )}
            <button type="submit" disabled={!valid || submit.isPending} data-testid="button-feedback-submit" className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submit.isPending ? t('Sending') : t('Send privately')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
