import { useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  FlaskConical,
  Layers3,
  Link2,
  LogOut,
  Menu,
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
  getListWorkspaceRecordsQueryKey,
  useCreateWorkspaceRecord,
  useDeleteWorkspaceRecord,
  useGenerateWorkspaceContent,
  useListWorkspaceRecords,
  useUpdateWorkspaceRecord,
  type WorkspaceRecord,
  type WorkspaceRecordKind,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';

type WorkspaceView = 'overview' | 'jobs' | 'match' | 'prepare';
type Meta = Record<string, unknown>;
type RecordKind = WorkspaceRecordKind;

const viewCopy: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
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
];

function getView(path: string): WorkspaceView {
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

function WorkspaceSidebar({ view, onClose }: { view: WorkspaceView; onClose: () => void }) {
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
        {navItems.map((item) => {
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
  const { createRecord, updateRecord } = useWorkspaceRecords();
  const [title, setTitle] = useState(record?.title ?? '');
  const [content, setContent] = useState(record?.content ?? '');
  const [company, setCompany] = useState(readString(record?.metadata, 'company'));
  const [status, setStatus] = useState(readString(record?.metadata, 'status') || (kind === 'job' ? 'Saved' : 'Draft'));
  const [deadline, setDeadline] = useState(readString(record?.metadata, 'deadline'));
  const [url, setUrl] = useState(readString(record?.metadata, 'url'));
  const [error, setError] = useState('');
  const isPending = createRecord.isPending || updateRecord.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Add a title and some content before saving.');
      return;
    }
    setError('');
    const metadata: Meta = {
      ...(record?.metadata ?? {}),
      ...(kind === 'job' ? { company, status, deadline, reminderAt: deadline, url } : { status }),
    };
    const onSuccess = () => { onSaved(); onClose(); };
    if (record) {
      updateRecord.mutate({ id: record.id, data: { title: title.trim(), content, metadata } }, { onSuccess, onError: () => setError('Could not save this change. Try again.') });
    } else {
      createRecord.mutate({ data: { kind, title: title.trim(), content, metadata } }, { onSuccess, onError: () => setError('Could not save this record. Try again.') });
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
            <label><span>Next reminder</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} data-testid="input-job-deadline" /></label>
            <label><span>Job URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" data-testid="input-job-url" /></label>
          </div>}
          <label><span>{kind === 'resume' ? 'Resume text' : 'Notes / job description'}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={kind === 'resume' ? 12 : 8} placeholder={kind === 'resume' ? 'Paste the full resume text for this version.' : 'Capture the role, requirements, notes, and next step.'} data-testid="textarea-record-content" /></label>
          {error && <p className="workspace-form-error" role="alert">{error}</p>}
          <div className="workspace-modal-actions"><button type="button" className="workspace-button workspace-button-quiet" onClick={onClose} data-testid="button-cancel-record">Cancel</button><button type="submit" className="workspace-button workspace-button-dark" disabled={isPending} data-testid="button-save-record">{isPending ? 'Saving…' : 'Save record'} <ArrowRight size={15} /></button></div>
        </form>
      </div>
    </div>
  );
}

function ResumeVersionCard({ record, selected, onSelect, onEdit, onDelete }: { record: WorkspaceRecord; selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  const status = readString(record.metadata, 'status') || 'Draft';
  return (
    <article className={`workspace-record-card ${selected ? 'workspace-record-card-selected' : ''}`} data-testid={`card-resume-${record.id}`}>
      <button type="button" className="workspace-record-select" onClick={onSelect} data-testid={`button-select-resume-${record.id}`}>
        <span className="workspace-record-icon"><FileText size={18} /></span>
        <span className="workspace-record-main"><strong>{record.title}</strong><small>Updated {formatDate(record.updatedAt)}</small></span>
        <ChevronDown size={15} className={selected ? 'workspace-chevron-up' : ''} />
      </button>
      <div className="workspace-record-meta"><StatusPill status={status} /><span>{record.content.length.toLocaleString()} characters</span></div>
      {selected && <div className="workspace-record-expanded"><p>{record.content.slice(0, 230)}{record.content.length > 230 ? '…' : ''}</p><div><button type="button" className="workspace-text-button" onClick={onEdit} data-testid={`button-edit-resume-${record.id}`}>Edit <ArrowRight size={13} /></button><button type="button" className="workspace-delete-button" onClick={onDelete} data-testid={`button-delete-resume-${record.id}`}><Trash2 size={14} /> Delete</button></div></div>}
    </article>
  );
}

function ResumeCompare({ records }: { records: WorkspaceRecord[] }) {
  const [aId, setAId] = useState(records[0]?.id ?? 0);
  const [bId, setBId] = useState(records[1]?.id ?? records[0]?.id ?? 0);
  const a = records.find((record) => record.id === aId);
  const b = records.find((record) => record.id === bId);
  if (records.length < 2) return <div className="workspace-compare workspace-compare-empty"><div className="workspace-compare-title"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Side-by-side review</span><h2>Compare when the second version is ready.</h2></div><FlaskConical size={22} /></div><p>Two saved resume versions make trade-offs visible before an application goes out.</p></div>;
  return (
    <section className="workspace-compare">
      <div className="workspace-compare-title"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Side-by-side review</span><h2>A / B, without the guesswork.</h2></div><span className="workspace-compare-label"><span className="workspace-compare-dot workspace-compare-dot-a" />A <span className="workspace-compare-dot workspace-compare-dot-b" />B</span></div>
      <div className="workspace-compare-selects"><label><span>Version A</span><select value={aId} onChange={(event) => setAId(Number(event.target.value))} data-testid="select-compare-a">{records.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></label><ArrowRight size={15} /><label><span>Version B</span><select value={bId} onChange={(event) => setBId(Number(event.target.value))} data-testid="select-compare-b">{records.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></label></div>
      <div className="workspace-compare-columns"><div><div className="workspace-compare-column-head"><b>A</b><strong>{a?.title}</strong></div><p>{a?.content}</p></div><div><div className="workspace-compare-column-head"><b>B</b><strong>{b?.title}</strong></div><p>{b?.content}</p></div></div>
    </section>
  );
}

function WorkbenchPage() {
  const { recordsQuery, deleteRecord } = useWorkspaceRecords();
  const [modal, setModal] = useState<'new' | WorkspaceRecord | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const onDelete = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="overview" action={<button type="button" className="workspace-button workspace-button-dark" onClick={() => setModal('new')} data-testid="button-new-resume"><Plus size={16} /> New resume version</button>} />
      <div className="workspace-overview-grid">
        <section className="workspace-panel workspace-resume-panel">
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Resume library</span><h2>Versions that remember the why.</h2></div><span className="workspace-count">{resumes.length.toString().padStart(2, '0')}</span></div>
          {resumes.length === 0 ? <EmptyState title="Your first version belongs here." body="Keep the resume text you trust, then tailor from a clear starting point." action={<button type="button" className="workspace-text-button" onClick={() => setModal('new')} data-testid="button-empty-new-resume">Add a version <ArrowRight size={13} /></button>} /> : <div className="workspace-record-list">{resumes.map((record) => <ResumeVersionCard key={record.id} record={record} selected={selected === record.id} onSelect={() => setSelected(selected === record.id ? null : record.id)} onEdit={() => setModal(record)} onDelete={() => onDelete(record)} />)}</div>}
        </section>
        <section className="workspace-panel workspace-history-panel">
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Change history</span><h2>Recent decisions.</h2></div><Clock3 size={19} /></div>
          {resumes.length === 0 ? <EmptyState title="Changes will show here." body="Every saved version becomes a quiet trail of how the story evolves." /> : <div className="workspace-history-list">{resumes.slice(0, 5).map((record, index) => <div className="workspace-history-item" key={record.id}><span className="workspace-history-marker">{index === 0 ? <Check size={12} /> : <span />}</span><div><strong>{record.title}</strong><p>{index === 0 ? 'Latest saved version' : 'Resume version saved'}</p></div><time>{formatShortDate(record.updatedAt)}</time></div>)}</div>}
          <div className="workspace-panel-foot"><Link href="/workspace/match" className="workspace-text-button" data-testid="link-history-match">Use a version for role match <ArrowRight size={13} /></Link></div>
        </section>
      </div>
      <ResumeCompare records={resumes} />
      {modal && <RecordModal kind="resume" record={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} onSaved={() => recordsQuery.refetch()} />}
    </>
  );
}

function JobsPage() {
  const { recordsQuery, deleteRecord } = useWorkspaceRecords();
  const [modal, setModal] = useState<'new' | WorkspaceRecord | null>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const jobs = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'job'), [recordsQuery.data]);
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
        {filtered.length === 0 ? <EmptyState title={jobs.length === 0 ? 'No applications tracked yet.' : 'Nothing in this lane.'} body={jobs.length === 0 ? 'Add a role when it feels worth a considered next step.' : 'Try another status to find the application you are looking for.'} action={jobs.length === 0 ? <button type="button" className="workspace-text-button" onClick={() => setModal('new')} data-testid="button-empty-new-job">Add application <ArrowRight size={13} /></button> : undefined} /> : <div className="workspace-job-table"><div className="workspace-job-row workspace-job-header"><span>Role</span><span>Status</span><span>Next reminder</span><span>Saved</span><span /></div>{filtered.map((job) => { const status = readString(job.metadata, 'status') || 'Saved'; const deadline = readString(job.metadata, 'deadline') || readString(job.metadata, 'reminderAt'); return <div className="workspace-job-row" key={job.id} data-testid={`row-job-${job.id}`}><div className="workspace-job-title"><span className="workspace-company-mark">{(readString(job.metadata, 'company') || job.title).slice(0, 1).toUpperCase()}</span><span><strong>{job.title}</strong><small>{readString(job.metadata, 'company') || 'Company not added'}</small></span></div><StatusPill status={status} /><span className={deadline && new Date(deadline) < new Date() ? 'workspace-date-overdue' : ''}>{deadline ? <><CalendarClock size={14} />{formatDate(deadline)}</> : 'No reminder'}</span><span>{formatShortDate(job.createdAt)}</span><div className="workspace-row-actions"><button type="button" className="workspace-icon-button" onClick={() => setModal(job)} data-testid={`button-edit-job-${job.id}`} aria-label={`Edit ${job.title}`}><FileText size={15} /></button><button type="button" className="workspace-icon-button workspace-danger-icon" onClick={() => onDelete(job)} data-testid={`button-delete-job-${job.id}`} aria-label={`Delete ${job.title}`}><Trash2 size={15} /></button></div></div>; })}</div>}
      </section>
      <div className="workspace-job-note"><CalendarClock size={17} /><p>Set a reminder while the next step is fresh. Dates are stored with the application, not in a separate task list.</p></div>
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

function AnalysisResult({ analysis, onDelete }: { analysis: WorkspaceRecord; onDelete: () => void }) {
  const metadata = (analysis.metadata ?? {}) as Meta;
  const fitScore = readNumber(metadata, 'fitScore');
  const recommendation = readString(metadata, 'recommendation');

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

function MatchPage() {
  const { recordsQuery, generateContent, deleteRecord } = useWorkspaceRecords();
  const [resumeId, setResumeId] = useState(0);
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const analyses = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'analysis'), [recordsQuery.data]);
  const selectedResume = resumes.find((record) => record.id === resumeId) ?? resumes[0];
  const analyze = (event: FormEvent) => { event.preventDefault(); if (!selectedResume || !description.trim() || generateContent.isPending) return; generateContent.mutate({ data: { kind: 'analysis', title: title.trim() || 'Role match analysis', resumeText: selectedResume.content, jobDescription: description.trim() } }, { onSuccess: () => recordsQuery.refetch() }); };
  const removeAnalysis = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="match" />
      <div className="workspace-match-layout">
        <form className="workspace-panel workspace-match-form" onSubmit={analyze}>
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />New analysis</span><h2>Bring the role in.</h2></div><BarChart3 size={19} /></div>
          {resumes.length === 0 ? <EmptyState title="Save a resume first." body="The match lens needs a real version of your resume as its source." action={<Link href="/workspace" className="workspace-text-button" data-testid="link-match-add-resume">Go to resume library <ArrowRight size={13} /></Link>} /> : <><label><span>Resume version</span><select value={selectedResume?.id ?? 0} onChange={(event) => setResumeId(Number(event.target.value))} data-testid="select-match-resume">{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label><label><span>Role or company label <em>Optional</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Talent acquisition associate" data-testid="input-match-title" /></label><label><span>Job description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={13} placeholder="Paste the job description here. The analysis stays attached to your account." data-testid="textarea-job-description" /></label><div className="workspace-form-footer"><span>{selectedResume?.content.length.toLocaleString() ?? 0} resume characters selected</span><button type="submit" className="workspace-button workspace-button-dark" disabled={!description.trim() || generateContent.isPending} data-testid="button-run-match">{generateContent.isPending ? 'Reading role…' : 'Run match'} <ArrowRight size={15} /></button></div>{generateContent.isError && <p className="workspace-form-error">The analysis could not be generated. Try again.</p>}</>}
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
                  onDelete={() => removeAnalysis(analysis)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const generationOptions: { kind: 'interview' | 'cover-letter' | 'linkedin'; label: string; description: string; icon: ComponentType<{ size?: number }> }[] = [
  { kind: 'interview', label: 'Interview questions', description: 'Build grounded answers from the resume and role.', icon: MessageIcon },
  { kind: 'cover-letter', label: 'Cover letter', description: 'Draft a specific letter without making claims up.', icon: Send },
  { kind: 'linkedin', label: 'LinkedIn content', description: 'Shape a concise post or outreach note.', icon: Link2 },
];

function MessageIcon({ size }: { size?: number }) {
  return <span className="workspace-message-icon" style={{ width: size ?? 17 }}><span /><span /><span /></span>;
}

function PreparePage() {
  const { recordsQuery, generateContent, deleteRecord } = useWorkspaceRecords();
  const [kind, setKind] = useState<'interview' | 'cover-letter' | 'linkedin'>('interview');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const resumes = useMemo(() => (recordsQuery.data ?? []).filter((record) => record.kind === 'resume'), [recordsQuery.data]);
  const outputs = useMemo(() => (recordsQuery.data ?? []).filter((record) => ['interview', 'cover-letter', 'linkedin'].includes(record.kind)), [recordsQuery.data]);
  const selected = generationOptions.find((option) => option.kind === kind) ?? generationOptions[0];
  const generate = (event: FormEvent) => { event.preventDefault(); if (!resumes[0] || generateContent.isPending) return; generateContent.mutate({ data: { kind, title: title.trim() || selected.label, resumeText: resumes[0].content, jobDescription: jobDescription.trim() || undefined, instructions: instructions.trim() || undefined } }, { onSuccess: () => { recordsQuery.refetch(); setInstructions(''); } }); };
  const removeOutput = (record: WorkspaceRecord) => { if (window.confirm(`Delete ${record.title}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => recordsQuery.refetch() }); };
  if (recordsQuery.isLoading) return <PageSkeleton />;
  if (recordsQuery.isError) return <ErrorState retry={() => recordsQuery.refetch()} />;
  return (
    <>
      <WorkspaceHeader view="prepare" />
      <div className="workspace-prepare-layout">
        <form className="workspace-panel workspace-prepare-form" onSubmit={generate}>
          <div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Make something useful</span><h2>Start with the format.</h2></div><Sparkles size={19} /></div>
          {resumes.length === 0 ? <EmptyState title="A resume is the starting point." body="Save one in the workbench before generating preparation material." action={<Link href="/workspace" className="workspace-text-button" data-testid="link-prepare-add-resume">Save a resume <ArrowRight size={13} /></Link>} /> : <><div className="workspace-generation-options">{generationOptions.map((option) => { const Icon = option.icon; return <button key={option.kind} type="button" className={kind === option.kind ? 'workspace-generation-option workspace-generation-option-active' : 'workspace-generation-option'} onClick={() => setKind(option.kind)} data-testid={`button-generate-${option.kind}`}><Icon size={17} /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>; })}</div><label><span>Working title <em>Optional</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selected.label} data-testid="input-prepare-title" /></label><label><span>Role context <em>Optional</em></span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={6} placeholder="Paste the job description or context for this draft." data-testid="textarea-prepare-context" /></label><label><span>Direction <em>Optional</em></span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder="What should feel especially like you?" data-testid="textarea-prepare-instructions" /></label><div className="workspace-form-footer"><span>Source: {resumes[0].title}</span><button type="submit" className="workspace-button workspace-button-dark" disabled={generateContent.isPending} data-testid="button-submit-preparation">{generateContent.isPending ? 'Working…' : 'Generate draft'} <Sparkles size={15} /></button></div>{generateContent.isError && <p className="workspace-form-error">This draft could not be generated. Try again.</p>}</>}
        </form>
        <section className="workspace-panel workspace-output-panel"><div className="workspace-panel-head"><div><span className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Saved preparation</span><h2>Material worth revisiting.</h2></div><span className="workspace-count">{outputs.length.toString().padStart(2, '0')}</span></div>{outputs.length === 0 ? <EmptyState title="Your preparation desk is clear." body="Generated interview answers, letters, and LinkedIn drafts will stay here." /> : <div className="workspace-output-list">{outputs.map((output) => <details key={output.id} className="workspace-output-item"><summary><span className="workspace-output-kind">{output.kind.replace('-', ' ')}</span><span><strong>{output.title}</strong><small>Updated {formatDate(output.updatedAt)}</small></span><ChevronDown size={15} /></summary><div className="workspace-output-content">{output.content}<button type="button" className="workspace-delete-button workspace-output-delete" onClick={() => removeOutput(output)} data-testid={`button-delete-preparation-${output.id}`}><Trash2 size={14} /> Delete draft</button></div></details>)}</div>}</section>
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
      <div className="workspace-main"><WorkspaceTopbar view={view} onMenu={() => setSidebarOpen(true)} /><main className="workspace-content">{view === 'overview' && <WorkbenchPage />}{view === 'jobs' && <JobsPage />}{view === 'match' && <MatchPage />}{view === 'prepare' && <PreparePage />}</main></div>
    </div>
  );
}