import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { featuredPromptProjects, promptProjectCreation, promptProjectEvidence, promptProjects } from '@/data/prompt-projects';
import { usePortfolioLanguage } from '@/lib/portfolio-language';

const categoryContext: Record<string, string> = {
  'Web app': 'Interactive browser-based product or utility',
  'Interactive prototype': 'Clickable interaction and experience prototype',
  'Design and animation': 'Visual design, illustration, or motion study',
  'Presentation and guide': 'Presentation or practical reference guide',
  'Portfolio website': 'Public career portfolio and private workspace',
};

function ProjectCard({ project, featured = false }: { project: (typeof promptProjects)[number]; featured?: boolean }) {
  const { t } = usePortfolioLanguage();
  return (
    <article
      className={`min-w-0 border p-5 sm:p-6 ${featured ? 'border-primary bg-card shadow-[6px_6px_0_hsl(var(--accent))]' : 'border-border bg-card/70'}`}
      data-testid={`card-prompt-project-${project.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {featured && <p className="mb-3 font-mono-custom text-[9px] uppercase tracking-[0.16em] text-accent-foreground">{t('Featured project')}</p>}
          <h3 className="break-words font-display text-2xl leading-tight sm:text-3xl">{project.name}</h3>
        </div>
        <span className="max-w-full border border-border px-2 py-1 font-mono-custom text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{t(project.category)}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(project.description)}</p>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        <span className="font-semibold text-foreground">{t(categoryContext[project.category])}</span>
        <span aria-hidden="true"> · </span>
        <span>{t('Platform / host')}: {project.platform}</span>
        {project.id === 'quickdraw' && <span className="block pt-1">{t('Netlify is hosting; the creation tool was not specified.')}</span>}
      </p>
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex max-w-full items-center gap-2 border-b border-primary pb-1 text-sm font-bold text-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        data-testid={`link-prompt-project-${project.id}`}
        aria-label={`${t('Open project')}: ${project.name} (${project.platform})`}
      >
        <span className="break-all">{t('Open project')}</span>
        <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t('opens in a new tab')}</span>
      </a>
    </article>
  );
}

export default function PromptProjectShowcase() {
  const { t } = usePortfolioLanguage();
  return (
    <section id="projects" className="anchor-target border-y border-border bg-secondary/55" aria-labelledby="prompt-projects-heading" data-testid="section-prompt-project-showcase">
      <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
        <div className="mb-12 grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-4 font-mono-custom text-[10px] uppercase tracking-[0.17em] text-muted-foreground">{t('Prompt-created work · 11 projects')}</p>
            <h2 id="prompt-projects-heading" className="max-w-2xl font-display text-5xl leading-[.93] tracking-[-0.04em] sm:text-6xl">{t('A wider proof of prompt direction.')}</h2>
          </div>
          <div className="border-l-2 border-accent pl-4">
            <p className="text-sm leading-6">{t(promptProjectCreation)}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(promptProjectEvidence)}</p>
          </div>
        </div>
        <div className="mb-14">
          <div className="mb-5 flex items-center gap-3">
            <h3 className="font-mono-custom text-[10px] uppercase tracking-[0.16em]">{t('Featured projects')}</h3>
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono-custom text-[10px] text-muted-foreground">05 / 11</span>
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredPromptProjects.map((project) => <ProjectCard key={project.id} project={project} featured />)}
          </div>
        </div>
        <div>
          <div className="mb-5 flex items-center gap-3">
            <h3 className="font-mono-custom text-[10px] uppercase tracking-[0.16em]">{t('Full project catalogue')}</h3>
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono-custom text-[10px] text-muted-foreground">11 / 11</span>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promptProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
          <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{t('Links are owner-supplied; some destinations may require account access. SmartHire AI is a pitch deck, not a working hiring product.')}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
