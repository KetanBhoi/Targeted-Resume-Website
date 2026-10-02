import { getListPublicCaseStudiesQueryKey, useListPublicCaseStudies } from '@workspace/api-client-react';
import '@/styles/application-sharing.css';
import { usePortfolioLanguage } from '@/lib/portfolio-language';

const FIELDS = [
  ['jobDescription', 'Job description'],
  ['outreach', 'Outreach draft'],
  ['reasoning', 'Reasoning'],
  ['lessons', 'Lessons'],
] as const;

export default function PublicCaseStudies() {
  const { t } = usePortfolioLanguage();
  const q = useListPublicCaseStudies({ query: { queryKey: getListPublicCaseStudiesQueryKey(), retry: 1 } });
  if (q.isLoading) return <section className="as-public" data-testid="status-case-studies-loading"><div className="workspace-skeleton"><div className="workspace-skeleton-line workspace-skeleton-wide" /><div className="workspace-skeleton-card" /></div></section>;
  if (q.isError) return (
    <section className="as-public"><div className="workspace-error" role="alert" data-testid="status-case-studies-error">
      <div><h2>{t('Practice cases did not load')}</h2><p>{t('Please try again.')}</p></div>
      <button type="button" className="workspace-button workspace-button-dark" onClick={() => q.refetch()} data-testid="button-retry-case-studies">{t('Retry')}</button>
    </div></section>
  );
  const items = q.data ?? [];
  if (items.length === 0) return null;
  return (
    <section id="practice-cases" className="as-public anchor-target" aria-labelledby="practice-cases-title" data-testid="section-case-studies">
      <p className="as-label">{t('Fictional recruiting practice—not professional experience')}</p>
      <h2 id="practice-cases-title" className="font-display text-5xl leading-[.93] tracking-[-0.04em] sm:text-6xl" style={{ margin: '16px 0 28px' }}>{t('Practice cases')}</h2>
      <p className="as-note">{t('Shown in the original language supplied by the owner.')}</p>
      <div className="as-stack">
        {items.map((c) => (
          <article key={c.id} className="as-public-card" data-testid={`card-case-study-${c.id}`}>
            <span className="as-label">{t(c.label)}</span>
            <h3>{c.title}</h3>
            <p>{c.summary}</p>
            {FIELDS.map(([k, label]) => c[k] ? (
              <details key={k}><summary><h4 style={{ display: 'inline' }}>{t(label)}</h4></summary><p style={{ marginTop: 8 }}>{c[k]}</p></details>
            ) : null)}
          </article>
        ))}
      </div>
    </section>
  );
}
