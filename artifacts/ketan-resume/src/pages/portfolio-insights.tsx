import { useState } from 'react';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import {
  getListPortfolioFeedbackQueryKey,
  getGetPortfolioOwnerAccessQueryKey,
  useDeletePortfolioFeedback,
  useGetPortfolioOwnerAccess,
  useListPortfolioFeedback,
} from '@workspace/api-client-react';

const events = [
  ['role_view_changed', 'A visitor switches the role view.'],
  ['section_viewed', 'A portfolio section scrolls into view.'],
  ['resume_downloaded', 'The resume file is downloaded.'],
  ['contact_clicked', 'A contact link is clicked.'],
  ['feedback_submitted', 'A private note is sent successfully.'],
  ['brief_downloaded', 'The brief PDF is downloaded.'],
  ['brief_link_copied', 'The brief share link is copied.'],
];

export default function PortfolioInsights() {
  const { isLoaded, isSignedIn } = useUser();
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const access = useGetPortfolioOwnerAccess({ query: { queryKey: getGetPortfolioOwnerAccessQueryKey(), enabled: isSignedIn === true, retry: false, staleTime: 0 } });
  const owner = access.data?.isOwner === true;
  const list = useListPortfolioFeedback({ query: { enabled: owner === true, queryKey: getListPortfolioFeedbackQueryKey() } });
  const del = useDeletePortfolioFeedback();

  function remove(id: number) {
    del.mutate({ id }, {
      onSuccess: () => { setConfirmId(null); qc.invalidateQueries({ queryKey: getListPortfolioFeedbackQueryKey() }); },
    });
  }

  let body;
  if (!isLoaded || (isSignedIn && access.isLoading)) {
    body = <div className="h-32 animate-pulse rounded-lg bg-muted" data-testid="status-insights-loading" />;
  } else if (!isSignedIn) {
    body = <p className="text-sm" data-testid="status-insights-signin">Sign in with the owner account to view private notes.</p>;
  } else if (access.isError) {
    body = <p className="text-sm text-destructive" role="alert" data-testid="status-access-error">Access could not be verified. <button className="font-semibold underline" onClick={() => access.refetch()} data-testid="button-access-retry">Retry</button></p>;
  } else if (!owner) {
    body = <p className="flex items-center gap-2 text-sm" data-testid="status-access-denied"><ShieldAlert className="h-5 w-5" /> Access denied. This signed-in account is not the portfolio owner, so private notes are not shown.</p>;
  } else {
    const items = list.data ?? [];
    body = (
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" data-testid="text-feedback-count">Showing the newest 100 notes at most. Loaded: {items.length}.</p>
          <button onClick={() => list.refetch()} disabled={list.isFetching} data-testid="button-feedback-refetch" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"><RefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
        {list.isLoading && <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" data-testid="status-feedback-loading" />}
        {list.isError && <p className="mt-4 text-sm text-destructive" role="alert" data-testid="status-feedback-error">Notes could not be loaded. <button className="font-semibold underline" onClick={() => list.refetch()} data-testid="button-feedback-retry">Retry</button></p>}
        {list.isSuccess && items.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="status-feedback-empty">No private notes yet. Notes sent from the portfolio will appear here.</p>}
        <ul className="mt-4 grid gap-3">
          {items.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-card p-4" data-testid={`card-feedback-${n.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{n.roleView} view - {n.signal} - {new Date(n.createdAt).toLocaleString()}</span>
                {confirmId === n.id ? (
                  <span className="flex gap-2">
                    <button onClick={() => remove(n.id)} disabled={del.isPending} data-testid={`button-confirm-delete-${n.id}`} className="font-semibold text-destructive">Confirm delete</button>
                    <button onClick={() => setConfirmId(null)} data-testid={`button-cancel-delete-${n.id}`}>Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(n.id)} data-testid={`button-delete-${n.id}`} aria-label="Delete note"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{n.message}</p>
            </li>
          ))}
        </ul>
        {del.isError && <p className="mt-3 text-sm text-destructive" role="alert" data-testid="status-delete-error">The note could not be deleted. Please retry.</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10" data-testid="page-portfolio-insights">
      <Link href="/portfolio" data-testid="link-insights-back" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Portfolio</Link>
      <h1 className="mt-6 text-3xl font-semibold">Portfolio insights</h1>
      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Portfolio analytics are private and live in Replit Publishing analytics. They populate only after analytics is enabled and the portfolio is republished. No figures are shown here.</p>
        <ul className="mt-4 grid gap-1 text-sm">
          {events.map(([name, desc]) => <li key={name}><code className="font-mono text-xs">{name}</code> - {desc}</li>)}
        </ul>
      </section>
      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Private notes</h2>
        {body}
      </section>
    </div>
  );
}
