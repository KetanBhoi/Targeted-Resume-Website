import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  FileText,
  Github,
  Linkedin,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAskAmbassador, useHealthCheck } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { portfolio, type PortfolioSection } from '@/data/portfolio';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import WorkspacePage from '@/pages/workspace';
import { createUserCacheInvalidator } from '@/lib/user-cache';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#18263f',
    colorForeground: '#18263f',
    colorMutedForeground: '#667085',
    colorDanger: '#b24b3c',
    colorBackground: '#fbf8f1',
    colorInput: '#f4efe4',
    colorInputForeground: '#18263f',
    colorNeutral: '#d4cdbd',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '2px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f1] rounded-none w-[440px] max-w-full overflow-hidden border border-[#d4cdbd] shadow-[8px_8px_0_#d8ec47]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#18263f] font-semibold',
    headerSubtitle: 'text-[#667085]',
    socialButtonsBlockButtonText: 'text-[#18263f]',
    formFieldLabel: 'text-[#18263f]',
    footerActionLink: 'text-[#18263f] underline',
    footerActionText: 'text-[#667085]',
    dividerText: 'text-[#667085]',
    identityPreviewEditButton: 'text-[#18263f]',
    formFieldSuccessText: 'text-[#4f7b48]',
    alertText: 'text-[#b24b3c]',
    logoBox: 'h-10',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d4cdbd] bg-[#f4efe4]',
    formButtonPrimary: 'bg-[#18263f] text-[#fbf8f1] hover:bg-[#273c60]',
    formFieldInput: 'border-[#d4cdbd] bg-[#f4efe4] text-[#18263f]',
    footerAction: 'border-[#d4cdbd]',
    dividerLine: 'bg-[#d4cdbd]',
    alert: 'border-[#b24b3c]',
    otpCodeFieldInput: 'border-[#d4cdbd] bg-[#f4efe4] text-[#18263f]',
    formFieldRow: 'text-[#18263f]',
    main: 'text-[#18263f]',
  },
};

const navItems: { label: string; href: string }[] = [
  { label: 'Role fit', href: '#role-fit' },
  { label: 'Experience', href: '#experience' },
  { label: 'Skills', href: '#skills' },
  { label: 'Education', href: '#education' },
];

const starterQuestions = [
  { label: 'Role fit', question: 'Why is Ketan a fit for recruiting or talent acquisition?' },
  { label: 'Project proof', question: 'What did Ketan contribute to the MetroMart project?' },
  { label: 'Measurable impact', question: 'What measurable impact or metrics does the resume provide?' },
  { label: 'Leadership', question: 'What evidence of leadership is listed?' },
];

function SectionLabel({ children, index, inverse = false }: { children: ReactNode; index: string; inverse?: boolean }) {
  return (
    <div className={`mb-8 flex items-center gap-3 font-mono-custom text-[10px] uppercase tracking-[0.18em] ${inverse ? 'section-label-inverse' : 'text-muted-foreground'}`}>
      <span className="section-index flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{index}</span>
      <span>{children}</span>
      <span className={`section-rule h-px flex-1 ${inverse ? '' : 'bg-border'}`} />
    </div>
  );
}

function AnchorButton({ href, children, muted = false }: { href: string; children: ReactNode; muted?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-bold transition-colors ${
        muted
          ? 'border-border bg-card/60 text-foreground hover:border-primary hover:bg-secondary'
          : 'border-primary bg-primary text-primary-foreground hover:bg-foreground'
      }`}
      data-testid={`link-anchor-${href.replace('#', '')}`}
    >
      {children}
    </a>
  );
}

function Header({ onDownload }: { onDownload: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-5 py-3.5 lg:px-10 lg:py-4">
        <a href="#about" className="group flex items-center gap-3" data-testid="link-home">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary font-display text-lg text-primary-foreground transition-transform group-hover:rotate-[-8deg]">
            K
          </span>
          <span className="hidden font-mono-custom text-[11px] uppercase tracking-[0.14em] text-foreground sm:inline">Ketan Bhoi</span>
        </a>
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="nav-link px-3 py-2 font-mono-custom text-[10px] uppercase tracking-[0.13em] text-muted-foreground"
              data-testid={`link-nav-${item.href.slice(1)}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 border border-primary bg-accent px-3 py-2 font-mono-custom text-[10px] uppercase tracking-[0.1em] text-accent-foreground transition-transform hover:-translate-y-0.5"
          data-testid="button-download-resume"
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Download resume</span>
          <span className="sm:hidden">Resume</span>
        </button>
      </div>
    </header>
  );
}

function Hero({ onDownload }: { onDownload: () => void }) {
  return (
    <section id="about" className="relative border-b border-border paper-grid">
      <div className="mx-auto grid max-w-[1380px] gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.18fr_.82fr] lg:gap-20 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="reveal">
          <div className="mb-8 inline-flex items-center gap-2 border border-border bg-card/70 px-3 py-2 font-mono-custom text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="size-2 rounded-full bg-accent ring-2 ring-accent/30" />
            Visual resume · recruiter-facing
          </div>
          <h1 className="max-w-4xl font-display text-[clamp(3.3rem,8.4vw,8.1rem)] leading-[.84] tracking-[-0.055em] text-primary">
            A careful eye<br />
            <span className="text-muted-foreground">for people</span>
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground lg:text-xl">
            {portfolio.positioning}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <AnchorButton href="#role-fit">
              See the evidence <ArrowDown className="size-4" aria-hidden="true" />
            </AnchorButton>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 border border-border bg-card/60 px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:bg-secondary"
              data-testid="button-download-resume-hero"
            >
              <FileText className="size-4" aria-hidden="true" /> Download sanitized resume
            </button>
          </div>
        </div>
        <div className="reveal reveal-delay-2 flex flex-col justify-end">
          <div className="relative overflow-hidden border border-primary bg-primary p-6 text-primary-foreground shadow-[10px_10px_0_hsl(var(--accent))] sm:p-8">
            <div className="absolute right-5 top-5 font-mono-custom text-[10px] uppercase tracking-[0.18em] text-primary-foreground/55">01 / intent</div>
            <div className="mb-14 mt-10 max-w-sm">
              <p className="font-mono-custom text-[10px] uppercase tracking-[0.17em] text-accent">Target role</p>
              <p className="mt-3 font-display text-4xl leading-none sm:text-5xl" data-testid="text-target-role">{portfolio.targetRole}</p>
            </div>
            <div className="border-t border-primary-foreground/20 pt-4">
              <p className="max-w-sm text-sm leading-6 text-primary-foreground/85">{portfolio.context}</p>
            </div>
          </div>
          <div className="mt-8 flex items-start gap-3 border-l-2 border-accent pl-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              Built for a fast, fair review: every claim below points back to a named project, role, skill, or credential.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleFit() {
  return (
    <section id="role-fit" className="anchor-target mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
      <SectionLabel index="01">Transferable strengths</SectionLabel>
      <div className="grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
        <div>
          <h2 className="max-w-md font-display text-5xl leading-[.93] tracking-[-0.04em] sm:text-6xl">
            Proof before<br /><span className="text-muted-foreground">promises.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
            The resume does not list direct recruiting experience. It does show patterns that can transfer into recruiting work.
          </p>
        </div>
        <div className="grid gap-3">
          {portfolio.strengths.map((strength, index) => (
            <article key={strength.title} className="proof-card group grid gap-4 border border-border bg-card p-5 sm:grid-cols-[48px_1fr_auto] sm:items-start sm:gap-5 sm:p-6" data-testid={`card-strength-${index}`}>
              <span className="font-mono-custom text-xs text-muted-foreground">0{index + 1}</span>
              <div>
                <h3 className="font-display text-3xl leading-none">{strength.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{strength.detail}</p>
              </div>
              <div className="flex items-center gap-2 text-left font-mono-custom text-[10px] uppercase tracking-[0.1em] text-primary sm:max-w-[145px] sm:justify-end sm:text-right">
                <Check className="size-3.5 text-accent-foreground" aria-hidden="true" />
                {strength.proof}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Experience() {
  return (
    <section id="experience" className="anchor-target border-y border-border bg-secondary/55">
      <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
        <SectionLabel index="02">Experience + work sample</SectionLabel>
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-24">
          <div>
            <h2 className="font-display text-5xl leading-[.93] tracking-[-0.04em] sm:text-6xl">Work that shows how he thinks.</h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
              Software development is the documented experience. The useful signal for a recruiter is how Ketan approached structure, ownership, and follow-through.
            </p>
          </div>
          <div className="space-y-10">
            {portfolio.experiences.map((experience, index) => (
              <article key={`${experience.company}-${experience.title}`} className="relative border-l-2 border-primary pl-5 sm:pl-8" data-testid={`card-experience-${index}`}>
                <span className="absolute -left-[5px] top-1 size-[9px] rounded-full bg-accent ring-4 ring-secondary" />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-3xl">{experience.title}</h3>
                  <span className="font-mono-custom text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{experience.dates}</span>
                </div>
                <p className="mt-1 font-mono-custom text-xs uppercase tracking-[0.1em] text-primary">{experience.company}</p>
                <ul className="mt-5 space-y-3">
                  {experience.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                      <ChevronRight className="mt-1 size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            <article id="projects" className="anchor-target border border-primary bg-primary p-6 text-primary-foreground sm:p-8" data-testid="card-project-metromart">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-accent">Work sample / project</p>
                  <h3 className="mt-2 font-display text-4xl">{portfolio.projects[0].name}</h3>
                </div>
                <span className="border border-primary-foreground/30 px-2 py-1 font-mono-custom text-[10px] uppercase tracking-[0.1em] text-primary-foreground/70">{portfolio.projects[0].kind}</span>
              </div>
              <div className="mt-5 border-t border-primary-foreground/20 pt-4">
                <p className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-accent">Project scope, as documented</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/75">{portfolio.projects[0].problem}</p>
              </div>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-primary-foreground/85">{portfolio.projects[0].contribution}</p>
              <div className="mt-6 border-t border-primary-foreground/20 pt-5">
                <p className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-accent">Outcome, stated plainly</p>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/85">{portfolio.projects[0].outcome}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {portfolio.projects[0].tools.map((tool) => (
                  <span key={tool} className="border border-primary-foreground/20 px-2.5 py-1.5 font-mono-custom text-[10px] text-primary-foreground/75" data-testid={`tag-tool-${tool.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{tool}</span>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function Skills() {
  return (
    <section id="skills" className="anchor-target mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
      <SectionLabel index="03">Skills, without the fog</SectionLabel>
      <div className="grid gap-10 lg:grid-cols-[.55fr_1.45fr]">
        <div>
          <h2 className="font-display text-5xl leading-[.93] tracking-[-0.04em]">What he can bring on day one.</h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {portfolio.softSkills.map((skill) => (
              <span key={skill} className="border border-border bg-secondary px-3 py-2 text-xs font-semibold" data-testid={`tag-soft-skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{skill}</span>
            ))}
          </div>
        </div>
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {portfolio.skills.map((group, index) => (
            <article key={group.group} className={`bg-card p-5 sm:p-6 ${index === 0 ? 'sm:col-span-2' : ''}`} data-testid={`card-skills-${index}`}>
              <p className="font-mono-custom text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{group.group}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
                {group.items.map((item) => (
                  <span key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Education() {
  return (
    <section id="education" className="anchor-target border-y border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
        <SectionLabel index="04" inverse>Education + certificates</SectionLabel>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            {portfolio.education.map((item, index) => (
              <article key={item.credential} className="border-b border-primary-foreground/20 pb-7 last:border-0" data-testid={`card-education-${index}`}>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-mono-custom text-[10px] uppercase tracking-[0.14em] text-accent">0{index + 1}</p>
                  <p className="font-mono-custom text-[10px] uppercase tracking-[0.1em] text-primary-foreground/55">{item.completed}</p>
                </div>
                <h3 className="mt-4 max-w-lg font-display text-3xl leading-tight">{item.credential}</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-primary-foreground/80">{item.institution}</p>
                {item.result && <p className="mt-3 font-mono-custom text-xs text-accent">{item.result}</p>}
              </article>
            ))}
          </div>
          <div className="border border-primary-foreground/20 p-6 sm:p-8">
            <p className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-accent">Certificates</p>
            <ul className="mt-6 space-y-4">
              {portfolio.certificates.map((certificate) => (
                <li key={certificate} className="flex gap-3 text-sm leading-6 text-primary-foreground/85" data-testid={`text-certificate-${certificate.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden="true" /> {certificate}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ambassador() {
  const health = useHealthCheck();
  const ask = useAskAmbassador();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; section?: PortfolioSection | null }[]>([]);

  const submitQuestion = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setQuestion('');
    ask.mutate(
      { data: { question: trimmed } },
      {
        onSuccess: (answer) => {
          setMessages((current) => [...current, { role: 'assistant', text: answer.answer, section: answer.section }]);
        },
        onError: () => {
          setMessages((current) => [...current, { role: 'assistant', text: 'The ambassador is unavailable right now. Please use the evidence on this page instead.' }]);
        },
      },
    );
  };

  const jumpToSection = (section?: PortfolioSection | null) => {
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="ambassador" className="anchor-target mx-auto max-w-[1380px] px-5 py-16 lg:px-10 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
        <div>
          <SectionLabel index="05">Ask the ambassador</SectionLabel>
          <h2 className="font-display text-5xl leading-[.93] tracking-[-0.04em] sm:text-6xl">A direct answer beats a perfect pitch.</h2>
          <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
            Ask about role fit, the MetroMart work sample, metrics, leadership, or anything else in the documented resume.
          </p>
          <div className="mt-6 flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[0.1em] text-muted-foreground" data-testid="status-ambassador">
            <span className={`size-2 rounded-full ${health.isLoading ? 'bg-muted-foreground' : health.isError ? 'bg-destructive' : 'bg-accent'}`} />
            {health.isLoading ? 'Checking availability' : health.isError ? 'Currently unavailable' : `Assistant ${health.data?.status ?? 'status unknown'}`}
          </div>
        </div>
        <div className="border border-border bg-card shadow-[8px_8px_0_hsl(var(--secondary))]" data-testid="panel-ambassador">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4" aria-hidden="true" />
              <span className="font-mono-custom text-[10px] uppercase tracking-[0.13em]">Resume Q&A</span>
            </div>
            <span className="font-mono-custom text-[10px] text-muted-foreground">Not saved</span>
          </div>
          <div className="chat-scroll max-h-[360px] min-h-[210px] space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 && (
              <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <Sparkles className="mt-1 size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
                <p>Choose a question to get a grounded answer from the resume facts.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message flex gap-3 text-sm leading-6 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                <div className={`max-w-[82%] ${message.role === 'user' ? 'bg-secondary px-3 py-2 text-foreground' : 'text-muted-foreground'}`}>
                  <p>{message.text}</p>
                  {message.role === 'assistant' && message.section && (
                    <button type="button" onClick={() => jumpToSection(message.section)} className="mt-3 inline-flex items-center gap-1 border-b border-primary font-mono-custom text-[10px] uppercase tracking-[0.08em] text-primary" data-testid={`button-jump-${message.section}`}>
                      View supporting section <ArrowUpRight className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="status-ambassador-loading">
                <span className="flex gap-1"><span className="size-1.5 animate-pulse rounded-full bg-accent" /><span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" /><span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" /></span>
                Checking the documented facts…
              </div>
            )}
          </div>
          <div className="border-t border-border p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {starterQuestions.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() => { setQuestion(starter.question); }}
                  className="border border-border px-2.5 py-1.5 text-left font-mono-custom text-[10px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  data-testid={`button-starter-${starter.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                >
                  {starter.label}
                </button>
              ))}
            </div>
            <form onSubmit={submitQuestion} className="flex gap-2">
              <label htmlFor="ambassador-question" className="sr-only">Ask the resume ambassador</label>
              <input
                id="ambassador-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={600}
                placeholder="Ask a recruiter-minded question…"
                className="min-w-0 flex-1 border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                data-testid="input-ambassador-question"
              />
              <button type="submit" disabled={!question.trim() || ask.isPending} className="inline-flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-submit-question" aria-label="Send question">
                <Send className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactStatus() {
  const hasLinks = Boolean(portfolio.publicLinks.linkedin || portfolio.publicLinks.github || portfolio.publicLinks.additional.length || portfolio.publicContact);
  return (
    <section className="border-t border-border bg-secondary/55">
      <div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex gap-4">
          {hasLinks ? <ExternalLink className="mt-1 size-4" aria-hidden="true" /> : <CircleAlert className="mt-1 size-4 text-accent-foreground" aria-hidden="true" />}
          <div>
            <p className="font-mono-custom text-[10px] uppercase tracking-[0.15em]">{hasLinks ? 'Public links' : 'Publishing note'}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground" data-testid="text-contact-status">
              {hasLinks ? 'Public contact and profile links are available below.' : 'Public contact and profile links are not supplied yet. Add them before publishing this portfolio.'}
            </p>
          </div>
        </div>
        {hasLinks && (
          <div className="flex flex-wrap gap-3">
            {portfolio.publicLinks.linkedin && <a href={portfolio.publicLinks.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm font-bold" data-testid="link-linkedin"><Linkedin className="size-4" /> LinkedIn</a>}
            {portfolio.publicLinks.github && <a href={portfolio.publicLinks.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm font-bold" data-testid="link-github"><Github className="size-4" /> GitHub</a>}
            {portfolio.publicContact && <a href={portfolio.publicContact.url} className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm font-bold" data-testid="link-email"><Mail className="size-4" /> {portfolio.publicContact.label}</a>}
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1380px] flex-col gap-2 px-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
      <p className="font-display text-2xl">{portfolio.name}</p>
      <p className="font-mono-custom text-[10px] uppercase tracking-[0.12em] text-muted-foreground">A resume, made easier to verify.</p>
    </footer>
  );
}

function downloadResume() {
  const resumeRows = [
    { text: portfolio.positioning, size: 10, leading: 15 },
    { text: '', size: 10, leading: 6 },
    { text: 'ROLE CONTEXT', size: 11, leading: 19 },
    { text: portfolio.context, size: 9, leading: 14 },
    { text: '', size: 10, leading: 6 },
    { text: 'TRANSFERABLE STRENGTHS', size: 11, leading: 19 },
    ...portfolio.strengths.flatMap((strength) => [
      { text: `${strength.title}: ${strength.detail}`, size: 9, leading: 14 },
      { text: `Evidence: ${strength.proof}`, size: 8, leading: 12 },
    ]),
    { text: '', size: 10, leading: 6 },
    { text: 'EXPERIENCE', size: 11, leading: 19 },
    ...portfolio.experiences.flatMap((experience) => [
      { text: `${experience.title} - ${experience.company} | ${experience.dates}`, size: 10, leading: 15 },
      ...experience.bullets.map((bullet) => ({ text: `- ${bullet}`, size: 9, leading: 14 })),
      { text: '', size: 10, leading: 6 },
    ]),
    { text: 'METROMART WORK SAMPLE', size: 11, leading: 19 },
    { text: `${portfolio.projects[0].name} - ${portfolio.projects[0].kind}`, size: 10, leading: 15 },
    { text: `Project scope: ${portfolio.projects[0].problem}`, size: 9, leading: 14 },
    { text: portfolio.projects[0].contribution, size: 9, leading: 14 },
    { text: portfolio.projects[0].outcome, size: 9, leading: 14 },
    { text: `Tools: ${portfolio.projects[0].tools.join(', ')}`, size: 8, leading: 12 },
    { text: '', size: 10, leading: 6 },
    { text: 'SKILLS', size: 11, leading: 19 },
    ...portfolio.skills.map((group) => ({
      text: `${group.group}: ${group.items.join(', ')}`,
      size: 9,
      leading: 14,
    })),
    { text: `Soft skills: ${portfolio.softSkills.join(', ')}`, size: 9, leading: 14 },
    { text: '', size: 10, leading: 6 },
    { text: 'EDUCATION', size: 11, leading: 19 },
    ...portfolio.education.map((item) => ({
      text: `${item.credential} - ${item.institution} | ${item.completed}${item.result ? ` | ${item.result}` : ''}`,
      size: 9,
      leading: 14,
    })),
    { text: '', size: 10, leading: 6 },
    { text: 'CERTIFICATES', size: 11, leading: 19 },
    ...portfolio.certificates.map((certificate) => ({
      text: `- ${certificate}`,
      size: 9,
      leading: 14,
    })),
    { text: '', size: 10, leading: 6 },
    { text: 'Public contact and profile links: not supplied yet.', size: 8, leading: 12 },
  ];
  const ascii = (text: string) =>
    text
      .replace(/[—–]/g, '-')
      .replace(/·/g, '|')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7e]/g, '');
  const escapePdf = (text: string) =>
    ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrappedRows = resumeRows.flatMap((row) => {
    if (!row.text) return [row];
    const words = ascii(row.text).split(/\s+/);
    const maxChars = Math.floor(510 / (row.size * 0.5));
    const wrapped: typeof resumeRows = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        wrapped.push({ ...row, text: current });
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) wrapped.push({ ...row, text: current });
    return wrapped;
  });
  const rowsPerPage = 45;
  const pages = Array.from(
    { length: Math.ceil(wrappedRows.length / rowsPerPage) },
    (_, index) => wrappedRows.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
  );
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((pageRows, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    let stream = `BT\n/F1 17 Tf\n54 748 Td\n(${escapePdf(portfolio.name)}) Tj\n/F1 10 Tf\n0 -22 Td\n(${escapePdf(portfolio.targetRole)}) Tj\n0 -24 Td\n`;
    for (const row of pageRows) {
      stream += `/F1 ${row.size} Tf\n(${escapePdf(row.text)}) Tj\n0 -${row.leading} Td\n`;
    }
    stream += 'ET';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ketan-bhoi-resume.pdf';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Home() {
  return (
    <div className="site-shell min-h-[100dvh] bg-background">
      <Header onDownload={downloadResume} />
      <main>
        <Hero onDownload={downloadResume} />
        <RoleFit />
        <Experience />
        <Skills />
        <Education />
        <Ambassador />
        <ContactStatus />
      </main>
      <Footer />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading" aria-label="Loading account" />;
  return isSignedIn ? <Redirect to="/workspace" /> : <Home />;
}

function ProtectedWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading" aria-label="Loading workspace" />;
  return isSignedIn ? <WorkspacePage /> : <Redirect to="/" />;
}

function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-page-kicker"><span className="workspace-brand-mark">K</span><span>Private career workbench</span></div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-page-kicker"><span className="workspace-brand-mark">K</span><span>Private career workbench</span></div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const invalidateWhenUserChanges = useMemo(
    () => createUserCacheInvalidator(() => queryClient.clear()),
    [queryClient],
  );

  useEffect(() => {
    return addListener(({ user }) => invalidateWhenUserChanges(user?.id ?? null));
  }, [addListener, invalidateWhenUserChanges]);

  return null;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/workspace" component={ProtectedWorkspace} />
        <Route path="/workspace/jobs" component={ProtectedWorkspace} />
        <Route path="/workspace/match" component={ProtectedWorkspace} />
        <Route path="/workspace/prepare" component={ProtectedWorkspace} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Return to your private workbench' } },
        signUp: { start: { title: 'Make space for better work', subtitle: 'Create your private career workbench' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;