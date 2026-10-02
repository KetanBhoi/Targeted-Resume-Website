import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Layers3,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import {
  exportWorkspaceData,
  getExportWorkspaceDataQueryKey,
  getListWorkspaceRecordsQueryKey,
  useCreateWorkspaceRecord,
  useDeleteAllWorkspaceRecords,
  useDeleteWorkspaceRecord,
  useGenerateWorkspaceContent,
  useListWorkspaceRecords,
  useUpdateWorkspaceRecord,
  type WorkspaceRecord,
  type WorkspaceRecordKind,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetPortfolioOwnerAccess } from '@workspace/api-client-react';
import InterviewStudio from '@/pages/interview-studio';
import PortfolioInsights from '@/pages/portfolio-insights';
import { Link, useLocation } from 'wouter';
import {
  buildKeywordPreview,
  canonicalJobDescription,
  diffResumeText,
  highlightKeywordText,
  missingBatchJobIds,
  readInterviewQuestions,
  readKeywordHeatmap,
} from '@/lib/workspace-features';

type WorkspaceView = 'overview' | 'jobs' | 'match' | 'prepare' | 'studio' | 'insights';
type Meta = Record<string, unknown>;
type RecordKind = WorkspaceRecordKind;

const viewCopy: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
  studio: { eyebrow: 'Interview studio', title: 'Practice with a clear timer.', description: 'Local drafts and optional audio, with no uploads.' },
  insights: { eyebrow: 'Owner insights', title: 'See what recruiters noticed.', description: 'Private feedback and portfolio analytics.' },
  overview: {
    eyebrow: 'Private career workbench',
    title: 'Keep the signal close.',
    description: 'A focused place for the versions, decisions, and preparation behind each thoughtful application.',
  },
  jobs: {
    eyebrow: 'Applications',
    title: 'Know where every application stands.',
    description: 'Track the next move without turning the search into a spreadsheet.',
  },
  match: {
    eyebrow: 'Role intelligence',
    title: 'Tune the story to the role.',
    description: 'Compare a job description to a resume version, then close the gaps that matter.',
  },
  prepare: {
    eyebrow: 'Preparation desk',
    title: 'Walk in with something to say.',
    description: 'Turn the documented experience into clear answers, letters, and thoughtful follow-ups.',
  },
};

const navItems: { label: string; hint: string; href: string; view: WorkspaceView; icon: typeof FileText }[] = [
  { label: 'Workbench', hint: 'Versions + history', href: '/workspace', view: 'overview', icon: FileText },
  { label: 'Applications', hint: 'Roles + reminders', href: '/workspace/jobs', view: 'jobs', icon: BriefcaseBusiness },
  { label: 'Role match', hint: 'ATS + skill gaps', href: '/workspace/match', view: 'match', icon: BarChart3 },
  { label: 'Prepare', hint: 'Answers + writing', href: '/workspace/prepare', view: 'prepare', icon: Sparkles },
  { label: 'Interview studio', hint: 'Timed + local practice', href: '/workspace/studio', view: 'studio', icon: MessageCircle },
  { label: 'Portfolio insights', hint: 'Owner-only feedback', href: '/workspace/insights', view: 'insights', icon: BarChart3 },
];

function getView(path: string): WorkspaceView {
  if (path.includes('/studio')) return 'studio';
  if (path.includes('/insights')) return 'insights';
  if (path.includes('/jobs')) return 'jobs';
  if (path.includes('/match')) return 'match';
  if (path.includes('/prepare')) return 'prepare';
  return 'overview';
}

function readString(meta: Meta | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === 'string' ? value : '';
}

function readStringList(meta: Meta, key: string): string[] {
  const value = meta[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readNumber(meta: Meta, key: string): number | null {
  const value = meta[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readId(meta: Meta | undefined, key: string): number | null {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readJobDescription(record: WorkspaceRecord | undefined): string {
  return record ? canonicalJobDescription(record.content, record.metadata) : '';
}

function readJobNotes(record: WorkspaceRecord | undefined): string {
  if (!record) return '';
  const savedNotes = readString(record.metadata, 'notes') || readStringList(record.metadata, 'notes').join('\n');
  if (savedNotes) return savedNotes;
  const metadataDescription = readString(record.metadata, 'jobDescription') || readString(record.metadata, 'description');
  return metadataDescription && record.content.trim() !== metadataDescription.trim() ? record.content : '';
}

function needsFactReview(record: WorkspaceRecord | undefined): boolean {
  return readString(record?.metadata, 'verificationStatus') === 'needs-review';
}

function readResumeChanges(meta: Meta | undefined): { before: string; after: string; why: string }[] {
  if (!Array.isArray(meta?.changes)) return [];
  return meta.changes.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const change = item as Record<string, unknown>;
    if (typeof change.before !== 'string' || typeof change.after !== 'string' || typeof change.why !== 'string') return [];
    return [{ before: change.before, after: change.after, why: change.why }];
  });
}

function readRoadmap(meta: Meta): { skill: string; requirement: string; priority: string; action: string }[] {
  if (!Array.isArray(meta.roadmap)) return [];
  return meta.roadmap.flatMap((item): { skill: string; requirement: string; priority: string; action: string }[] => {
    if (typeof item === 'string' && item.trim()) {
      return [{ skill: item.trim(), requirement: '', priority: 'medium', action: 'Build or document a small, verifiable example before adding this skill to a resume.' }];
    }
    if (typeof item !== 'object' || item === null) return [];
    const step = item as Record<string, unknown>;
    const skill = [step.skill, step.name, step.title].find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    if (!skill) return [];
    const action = [step.firstStep, step.action, step.nextStep, step.plan, step.steps, step.recommendation]
      .find((value) => typeof value === 'string' && value.trim());
    return [{
      skill,
      requirement: typeof step.requirement === 'string' ? step.requirement : '',
      priority: typeof step.priority === 'string' ? step.priority : 'medium',
      action: typeof action === 'string' ? action : 'Choose one practice task and record evidence of your progress.',
    }];
  });
}

function CopyAction({ text }: { text: string }) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
    } catch {
      setStatus('Clipboard unavailable — select and copy the text directly.');
    }
  };
  return <div className="workspace-copy-action"><button type="button" className="workspace-text-button" onClick={() => void copy()} disabled={!text}><Copy size={13} /> Copy draft</button>{status && <span role="status">{status}</span>}</div>;
}

function formatDate(value: string | undefined) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'No date';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

function useWorkspaceRecords() {
  const queryClient = useQueryClient();
  const recordsQuery = useListWorkspaceRecords();
  const createRecord = useCreateWorkspaceRecord();
  const updateRecord = useUpdateWorkspaceRecord();
  const deleteRecord = useDeleteWorkspaceRecord();
  const generateContent = useGenerateWorkspaceContent();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() });
  return { recordsQuery, createRecord, updateRecord, deleteRecord, generateContent, refresh };
}

function PageSkeleton() {
  return (
    <div className="workspace-skeleton" aria-label="Loading workspace">
      <div className="workspace-skeleton-line workspace-skeleton-wide" />
      <div className="workspace-skeleton-line workspace-skeleton-mid" />
      <div className="workspace-skeleton-grid">
        <div className="workspace-skeleton-card" />
        <div className="workspace-skeleton-card" />
        <div className="workspace-skeleton-card" />
      </div>
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="workspace-empty">
      <div className="workspace-empty-mark"><Layers3 size={19} /></div>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`workspace-status workspace-status-${normalized}`}>{status || 'Draft'}</span>;
}

function ResumeChangeList({ changes }: { changes: { before: string; after: string; why: string }[] }) {
  return <div className="workspace-change-list">{changes.map((change, index) => <article key={`${change.before}-${index}`}><div className="workspace-change-before"><strong>Before</strong><p>{change.before}</p></div><div className="workspace-change-after"><strong>After</strong><p>{change.after}</p></div><p className="workspace-change-why"><strong>Why</strong>{change.why}</p></article>)}</div>;
}

function KeywordHeatmap({ items }: { items: ReturnType<typeof readKeywordHeatmap> }) {
  if (items.length === 0) return null;
  return (
    <section className="workspace-heatmap" aria-label="Job keyword coverage">
      <div className="workspace-heatmap-head"><strong>Keyword coverage</strong><span>Resume evidence vs. role language</span></div>
      <div className="workspace-heatmap-legend">
        <span className="workspace-heatmap-strong">Strong match</span>
        <span className="workspace-heatmap-partial">Partial match</span>
        <span className="workspace-heatmap-missing">Missing</span>
      </div>
      <div className="workspace-heatmap-items">
        {items.map((item) => (
          <span key={item.term} className={`workspace-heatmap-item workspace-heatmap-item-${item.status}`} title={`${item.resumeCount} resume mention${item.resumeCount === 1 ? '' : 's'} · ${item.jobCount} job mention${item.jobCount === 1 ? '' : 's'}`}>
            {item.term}<small>{item.resumeCount}/{item.jobCount}</small>
          </span>
        ))}
      </div>
      <p className="workspace-heatmap-note">Coverage is a text comparison, not a claim about skill level. Add missing evidence only when it reflects your experience.</p>
    </section>
  );
}

function WorkspaceSidebar({ view, onClose }: { view: WorkspaceView; onClose: () => void }) {
  const owner = useGetPortfolioOwnerAccess();
  const { user } = useUser();
  const { signOut } = useClerk();
  const initials = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? 'K').toUpperCase();
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-brand">
        <Link href="/workspace" className="workspace-brand-link" data-testid="link-workspace-home">
          <span className="workspace-brand-mark">K</span>
          <span>
            <strong>Ketan Bhoi</strong>
            <small>Career workbench</small>
          </span>
        </Link>
        <button className="workspace-mobile-close" type="button" onClick={onClose} data-testid="button-close-sidebar" aria-label="Close navigation">
          <X size={17} />
        </button>
      </div>

      <div className="workspace-sidebar-label">Workspace</div>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        {navItems.filter((item) => item.view !== 'insights' || owner.data?.isOwner).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.view}
              href={item.href}
              className={`workspace-nav-link ${view === item.view ? 'workspace-nav-link-active' : ''}`}
              data-testid={`link-workspace-${item.view}`}
              onClick={onClose}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              {view === item.view && <span className="workspace-nav-dot" />}
            </Link>
          );
        })}
      </nav>
      <Link href="/portfolio" className="workspace-nav-link" onClick={onClose} data-testid="link-public-portfolio"><ExternalLink size={17} /><span><strong>Public portfolio</strong><small>Preview recruiter views</small></span></Link>

      <div className="workspace-sidebar-rule" />
      <div className="workspace-sidebar-note">
        <ShieldCheck size={17} />
        <p>Your workspace is private to your account.</p>
      </div>
      <div className="workspace-user">
        <span className="workspace-avatar">{initials}</span>
        <span className="workspace-user-copy"><strong>{user?.firstName || 'Ketan'}</strong><small>{user?.primaryEmailAddress?.emailAddress || 'Signed in'}</small></span>
        <button type="button" className="workspace-icon-button" onClick={() => signOut({ redirectUrl: '/' })} data-testid="button-sign-out" aria-label="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}

function WorkspaceTopbar({ view, onMenu }: { view: WorkspaceView; onMenu: () => void }) {
  return (
    <header className="workspace-topbar">
      <button type="button" className="workspace-menu-button" onClick={onMenu} data-testid="button-open-sidebar" aria-label="Open navigation">
        <Menu size={19} />
      </button>
      <div className="workspace-breadcrumb"><span>Private space</span><ArrowRight size={13} /><strong>{viewCopy[view].eyebrow}</strong></div>
      <div className="workspace-topbar-actions">
        <span className="workspace-sync"><span className="workspace-sync-dot" /> Private sync</span>
      </div>
    </header>
  );
}

function WorkspaceHeader({ view, action }: { view: WorkspaceView; action?: ReactNode }) {
  const copy = viewCopy[view];
  return (
    <div className="workspace-page-header">
      <div>
        <div className="workspace-eyebrow"><span className="workspace-eyebrow-line" />{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      {action}
    </div>
  );
}

function RecordModal({ kind, record, onClose, onSaved }: { kind: 'resume' | 'job'; record?: WorkspaceRecord; onClose: () => void; onSaved: () => void }) {
  const { recordsQuery, createRecord, updateRecord } = useWorkspaceRecords();
  const [title, setTitle] = useState(record?.title ?? '');
  const [content, setContent] = useState(record?.content ?? '');
  const [jobDescription, setJobDescription] = useState(() => readJobDescription(record));
  const [jobNotes, setJobNotes] = useState(() => readJobNotes(record));
  const [company, setCompany] = useState(readString(record?.metadata, 'company'));
  const [status, setStatus] = useState(readString(record?.metadata, 'status') || (kind === 'job' ? 'Saved' : 'Draft'));
  const [changeReason, setChangeReason] = useState(readString(record?.metadata, 'changeReason'));
  const [deadline, setDeadline] = useState(readString(record?.metadata, 'reminderAt') || readString(record?.metadata, 'deadline'));
  const [appliedAt, setAppliedAt] = useState(readString(record?.metadata, 'appliedAt'));
  const [interviewDate, setInterviewDate] = useState(readString(record?.metadata, 'interviewDate'));
  const [url, setUrl] = useState(readString(record?.metadata, 'url'));
  const resumes = (recordsQuery.data ?? []).filter((item) => item.kind === 'resume');
  const [linkedResumeId, setLinkedResumeId] = useState(() => {
    const linkedId = readId(record?.metadata, 'resumeVersionId');
    const linkedResume = resumes.find((resume) => resume.id === linkedId);
    return linkedResume && !needsFactReview(linkedResume) ? String(linkedResume.id) : '';
  });
  const [error, setError] = useState('');
  const isPending = createRecord.isPending || updateRecord.isPending;
  const previouslyLinkedDraft = resumes.find((resume) => resume.id === readId(record?.metadata, 'resumeVersionId'));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const savedContent = kind === 'job' ? jobDescription.trim() : content;
    if (!title.trim() || !savedContent.trim()) {
      setError(kind === 'job' ? 'Add a title and the canonical job description before saving.' : 'Add a title and some resume text before saving.');
      return;
    }
    const linkedResume = resumes.find((resume) => resume.id === Number(linkedResumeId));
    if (kind === 'job' && needsFactReview(linkedResume)) {
      setError('Confirm the tailored resume’s factual review before linking it to an application.');
      return;
    }
    setError('');
    const metadata: Meta = {
      ...(record?.metadata ?? {}),
      ...(kind === 'job' ? {
        company: company.trim(),
        status,
        deadline,
        reminderAt: deadline,
        appliedAt,
        interviewDate,
        resumeVersionId: linkedResumeId ? Number(linkedResumeId) : null,
        url: url.trim(),
        notes: jobNotes.trim(),
      } : { status, changeReason: changeReason.trim() }),
    };
    if (kind === 'job') {
      delete metadata.jobDescription;
      delete metadata.description;
    }
    const onSuccess = () => { onSaved(); onClose(); };
    if (record && kind === 'resume' && content.trim() !== record.content) {
      createRecord.mutate({
        data: {
          kind: 'resume',
          title: title.trim(),
          content: savedContent,
          metadata: {
            ...metadata,
            changes: undefined,
            verificationStatus: readString(record.metadata, 'verificationStatus') ? 'needs-review' : undefined,
            factReviewConfirmedAt: undefined,
            parentVersionId: record.id,
            sourceVersionId: record.id,
            changeReason: changeReason.trim() || `Revision based on “${record.title}”.`,
          },
        },
      }, { onSuccess, onError: () => setError('Could not save this new resume version. Try again.') });
    } else if (record) {
      updateRecord.mutate({ id: record.id, data: { title: title.trim(), content: savedContent, metadata } }, { onSuccess, onError: () => setError('Could not save this change. Try again.') });
    } else {
      createRecord.mutate({ data: { kind, title: title.trim(), content: savedContent, metadata } }, { onSuccess, onError: () => setError('Could not save this record. Try again.') });
    }
  };

  return (
    <div className="workspace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
        <div className="workspace-modal-head">
          <div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />{record ? 'Edit record' : 'New record'}</span><h2 id="record-modal-title">{kind === 'resume' ? 'Resume version' : 'Application'}</h2></div>
          <button type="button" className="workspace-icon-button" onClick={onClose} data-testid="button-close-record-modal" aria-label="Close dialog"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="workspace-form">
          <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'resume' ? 'Recruiting resume · April 2025' : 'Role title · company'} data-testid="input-record-title" /></label>
          {kind === 'job' && <div className="workspace-form-grid">
            <label><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" data-testid="input-job-company" /></label>
            <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-job-status"><option>Saved</option><option>Applied</option><option>Interviewing</option><option>Offer</option><option>Closed</option></select></label>
            <label><span>Applied date</span><input type="date" value={appliedAt} onChange={(event) => setAppliedAt(event.target.value)} data-testid="input-job-applied-date" /></label>
            <label><span>Interview date</span><input type="date" value={interviewDate} onChange={(event) => setInterviewDate(event.target.value)} data-testid="input-job-interview-date" /></label>
            <label><span>Follow-up reminder</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} data-testid="input-job-deadline" /></label>
            <label><span>Job URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" data-testid="input-job-url" /></label>
            <label><span>Resume version</span><select value={linkedResumeId} onChange={(event) => setLinkedResumeId(event.target.value)} data-testid="select-job-resume"><option value="">Not linked</option>{resumes.map((resume) => <option key={resume.id} value={resume.id} disabled={needsFactReview(resume)}>{resume.title}{needsFactReview(resume) ? ' · Needs fact review' : ''}</option>)}</select>{needsFactReview(previouslyLinkedDraft) && <small className="workspace-field-note">The previously linked AI draft is unverified and has been cleared. Confirm its facts in the workbench before linking it.</small>}</label>
          </div>}
          {kind === 'resume' && <label><span>Version note / reason <em>Optional</em></span><input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="What changed or why this version exists" data-testid="input-resume-change-reason" /></label>}
          {kind === 'resume'
            ? <label><span>Resume text</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={12} placeholder="Paste the full resume text for this version." data-testid="textarea-record-content" /></label>
            : <>
              <label><span>Canonical job description</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={10} placeholder="Paste the authoritative job description used for matching and preparation." data-testid="textarea-record-content" /></label>
              <label><span>Private application notes <em>Optional</em></span><textarea value={jobNotes} onChange={(event) => setJobNotes(event.target.value)} rows={4} placeholder="Interview notes, contact details, and next steps stay in metadata." data-testid="textarea-job-notes" /></label>
            </>}
          {error && <p className="workspace-form-error" role="alert">{error}</p>}
          <div className="workspace-modal-actions"><button type="button" className="workspace-button workspace-button-quiet" onClick={onClose} data-testid="button-cancel-record">Cancel</button><button type="submit" className="workspace-button workspace-button-dark" disabled={isPending} data-testid="button-save-record">{isPending ? 'Saving…' : 'Save record'} <ArrowRight size={15} /></button></div>
        </form>
      </div>
    </div>
  );
}

function ResumeVersionCard({
  record,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onRestore,
  onDelete,
  onConfirmFactReview,
}: {
  record: WorkspaceRecord;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onConfirmFactReview: () => Promise<void>;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const status = readString(record.metadata, 'status') || 'Draft';
  const changeReason = readString(record.metadata, 'changeReason');
  const requiresReview = needsFactReview(record);
  const factReviewed = readString(record.metadata, 'verificationStatus') === 'verified';
  const factReviewedAt = readString(record.metadata, 'factReviewConfirmedAt');
  const changes = readResumeChanges(record.metadata);
  const confirmFactReview = async () => {
    if (!factsConfirmed || reviewSaving) return;
    setReviewSaving(true);
    setReviewError('');
    try {
      await onConfirmFactReview();
      setReviewOpen(false);
    } catch {
      setReviewError('The review confirmation could not be saved. This draft remains unverified.');
    } finally {
      setReviewSaving(false);
    }
  };
  return (
    <article className={`workspace-record-card ${selected ? 'workspace-record-card-selected' : ''}`} data-testid={`card-resume-${record.id}`}>
      <button type="button" className="workspace-record-select" onClick={onSelect} data-testid={`button-select-resume-${record.id}`}>
        <span className="workspace-record-icon"><FileText size={18} /></span>
        <span className="workspace-record-main"><strong>{record.title}</strong><small>Updated {formatDate(record.updatedAt)}</small></span>
        <ChevronDown size={15} className={selected ? 'workspace-chevron-up' : ''} />
      </button>
      <div className="workspace-record-meta"><StatusPill status={requiresReview ? 'Needs review' : factReviewed ? 'Fact reviewed' : status} /><span>{record.content.length.toLocaleString()} characters</span></div>
      {selected && <div className="workspace-record-expanded">
        <p>{record.content.slice(0, 230)}{record.content.length > 230 ? '…' : ''}</p>
        {changeReason && <p className="workspace-version-reason">{changeReason}</p>}
        {factReviewed && factReviewedAt && <p className="workspace-version-reason">Fact review confirmed {formatDate(factReviewedAt)}.</p>}
        {requiresReview && <p className="workspace-unverified-note"><strong>Unverified AI draft.</strong> Not ready for an application or preparation until you review and confirm every factual claim.</p>}
        {changes.length > 0 && <details className="workspace-diff-details">
          <summary><GitCompareArrows size={15} /> Complete before / after change log ({changes.length}) <ChevronDown size={14} /></summary>
          <ResumeChangeList changes={changes} />
        </details>}
        {requiresReview && <div className="workspace-review-panel">
          {!reviewOpen
            ? <button type="button" className="workspace-text-button" onClick={() => { setReviewOpen(true); setFactsConfirmed(false); setReviewError(''); }} data-testid={`button-review-tailored-resume-${record.id}`}>Confirm fact review <ArrowRight size={13} /></button>
            : <>
              <p>Confirm only after reviewing the complete change log above and verifying each claim, date, number, skill, and accomplishment against your source material.</p>
              <label className="workspace-review-check"><input type="checkbox" checked={factsConfirmed} onChange={(event) => setFactsConfirmed(event.target.checked)} /><span>I reviewed the complete changes and verified every factual claim.</span></label>
              <div><button type="button" className="workspace-button workspace-button-quiet" onClick={() => setReviewOpen(false)} disabled={reviewSaving}>Cancel</button><button type="button" className="workspace-button workspace-button-dark" onClick={() => void confirmFactReview()} disabled={!factsConfirmed || reviewSaving} data-testid={`button-confirm-tailored-resume-${record.id}`}>{reviewSaving ? 'Saving review…' : 'Mark reviewed'}</button></div>
              {reviewError && <p className="workspace-form-error" role="alert">{reviewError}</p>}
            </>}
        </div>}
        <div className="workspace-record-actions">
          <button type="button" className="workspace-text-button" onClick={onEdit} data-testid={`button-edit-resume-${record.id}`}>Rename / edit <ArrowRight size={13} /></button>
          <button type="button" className="workspace-text-button" onClick={onDuplicate} data-testid={`button-duplicate-resume-${record.id}`}><Copy size={13} /> Duplicate</button>
          <button type="button" className="workspace-text-button" onClick={onRestore} data-testid={`button-restore-resume-${record.id}`}><RefreshCw size={13} /> Restore as new</button>
          <button type="button" className="workspace-delete-button" onClick={onDelete} data-testid={`button-delete-resume-${record.id}`}><Trash2 size={14} /> Delete</button>
        </div>
      </div>}
    </article>
  );
}

function ResumeCompare({ records }: { records: WorkspaceRecord[] }) {
  const [aId, setAId] = useState(records[1]?.id ?? records[0]?.id ?? 0);
  const [bId, setBId] = useState(records[0]?.id ?? 0);
  const latest = records[0];
  const latestSourceId = readId(latest?.metadata, 'sourceResumeId') ?? readId(latest?.metadata, 'parentVersionId');
  const defaultAId = records.find((record) => record.id === latestSourceId)?.id ?? records[1]?.id ?? records[0]?.id ?? 0;
  const defaultBId = records[0]?.id ?? defaultAId;
  const selectedAId = records.some((record) => record.id === aId) ? aId : defaultAId;
  const selectedBId = records.some((record) => record.id === bId) ? bId : defaultBId;
  const a = records.find((record) => record.id === selectedAId);
  const b = records.find((record) => record.id === selectedBId);
  const exactChanges = readResumeChanges(b?.metadata);
  const diff = a && b ? diffResumeText(a.content, b.content) : [];
  if (records.length < 2) return <div className="workspace-compare workspace-compare-empty"><div className="workspace-compare-title"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Side-by-side review</span><h2>Compare when the second version is ready.</h2></div><FlaskConical size={22} /></div><p>Two saved resume versions make trade-offs visible before an application goes out.</p></div>;
  return (
    <section className="workspace-compare">
      <div className="workspace-compare-title"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Side-by-side review</span><h2>A / B, without the guesswork.</h2></div><span className="workspace-compare-label"><span className="workspace-compare-dot workspace-compare-dot-a" />A <span className="workspace-compare-dot workspace-compare-dot-b" />B</span></div>
      <div className="workspace-compare-selects"><label><span>Version A</span><select value={selectedAId} onChange={(event) => setAId(Number(event.target.value))} data-testid="select-compare-a">{records.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></label><ArrowRight size={15} /><label><span>Version B</span><select value={selectedBId} onChange={(event) => setBId(Number(event.target.value))} data-testid="select-compare-b">{records.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></label></div>
      <div className="workspace-compare-columns"><div><div className="workspace-compare-column-head"><b>A</b><strong>{a?.title}</strong></div><p>{a?.content}</p></div><div><div className="workspace-compare-column-head"><b>B</b><strong>{b?.title}</strong></div><p>{b?.content}</p></div></div>
      <details className="workspace-diff-details">
        <summary><GitCompareArrows size={15} /> Exact version changes <ChevronDown size={14} /></summary>
        {exactChanges.length > 0 ? (
          <ResumeChangeList changes={exactChanges} />
        ) : (
          <div className="workspace-inline-diff" aria-label="Word-level resume changes">{diff.map((segment, index) => segment.type === 'unchanged' ? <span key={index}>{segment.text}</span> : <mark key={index} className={`workspace-diff-${segment.type}`}>{segment.text}</mark>)}</div>
        )}
        {readString(b?.metadata, 'changeReason') && <p className="workspace-change-why"><strong>Version note</strong>{readString(b?.metadata, 'changeReason')}</p>}
      </details>
    </section>
  );
}

function WorkbenchPage() {
  const { recordsQuery, createRecord, deleteRecord, updateRecord } = useWorkspaceRecords();
  const [modal, setModal] = useState<'new' | WorkspaceRecord | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const onDelete = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  const confirmFactReview = async (record: WorkspaceRecord) => {
    await updateRecord.mutateAsync({
      id: record.id,
      data: {
        metadata: {
          ...record.metadata,
          verificationStatus: 'verified',
          factReviewConfirmedAt: new Date().toISOString(),
        },
      },
    });
    await recordsQuery.refetch();
  };
  const addResumeCopy = (record: WorkspaceRecord, action: 'duplicate' | 'restore') => {
    const label = action === 'restore' ? 'restored' : 'copy';
    createRecord.mutate({
      data: {
        kind: 'resume',
        title: `${record.title} · ${label}`,
        content: record.content,
        metadata: {
          ...record.metadata,
          status: 'Draft',
          parentVersionId: record.id,
          sourceVersionId: record.id,
          ...(action === 'restore' ? { restoredFromId: record.id, changeReason: `Restored from “${record.title}” as a new version.` } : { changeReason: `Duplicated from “${record.title}”.` }),
        },
      },
    }, { onSuccess: () => recordsQuery.refetch() });
  };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="overview" action={<button type="button" className="workspace-button workspace-button-dark" onClick={() => setModal('new')} data-testid="button-new-resume"><Plus size={16} /> New resume version</button>} />
      <div className="workspace-overview-grid">
        <section className="workspace-panel workspace-resume-panel">
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Resume library</span><h2>Versions that remember the why.</h2></div><span className="workspace-count">{resumes.length.toString().padStart(2, '0')}</span></div>
          {resumes.length === 0 ? <EmptyState title="Your first version belongs here." body="Keep the resume text you trust, then tailor from a clear starting point." action={<button type="button" className="workspace-text-button" onClick={() => setModal('new')} data-testid="button-empty-new-resume">Add a version <ArrowRight size={13} /></button>} /> : <div className="workspace-record-list">{resumes.map((record) => <ResumeVersionCard key={record.id} record={record} selected={selected === record.id} onSelect={() => setSelected(selected === record.id ? null : record.id)} onEdit={() => setModal(record)} onDuplicate={() => addResumeCopy(record, 'duplicate')} onRestore={() => addResumeCopy(record, 'restore')} onDelete={() => onDelete(record)} onConfirmFactReview={() => confirmFactReview(record)} />)}</div>}
        </section>
        <section className="workspace-panel workspace-history-panel">
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Change history</span><h2>Recent decisions.</h2></div><Clock3 size={19} /></div>
          {resumes.length === 0 ? <EmptyState title="Changes will show here." body="Every saved version becomes a quiet trail of how the story evolves." /> : <div className="workspace-history-list">{resumes.slice(0, 5).map((record, index) => <div className="workspace-history-item" key={record.id}><span className="workspace-history-marker">{index === 0 ? <Check size={12} /> : <span />}</span><div><strong>{record.title}</strong><p>{readString(record.metadata, 'changeReason') || (index === 0 ? 'Latest saved version' : 'Resume version saved')}</p></div><time>{formatShortDate(record.updatedAt)}</time></div>)}</div>}
          <div className="workspace-panel-foot"><Link href="/workspace/match" className="workspace-text-button" data-testid="link-history-match">Use a version for role match <ArrowRight size={13} /></Link></div>
        </section>
      </div>
      <ResumeCompare records={resumes} />
      <PrivacyControls records={recordsQuery.data ?? []} onChanged={() => recordsQuery.refetch()} />
      {modal && <RecordModal kind="resume" record={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} onSaved={() => recordsQuery.refetch()} />}
    </>
  );
}

function PrivacyControls({ records, onChanged }: { records: WorkspaceRecord[]; onChanged: () => Promise<unknown> | void }) {
  const { deleteRecord } = useWorkspaceRecords();
  const deleteAllRecords = useDeleteAllWorkspaceRecords();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<'all' | 'analysis' | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const analysisCount = records.filter((record) => record.kind === 'analysis').length;

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const exportPayload = await exportWorkspaceData();
      const exportBlob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(exportBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `ketan-workspace-${exportPayload.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice(`Exported ${exportPayload.records.length} workspace record${exportPayload.records.length === 1 ? '' : 's'} from your account.`);
      setError('');
    } catch {
      setError('The account-scoped export failed. Your workspace records were not changed; try again.');
      setNotice('');
    } finally {
      setExporting(false);
    }
  };

  const deleteSelectedRecords = async () => {
    const mode = confirming;
    const requiredText = mode === 'all' ? 'DELETE ALL' : 'CLEAR';
    if (!mode || confirmationText !== requiredText || deleting) return;
    setDeleting(true);
    setError('');
    setNotice('');
    let deletedByServer: number | null = null;
    try {
      if (mode === 'all') {
        const result = await deleteAllRecords.mutateAsync({ data: { confirmation: 'DELETE ALL' } });
        deletedByServer = result.deletedCount;
        queryClient.setQueryData(getListWorkspaceRecordsQueryKey(), []);
        queryClient.removeQueries({ queryKey: getExportWorkspaceDataQueryKey() });
        setConfirming(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListWorkspaceRecordsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getExportWorkspaceDataQueryKey() }),
        ]);
        await onChanged();
        setNotice(`Deleted ${result.deletedCount} account-owned workspace record${result.deletedCount === 1 ? '' : 's'}.`);
      } else {
        const selectedRecords = records.filter((record) => record.kind === 'analysis');
        let deleted = 0;
        const failedIds: number[] = [];
        let refreshFailed = false;
        for (const record of selectedRecords) {
          try {
            await deleteRecord.mutateAsync({ id: record.id });
            deleted += 1;
          } catch {
            failedIds.push(record.id);
          }
        }
        try {
          await onChanged();
        } catch {
          refreshFailed = true;
        }
        if (failedIds.length > 0) {
          setError(`Deleted ${deleted} of ${selectedRecords.length} analyses. Could not delete record IDs ${failedIds.join(', ')}; refresh and retry those records.`);
        } else if (refreshFailed) {
          setError('Analysis cleanup finished, but the current workspace view could not refresh. Reload to verify the remaining records.');
        } else {
          setNotice(`Cleared ${deleted} saved analysis record${deleted === 1 ? '' : 's'}.`);
          setConfirming(null);
        }
      }
    } catch {
      setError(deletedByServer === null
        ? 'The delete-all request did not return a result. It may have completed; reload or export your data to verify what remains before retrying.'
        : `The server deleted ${deletedByServer} records, but the workspace cache could not refresh. Reload the page to verify the account-owned workspace.`);
      setNotice('');
    } finally {
      setDeleting(false);
      setConfirmationText('');
    }
  };

  return (
    <section className="workspace-panel workspace-privacy-panel" aria-labelledby="workspace-privacy-title">
      <div className="workspace-panel-head">
        <div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Privacy controls</span><h2 id="workspace-privacy-title">Your records, your call.</h2></div>
        <ShieldCheck size={19} />
      </div>
      <div className="workspace-privacy-body">
        <p>Export or remove your private resumes, job descriptions, analyses, and generated drafts. Exported files include the saved record content and metadata.</p>
        <div className="workspace-privacy-actions">
          <button type="button" className="workspace-button workspace-button-quiet" onClick={() => void exportData()} disabled={exporting || deleting} data-testid="button-export-workspace"><Download size={15} /> {exporting ? 'Exporting…' : 'Export all as JSON'}</button>
          <button type="button" className="workspace-button workspace-button-quiet" disabled={!analysisCount || deleting} onClick={() => { setConfirming('analysis'); setConfirmationText(''); setNotice(''); setError(''); }} data-testid="button-clear-analysis-history"><Trash2 size={14} /> Clear analysis history <span>{analysisCount}</span></button>
          <button type="button" className="workspace-button workspace-button-danger" disabled={!records.length || deleting} onClick={() => { setConfirming('all'); setConfirmationText(''); setNotice(''); setError(''); }} data-testid="button-delete-all-workspace"><Trash2 size={14} /> Delete all workspace data</button>
        </div>
        {confirming && (
          <div className="workspace-privacy-confirm" role="alert">
            <p>{confirming === 'all'
              ? `Irreversible: this permanently deletes every workspace record owned by your account, including resume versions, applications, analyses, and generated drafts. This cannot be undone.`
              : `This permanently deletes all ${analysisCount} saved role analyses. Resume versions and applications remain unchanged.`}</p>
            <label><span>Type {confirming === 'all' ? 'DELETE ALL' : 'CLEAR'} to confirm</span><input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoComplete="off" /></label>
            <div><button type="button" className="workspace-button workspace-button-quiet" onClick={() => { setConfirming(null); setConfirmationText(''); }} disabled={deleting}>Cancel</button><button type="button" className="workspace-button workspace-button-danger" onClick={() => void deleteSelectedRecords()} disabled={confirmationText !== (confirming === 'all' ? 'DELETE ALL' : 'CLEAR') || deleting}>{deleting ? 'Deleting…' : confirming === 'all' ? 'Permanently delete all' : 'Clear analysis history'}</button></div>
          </div>
        )}
        {notice && <p className="workspace-privacy-notice" role="status"><CheckCheck size={15} />{notice}</p>}
        {error && <p className="workspace-form-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function JobsPage() {
  const { recordsQuery, deleteRecord } = useWorkspaceRecords();
  const [modal, setModal] = useState<'new' | WorkspaceRecord | null>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const jobs = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'job'), [recordsQuery.data]);
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const filtered = jobs.filter((job) => {
    const matchesFilter = filter === 'All' || (readString(job.metadata, 'status') || 'Saved') === filter;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || `${job.title} ${readString(job.metadata, 'company')}`.toLowerCase().includes(needle);
    return matchesFilter && matchesSearch;
  });
  const onDelete = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="jobs" action={<button type="button" className="workspace-button workspace-button-dark" onClick={() => setModal('new')} data-testid="button-new-job"><Plus size={16} /> Add application</button>} />
      <section className="workspace-panel workspace-jobs-panel">
        <div className="workspace-toolbar"><div className="workspace-filter-tabs">{['All', 'Saved', 'Applied', 'Interviewing', 'Offer'].map((item) => <button type="button" key={item} className={filter === item ? 'workspace-filter-active' : ''} onClick={() => setFilter(item)} data-testid={`button-filter-${item.toLowerCase()}`}>{item}<span>{item === 'All' ? jobs.length : jobs.filter((job) => (readString(job.metadata, 'status') || 'Saved') === item).length}</span></button>)}</div><div className="workspace-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles" aria-label="Search applications" data-testid="input-search-jobs" /></div></div>
          {filtered.length === 0 ? <EmptyState title={jobs.length === 0 ? 'No applications tracked yet.' : 'Nothing in this lane.'} body={jobs.length === 0 ? 'Add a role when it feels worth a considered next step.' : 'Try another status to find the application you are looking for.'} action={jobs.length === 0 ? <button type="button" className="workspace-text-button" onClick={() => setModal('new')} data-testid="button-empty-new-job">Add application <ArrowRight size={13} /></button> : undefined} /> : <div className="workspace-job-table"><div className="workspace-job-row workspace-job-header"><span>Role</span><span>Status</span><span>Next reminder</span><span>Saved</span><span /></div>{filtered.map((job) => {
            const status = readString(job.metadata, 'status') || 'Saved';
            const deadline = readString(job.metadata, 'reminderAt') || readString(job.metadata, 'deadline');
            const appliedAt = readString(job.metadata, 'appliedAt');
            const interviewDate = readString(job.metadata, 'interviewDate');
            const linkedResume = resumes.find((resume) => resume.id === readId(job.metadata, 'resumeVersionId'));
            const linkedResumeLabel = linkedResume
              ? needsFactReview(linkedResume) ? `${linkedResume.title} · Needs fact review` : linkedResume.title
              : 'No resume linked';
            return (
              <div className="workspace-job-row" key={job.id} data-testid={`row-job-${job.id}`}>
                <div className="workspace-job-title">
                  <span className="workspace-company-mark">{(readString(job.metadata, 'company') || job.title).slice(0, 1).toUpperCase()}</span>
                  <span><strong>{job.title}</strong><small>{readString(job.metadata, 'company') || 'Company not added'}</small><small>Applied {formatDate(appliedAt)} · Interview {formatDate(interviewDate)} · {linkedResumeLabel}</small></span>
                </div>
                <StatusPill status={status} />
                <span className={deadline && new Date(deadline) < new Date() ? 'workspace-date-overdue' : ''}>{deadline ? <><CalendarClock size={14} />{formatDate(deadline)}</> : 'No reminder'}</span>
                <span>{formatShortDate(job.createdAt)}</span>
                <div className="workspace-row-actions">
                  <Link href={`/workspace/prepare?jobId=${job.id}&kind=follow-up`} className="workspace-icon-button" aria-label={`Draft follow-up for ${job.title}`} data-testid={`link-follow-up-job-${job.id}`}><Send size={14} /></Link>
                  <button type="button" className="workspace-icon-button" onClick={() => setModal(job)} data-testid={`button-edit-job-${job.id}`} aria-label={`Edit ${job.title}`}><FileText size={15} /></button>
                  <button type="button" className="workspace-icon-button workspace-danger-icon" onClick={() => onDelete(job)} data-testid={`button-delete-job-${job.id}`} aria-label={`Delete ${job.title}`}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}</div>}
      </section>
      <div className="workspace-job-note"><CalendarClock size={17} /><p>Applied and interview dates, your chosen resume, and follow-up reminders stay linked to each application.</p></div>
      {modal && <RecordModal kind="job" record={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} onSaved={() => recordsQuery.refetch()} />}
    </>
  );
}

function AnalysisList({
  title,
  items,
  emptyText,
  testId,
}: {
  title: string;
  items: string[];
  emptyText?: string;
  testId: string;
}) {
  return (
    <section className="workspace-analysis-group" data-testid={testId}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      ) : emptyText ? (
        <p>{emptyText}</p>
      ) : (
        <p>No items identified.</p>
      )}
    </section>
  );
}

function AnalysisResult({ analysis, sourceResume, onDelete }: { analysis: WorkspaceRecord; sourceResume?: WorkspaceRecord; onDelete: () => void }) {
  const metadata = (analysis.metadata ?? {}) as Meta;
  const fitScore = readNumber(metadata, 'fitScore');
  const recommendation = readString(metadata, 'recommendation');
  const heatmap = readKeywordHeatmap(metadata.keywordHeatmap);
  const roadmap = readRoadmap(metadata);

  return (
    <details className="workspace-analysis-item">
      <summary>
        <span><strong>{analysis.title}</strong><small>Generated {formatDate(analysis.updatedAt)}</small></span>
        <ArrowRight size={15} />
      </summary>
      <div className="workspace-analysis-content" data-testid={`panel-analysis-${analysis.id}`}>
        {fitScore !== null && (
          <div className="workspace-analysis-score" data-testid={`text-analysis-fit-score-${analysis.id}`}>
            <span>Resume match</span>
            <strong>{fitScore}<small>/100</small></strong>
          </div>
        )}
        <p className="workspace-analysis-summary">{analysis.content}</p>
        {recommendation && (
          <p className="workspace-analysis-recommendation"><strong>Recommendation</strong>{recommendation}</p>
        )}
        <div className="workspace-analysis-groups">
          <AnalysisList
            title="Strengths"
            items={readStringList(metadata, 'strengths')}
            testId={`list-analysis-strengths-${analysis.id}`}
          />
          <AnalysisList
            title="Skill gaps"
            items={readStringList(metadata, 'skillGaps')}
            emptyText="No clear skill gaps flagged against the supplied materials."
            testId={`list-analysis-skill-gaps-${analysis.id}`}
          />
          <AnalysisList
            title="ATS checks"
            items={readStringList(metadata, 'atsIssues')}
            emptyText="No common ATS structure issues flagged in the supplied resume."
            testId={`list-analysis-ats-issues-${analysis.id}`}
          />
          <AnalysisList
            title="Keywords to consider"
            items={readStringList(metadata, 'keywords')}
            emptyText="No additional keywords identified."
            testId={`list-analysis-keywords-${analysis.id}`}
          />
        </div>
        {heatmap.length > 0 && <KeywordHeatmap items={heatmap} />}
        {heatmap.length > 0 && sourceResume && <details className="workspace-keyword-preview">
          <summary>Show keyword matches in {sourceResume.title}</summary>
          <p>{highlightKeywordText(sourceResume.content, heatmap).map((segment, index) => segment.status
            ? <mark key={index} className={`workspace-resume-highlight workspace-resume-highlight-${segment.status}`}>{segment.text}</mark>
            : <span key={index}>{segment.text}</span>)}</p>
        </details>}
        {roadmap.length > 0 && <section className="workspace-roadmap" aria-label="Skill gap roadmap">
          <div className="workspace-roadmap-head"><strong>Skill gap roadmap</strong><span>Grounded next steps</span></div>
          {roadmap.map((item, index) => <article key={`${item.skill}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><div className="workspace-roadmap-item-head"><strong>{item.skill}</strong><span>{item.priority}</span></div>{item.requirement && <p className="workspace-roadmap-requirement">{item.requirement}</p>}<p>{item.action}</p></div></article>)}
        </section>}
        <button
          type="button"
          className="workspace-delete-button workspace-output-delete"
          onClick={onDelete}
          data-testid={`button-delete-analysis-${analysis.id}`}
        >
          <Trash2 size={14} /> Delete analysis
        </button>
      </div>
    </details>
  );
}

type SavedBatchSummary = {
  batchId: string;
  resumeId: number;
  completedJobIds: number[];
};

function BatchComparison({ analyses, onResume }: { analyses: WorkspaceRecord[]; onResume: (batch: SavedBatchSummary) => void }) {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const chronological = [...analyses].sort((a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf());
  const batchIds = [...new Set(chronological.map((analysis) => readString(analysis.metadata, 'batchId')).filter(Boolean))];
  const batchId = batchIds.includes(selectedBatchId) ? selectedBatchId : batchIds[0];
  if (!batchId) return null;
  const batch = chronological.filter((analysis) => readString(analysis.metadata, 'batchId') === batchId);
  const resumeId = readId(batch[0]?.metadata, 'sourceResumeId');
  const completedJobIds = [...new Set(batch
    .map((analysis) => readId(analysis.metadata, 'sourceJobId'))
    .filter((id): id is number => id !== null))];

  return (
    <section className="workspace-batch-comparison" aria-label="Multiple job description comparison">
      <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Multiple-JD comparison</span><h2>Separate reads, side by side.</h2></div><GitCompareArrows size={19} /></div>
      {batchIds.length > 1 && <div className="workspace-compare-selects"><label><span>Saved comparison</span><select value={batchId} onChange={(event) => setSelectedBatchId(event.target.value)} aria-label="Saved comparison">{batchIds.map((id, index) => <option key={id} value={id}>Comparison {batchIds.length - index}</option>)}</select></label></div>}
      <div className="workspace-comparison-table">
        <div className="workspace-comparison-row workspace-comparison-row-head"><span>Role</span><span>Resume fit</span><span>Keyword coverage</span><span>Evidence gaps</span></div>
        {batch.map((analysis) => {
          const metadata = (analysis.metadata ?? {}) as Meta;
          const heatmap = readKeywordHeatmap(metadata.keywordHeatmap);
          const covered = heatmap.filter((item) => item.status === 'strong' || item.status === 'partial').length;
          return <div className="workspace-comparison-row" key={analysis.id}><strong>{analysis.title}</strong><span>{readNumber(metadata, 'fitScore') === null ? '—' : `${readNumber(metadata, 'fitScore')}/100`}</span><span>{heatmap.length ? `${covered}/${heatmap.length}` : '—'}</span><span>{readStringList(metadata, 'skillGaps').length}</span></div>;
        })}
      </div>
      {batch.length === 1 && <p className="workspace-comparison-note">One result is saved. Select another tracked role to continue this comparison.</p>}
      <p className="workspace-comparison-note">Each score summarizes a separate saved analysis; review the evidence and gaps before drawing conclusions.</p>
      {resumeId && completedJobIds.length > 0 && <button type="button" className="workspace-text-button" onClick={() => onResume({ batchId, resumeId, completedJobIds })} data-testid="button-resume-multi-match">Continue this comparison <ArrowRight size={13} /></button>}
    </section>
  );
}

function MatchPage() {
  const { recordsQuery, generateContent, deleteRecord, updateRecord } = useWorkspaceRecords();
  const [resumeId, setResumeId] = useState(0);
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [activeBatchId, setActiveBatchId] = useState('');
  const [activeBatchResumeId, setActiveBatchResumeId] = useState(0);
  const [completedBatchJobIds, setCompletedBatchJobIds] = useState<number[]>([]);
  const allResumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const resumes = useMemo(() => allResumes.filter((record) => !needsFactReview(record)), [allResumes]);
  const analyses = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'analysis'), [recordsQuery.data]);
  const jobs = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'job'), [recordsQuery.data]);
  const selectedResume = resumes.find((record) => record.id === resumeId) ?? resumes[0];
  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedResume || !description.trim() || generateContent.isPending) return;
    setAnalysisError('');
    try {
      await generateContent.mutateAsync({
        data: {
          kind: 'analysis',
          title: title.trim() || 'Role match analysis',
          resumeText: selectedResume.content,
          jobDescription: description.trim(),
          sourceResumeId: selectedResume.id,
        },
      });
      await recordsQuery.refetch();
    } catch {
      setAnalysisError('The analysis could not be generated. Try again.');
    }
  };
  const runSelectedJobs = async () => {
    if (!selectedResume || selectedJobIds.length < 2 || batchRunning || generateContent.isPending) return;
    const selectedJobs = selectedJobIds.flatMap((id): WorkspaceRecord[] => {
      const job = jobs.find((item) => item.id === id);
      if (!job || !readJobDescription(job).trim()) return [];
      return [job];
    });
    if (selectedJobs.length < 2) {
      setBatchError('Choose at least two applications with saved job descriptions.');
      return;
    }
    setBatchError('');
    setBatchRunning(true);
    const isNewBatch = !activeBatchId || activeBatchResumeId !== selectedResume.id;
    const batchId = !isNewBatch
      ? activeBatchId
      : window.crypto?.randomUUID?.() ?? `batch-${Date.now().toString(36)}`;
    setActiveBatchId(batchId);
    setActiveBatchResumeId(selectedResume.id);
    if (isNewBatch) setCompletedBatchJobIds([]);
    const completedInBatch = isNewBatch ? [] : [...completedBatchJobIds];
    try {
      const persistedAndConfirmedResults = [
        ...analyses,
        ...completedInBatch.map((sourceJobId) => ({ metadata: { batchId, sourceJobId, sourceResumeId: selectedResume.id } })),
      ];
      const missingJobIds = missingBatchJobIds(selectedJobs.map((job) => job.id), persistedAndConfirmedResults, batchId, selectedResume.id);
      const jobsToRun = selectedJobs.filter((job) => missingJobIds.includes(job.id));
      if (jobsToRun.length === 0) {
        setBatchError('Every selected role already has a saved result in this comparison.');
        try {
          await recordsQuery.refetch();
        } catch {
          setBatchError('Every selected role already has a result, but the saved comparison could not refresh. Reload to view it.');
        }
        return;
      }
      for (const job of jobsToRun) {
        let canonicalDescription = readJobDescription(job);
        if (job.content !== canonicalDescription) {
          const migratedMetadata: Meta = { ...job.metadata };
          if (!readString(migratedMetadata, 'notes').trim() && job.content.trim() && job.content.trim() !== canonicalDescription.trim()) {
            migratedMetadata.notes = job.content;
          }
          delete migratedMetadata.jobDescription;
          delete migratedMetadata.description;
          const migratedJob = await updateRecord.mutateAsync({
            id: job.id,
            data: { content: canonicalDescription, metadata: migratedMetadata },
          });
          canonicalDescription = migratedJob.content;
        }
        await generateContent.mutateAsync({
          data: {
            kind: 'analysis',
            title: `${job.title} · Role match`,
            resumeText: selectedResume.content,
            jobDescription: canonicalDescription,
            sourceResumeId: selectedResume.id,
            sourceJobId: job.id,
            batchId,
          },
        });
        completedInBatch.push(job.id);
        setCompletedBatchJobIds([...completedInBatch]);
      }
      try {
        await recordsQuery.refetch();
        setSelectedJobIds([]);
        setActiveBatchId('');
        setActiveBatchResumeId(0);
        setCompletedBatchJobIds([]);
      } catch {
        setBatchError('The results were saved, but the comparison could not refresh. Retry safely to refresh it; completed roles will not be generated again.');
      }
    } catch {
      setBatchError('Some analyses could not be completed. Earlier results remain saved; retrying will run only missing roles in this comparison.');
      try {
        await recordsQuery.refetch();
      } catch {
        setBatchError('Some analyses may have completed, but results could not refresh. Retry in this comparison; confirmed completed roles will be skipped.');
      }
    } finally {
      setBatchRunning(false);
    }
  };
  const toggleJob = (id: number) => {
    setSelectedJobIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : current.length < 4 ? [...current, id] : current);
  };
  const resumeSavedBatch = ({ batchId, resumeId: batchResumeId, completedJobIds }: SavedBatchSummary) => {
    if (!resumes.some((resume) => resume.id === batchResumeId)) {
      setBatchError('The resume used for this comparison is unavailable or still needs fact review.');
      return;
    }
    setResumeId(batchResumeId);
    setActiveBatchId(batchId);
    setActiveBatchResumeId(batchResumeId);
    setCompletedBatchJobIds(completedJobIds);
    setSelectedJobIds(completedJobIds.filter((id) => jobs.some((job) => job.id === id && readJobDescription(job).trim())).slice(0, 4));
    setBatchError('');
  };
  const startNewBatch = () => {
    setActiveBatchId('');
    setActiveBatchResumeId(0);
    setCompletedBatchJobIds([]);
    setSelectedJobIds([]);
    setBatchError('');
  };
  const removeAnalysis = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="match" />
      <div className="workspace-match-layout">
        <form className="workspace-panel workspace-match-form" onSubmit={analyze}>
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />New analysis</span><h2>Bring the role in.</h2></div><BarChart3 size={19} /></div>
          {resumes.length === 0 ? <EmptyState title={allResumes.length ? 'Review the tailored draft first.' : 'Save a resume first.'} body={allResumes.length ? 'AI-tailored drafts are unavailable for role matching until you check the complete diff and verify their facts.' : 'The match lens needs a real version of your resume as its source.'} action={<Link href="/workspace" className="workspace-text-button" data-testid="link-match-add-resume">{allResumes.length ? 'Review versions' : 'Go to resume library'} <ArrowRight size={13} /></Link>} /> : <>
            <label><span>Resume version</span><select value={selectedResume?.id ?? 0} onChange={(event) => setResumeId(Number(event.target.value))} data-testid="select-match-resume">{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label>
            <label><span>Role or company label <em>Optional</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Talent acquisition associate" data-testid="input-match-title" /></label>
            <label><span>Job description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={13} placeholder="Paste the job description here. The analysis stays attached to your account." data-testid="textarea-job-description" /></label>
            {description.trim() && selectedResume && <KeywordHeatmap items={buildKeywordPreview(description, selectedResume.content)} />}
            <div className="workspace-form-footer"><span>{selectedResume?.content.length.toLocaleString() ?? 0} resume characters selected</span><button type="submit" className="workspace-button workspace-button-dark" disabled={!description.trim() || generateContent.isPending} data-testid="button-run-match">{generateContent.isPending ? 'Reading role…' : 'Run match'} <ArrowRight size={15} /></button></div>
            {(analysisError || generateContent.isError) && <p className="workspace-form-error" role="alert">{analysisError || 'The analysis could not be generated. Try again.'}</p>}
            {jobs.filter((job) => readJobDescription(job).trim()).length > 1 && <section className="workspace-batch-picker">
              <div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Compare saved roles</span><h3>One version, several JDs.</h3><p>Select 2–4 tracked applications with a saved job description. Each result is stored separately.</p></div>
              <div className="workspace-batch-jobs">{jobs.filter((job) => readJobDescription(job).trim()).map((job) => <label key={job.id} className="workspace-batch-job"><input type="checkbox" checked={selectedJobIds.includes(job.id)} disabled={!selectedJobIds.includes(job.id) && selectedJobIds.length >= 4} onChange={() => toggleJob(job.id)} /><span><strong>{job.title}</strong><small>{readString(job.metadata, 'company') || 'Company not added'}</small><small>{readJobDescription(job).replace(/\s+/g, ' ').slice(0, 140)}{readJobDescription(job).length > 140 ? '…' : ''}</small></span></label>)}</div>
              <div className="workspace-batch-footer"><span>{selectedJobIds.length}/4 selected</span><button type="button" className="workspace-button workspace-button-quiet" disabled={selectedJobIds.length < 2 || batchRunning || generateContent.isPending} onClick={() => void runSelectedJobs()} data-testid="button-run-multi-match">{batchRunning ? 'Comparing roles…' : 'Match selected roles'} <GitCompareArrows size={15} /></button></div>
              {activeBatchId && <p className="workspace-comparison-note">Continuing a saved comparison. Completed roles will not run again. <button type="button" className="workspace-text-button" onClick={startNewBatch}>Start a new comparison</button></p>}
              {batchError && <p className="workspace-form-error" role="alert">{batchError}</p>}
            </section>}
          </>}
        </form>
        <section className="workspace-panel workspace-analysis-panel">
          <div className="workspace-panel-head">
            <div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Saved analyses</span><h2>Look back, then sharpen.</h2></div>
            <span className="workspace-count">{analyses.length.toString().padStart(2, '0')}</span>
          </div>
          {analyses.length === 0 ? (
            <EmptyState title="No role analysis yet." body="A match report will show its score, ATS checks, and skill gaps here." />
          ) : (
            <div className="workspace-analysis-list">
              {analyses.map((analysis) => (
                <AnalysisResult
                  key={analysis.id}
                  analysis={analysis}
                  sourceResume={resumes.find((resume) => resume.id === readId(analysis.metadata, 'sourceResumeId'))}
                  onDelete={() => removeAnalysis(analysis)}
                />
              ))}
            </div>
          )}
          <BatchComparison analyses={analyses} onResume={resumeSavedBatch} />
        </section>
      </div>
    </>
  );
}

type GenerationKind = 'interview' | 'cover-letter' | 'linkedin' | 'resume-tailor' | 'follow-up';
const interviewCategories = ['HR', 'Technical', 'Resume', 'JD', 'STAR'] as const;
type InterviewQuestionCategory = (typeof interviewCategories)[number];

const generationOptions: { kind: GenerationKind; label: string; description: string; icon: ComponentType<{ size?: number }> }[] = [
  { kind: 'interview', label: 'Interview questions', description: 'Build grounded answers from the resume and role.', icon: MessageIcon },
  { kind: 'cover-letter', label: 'Cover letter', description: 'Draft a specific letter without making claims up.', icon: Send },
  { kind: 'linkedin', label: 'LinkedIn content', description: 'Shape a concise post or outreach note.', icon: Link2 },
  { kind: 'resume-tailor', label: 'Tailor a new version', description: 'Create a separate, source-grounded resume revision.', icon: Sparkles },
  { kind: 'follow-up', label: 'Application follow-up', description: 'Prepare a grounded note for a tracked application.', icon: CalendarClock },
];

function MessageIcon({ size }: { size?: number }) {
  return <span className="workspace-message-icon" style={{ width: size ?? 17 }}><span /><span /><span /></span>;
}

function PreparePage() {
  const { recordsQuery, generateContent, deleteRecord, updateRecord } = useWorkspaceRecords();
  const [kind, setKind] = useState<GenerationKind>(() => new URLSearchParams(window.location.search).get('kind') === 'follow-up' ? 'follow-up' : 'interview');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [questionCategory, setQuestionCategory] = useState<InterviewQuestionCategory>('HR');
  const [jobId, setJobId] = useState(() => Number(new URLSearchParams(window.location.search).get('jobId')) || 0);
  const [followupReminder, setFollowupReminder] = useState('');
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const jobs = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'job'), [recordsQuery.data]);
  const outputs = useMemo(() => (recordsQuery.data ?? []).filter((record) => ['interview', 'cover-letter', 'linkedin', 'follow-up'].includes(record.kind)), [recordsQuery.data]);
  const selectedJob = jobs.find((job) => job.id === jobId);
  const preferredResumeId = readId(selectedJob?.metadata, 'resumeVersionId');
  const verifiedResumes = useMemo(() => resumes.filter((resume) => !needsFactReview(resume)), [resumes]);
  const defaultResume = verifiedResumes.find((resume) => resume.id === preferredResumeId) ?? verifiedResumes[0];
  const selectedResume = resumeId === null
    ? defaultResume
    : resumeId === 0 ? undefined : verifiedResumes.find((resume) => resume.id === resumeId);
  const selected = generationOptions.find((option) => option.kind === kind) ?? generationOptions[0];
  useEffect(() => {
    if (selectedJob) {
      setJobDescription(readJobDescription(selectedJob));
      setFollowupReminder(readString(selectedJob.metadata, 'reminderAt') || readString(selectedJob.metadata, 'deadline'));
      const linkedId = readId(selectedJob.metadata, 'resumeVersionId');
      if (linkedId && verifiedResumes.some((resume) => resume.id === linkedId)) setResumeId(linkedId);
    } else if (jobId === 0) {
      setJobDescription('');
      setFollowupReminder('');
    }
  }, [jobId, selectedJob?.id, selectedJob?.content, selectedJob?.metadata, verifiedResumes]);
  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (generateContent.isPending || updateRecord.isPending) return;
    if (kind !== 'follow-up' && !selectedResume) {
      setFormError('Choose a fact-reviewed resume version before preparing this material.');
      return;
    }
    if (kind === 'resume-tailor' && !jobDescription.trim()) {
      setFormError('Add a job description before tailoring this resume.');
      return;
    }
    if (kind === 'follow-up' && !selectedJob) {
      setFormError('Select a tracked application before drafting its follow-up.');
      return;
    }
    setFormError('');
    setFormNotice('');
    const outputTitle = title.trim() || [selected.label, selectedResume?.title, selectedJob?.title].filter(Boolean).join(' · ');
    const data = {
      kind,
      title: outputTitle,
      ...(selectedResume ? { resumeText: selectedResume.content } : {}),
      ...(kind !== 'follow-up' && jobDescription.trim() ? { jobDescription: jobDescription.trim() } : {}),
      instructions: instructions.trim() || undefined,
      ...(kind === 'interview' ? { questionCategory } : {}),
      ...(kind === 'resume-tailor' && selectedResume ? { sourceResumeId: selectedResume.id } : {}),
      ...(kind === 'follow-up' && selectedJob ? { sourceJobId: selectedJob.id } : {}),
    };
    try {
      await generateContent.mutateAsync({ data });
      if (kind === 'resume-tailor') {
        setFormNotice('A new tailored resume version was saved. Review its exact changes in the workbench comparison.');
      } else if (kind === 'follow-up' && selectedJob) {
        if (followupReminder) {
          try {
            await updateRecord.mutateAsync({
              id: selectedJob.id,
              data: {
                metadata: {
                  ...selectedJob.metadata,
                  reminderAt: followupReminder,
                  deadline: followupReminder,
                },
              },
            });
            setFormNotice('Follow-up draft saved and the application reminder updated.');
          } catch {
            setFormError('The follow-up draft was saved, but its reminder could not be updated. Set it again from Applications.');
          }
        } else {
          setFormNotice('Follow-up draft saved. Add a reminder date to keep the next step visible.');
        }
      } else {
        setFormNotice('Your preparation draft was saved to this private workspace.');
      }
      await recordsQuery.refetch();
      setInstructions('');
    } catch {
      setFormError('This draft could not be generated. Try again.');
    }
  };
  const removeOutput = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="prepare" />
      <div className="workspace-prepare-layout">
        <form className="workspace-panel workspace-prepare-form" onSubmit={generate}>
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Make something useful</span><h2>Start with the format.</h2></div><Sparkles size={19} /></div>
          <div className="workspace-generation-options">{generationOptions.map((option) => { const Icon = option.icon; return <button key={option.kind} type="button" className={kind === option.kind ? 'workspace-generation-option workspace-generation-option-active' : 'workspace-generation-option'} onClick={() => { if (option.kind !== 'follow-up' && resumeId === 0) setResumeId(null); setKind(option.kind); setFormError(''); setFormNotice(''); }} data-testid={`button-generate-${option.kind}`}><Icon size={17} /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>; })}</div>
          {kind !== 'follow-up' && verifiedResumes.length === 0
            ? <EmptyState
              title={resumes.length ? 'Review the tailored draft first.' : 'A resume is the starting point.'}
              body={resumes.length ? 'AI-tailored versions stay unavailable for preparation until you review the complete diff and confirm every factual claim.' : 'Save a fact-checked resume in the workbench before generating preparation material.'}
              action={<Link href="/workspace" className="workspace-text-button" data-testid="link-prepare-add-resume">{resumes.length ? 'Review versions' : 'Save a resume'} <ArrowRight size={13} /></Link>}
            />
            : <>
            {verifiedResumes.length > 0
              ? <label><span>Resume version {kind === 'follow-up' && <em>Optional</em>}</span><select value={selectedResume?.id ?? 0} onChange={(event) => setResumeId(Number(event.target.value))} data-testid="select-prepare-resume">{kind === 'follow-up' && <option value={0}>No resume context</option>}{verifiedResumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label>
              : <p className="workspace-field-note">No fact-reviewed resume is selected. You can still prepare a tracked application follow-up.</p>}
            <label><span>Tracked application <em>{kind === 'follow-up' ? 'Required' : 'Optional'}</em></span><select value={selectedJob?.id ?? ''} onChange={(event) => setJobId(Number(event.target.value) || 0)} data-testid="select-prepare-job"><option value="">{kind === 'follow-up' ? 'Select a tracked application' : 'Use role context below'}</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {readString(job.metadata, 'company') || 'Company not added'}</option>)}</select></label>
            <label><span>Working title <em>Optional</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selected.label} data-testid="input-prepare-title" /></label>
            {kind !== 'follow-up' && <label><span>Role context <em>{selectedJob ? 'From selected application · editable' : 'Optional'}</em></span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={6} placeholder="Paste the job description or context for this draft." data-testid="textarea-prepare-context" /></label>}
            {kind === 'interview' && <label><span>Question category</span><select value={questionCategory} onChange={(event) => setQuestionCategory(event.target.value as InterviewQuestionCategory)} data-testid="select-interview-category">{interviewCategories.map((category) => <option key={category}>{category}</option>)}</select></label>}
            {kind === 'follow-up' && <label><span>Follow-up reminder <em>Optional</em></span><input type="date" value={followupReminder} onChange={(event) => setFollowupReminder(event.target.value)} data-testid="input-follow-up-reminder" />{selectedJob && <small className="workspace-field-note">This date is saved back to the selected application.</small>}</label>}
            <label><span>Direction <em>Optional</em></span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder="What should feel especially like you?" data-testid="textarea-prepare-instructions" /></label>
            <div className="workspace-form-footer"><span>Source: {selectedResume?.title || 'No resume'}{selectedJob ? ` · ${selectedJob.title}` : ''}</span><button type="submit" className="workspace-button workspace-button-dark" disabled={generateContent.isPending || updateRecord.isPending} data-testid="button-submit-preparation">{generateContent.isPending || updateRecord.isPending ? 'Working…' : kind === 'resume-tailor' ? 'Save new version' : kind === 'follow-up' ? 'Draft follow-up' : 'Generate draft'} <Sparkles size={15} /></button></div>
            {formError && <p className="workspace-form-error" role="alert">{formError}</p>}
            {formNotice && <p className="workspace-privacy-notice" role="status"><CheckCheck size={15} />{formNotice}</p>}
            {generateContent.isError && !formError && <p className="workspace-form-error">This draft could not be generated. Try again.</p>}
          </>}
        </form>
        <section className="workspace-panel workspace-output-panel"><div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Saved preparation</span><h2>Material worth revisiting.</h2></div><span className="workspace-count">{outputs.length.toString().padStart(2, '0')}</span></div>{outputs.length === 0 ? <EmptyState title="Your preparation desk is clear." body="Generated interview answers, letters, and LinkedIn drafts will stay here." /> : <div className="workspace-output-list">{outputs.map((output) => {
          const metadata = (output.metadata ?? {}) as Meta;
          const questions = output.kind === 'interview' ? readInterviewQuestions(metadata) : [];
          const questionsToAsk = output.kind === 'interview' ? readStringList(metadata, 'questionsToAsk') : [];
          const subject = readString(metadata, 'subject');
          const interviewCopy = questions.length
            ? `${questions.map((question) => `${question.category}: ${question.question}\n${question.suggestedAnswerPoints.map((point) => `• ${point}`).join('\n')}`).join('\n\n')}${questionsToAsk.length ? `\n\nQuestions to ask:\n${questionsToAsk.map((question) => `• ${question}`).join('\n')}` : ''}`
            : output.content;
          const copyText = subject ? `Subject: ${subject}\n\n${output.content}` : interviewCopy;
          return <details key={output.id} className="workspace-output-item">
            <summary><span className="workspace-output-kind">{output.kind.replace('-', ' ')}</span><span><strong>{output.title}</strong><small>Updated {formatDate(output.updatedAt)}</small></span><ChevronDown size={15} /></summary>
            <div className="workspace-output-content">
              {subject && <p className="workspace-output-subject"><strong>Subject</strong>{subject}</p>}
              {questions.length ? <>
                <div className="workspace-interview-list">{questions.map((question, index) => <article key={`${question.question}-${index}`}><span>{question.category}</span><strong>{question.question}</strong>{question.suggestedAnswerPoints.length > 0 && <ul>{question.suggestedAnswerPoints.map((point, pointIndex) => <li key={`${point}-${pointIndex}`}>{point}</li>)}</ul>}</article>)}</div>
                {questionsToAsk.length > 0 && <div className="workspace-output-notes"><strong>Questions to ask</strong><ul>{questionsToAsk.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ul></div>}
              </> : <p className="workspace-output-copy">{output.content}</p>}
              {readStringList(metadata, 'notes').length > 0 && <div className="workspace-output-notes"><strong>Notes</strong><ul>{readStringList(metadata, 'notes').map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul></div>}
              <div className="workspace-output-actions"><CopyAction text={copyText} /><button type="button" className="workspace-delete-button" onClick={() => removeOutput(output)} data-testid={`button-delete-preparation-${output.id}`}><Trash2 size={14} /> Delete draft</button></div>
            </div>
          </details>;
        })}</div>}</section>
      </div>
    </>
  );
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="workspace-error"><Archive size={21} /><div><h2>Could not load this workspace.</h2><p>Your records are safe. Check the connection and try again.</p></div><button type="button" className="workspace-button workspace-button-quiet" onClick={retry} data-testid="button-retry-workspace"><RefreshCw size={15} /> Retry</button></div>;
}

export default function WorkspacePage() {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const view = getView(location);
  return (
    <div className="workspace-shell">
      <div className={`workspace-sidebar-wrap ${sidebarOpen ? 'workspace-sidebar-wrap-open' : ''}`}><WorkspaceSidebar view={view} onClose={() => setSidebarOpen(false)} /></div>
      {sidebarOpen && <button className="workspace-sidebar-overlay" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" data-testid="button-close-sidebar-overlay" />}
      <div className="workspace-main"><WorkspaceTopbar view={view} onMenu={() => setSidebarOpen(true)} /><main className="workspace-content">{view === 'overview' && <WorkbenchPage />}{view === 'jobs' && <JobsPage />}{view === 'match' && <MatchPage />}{view === 'prepare' && <PreparePage />}{view === 'studio' && <InterviewStudio />}{view === 'insights' && <PortfolioInsights />}</main></div>
    </div>
  );
}