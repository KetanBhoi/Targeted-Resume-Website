import { useCallback, useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useResolveApplicationShare, type ResolvedApplicationShare } from '@workspace/api-client-react';
import ApplicationPackDownloads from '@/components/application-pack-downloads';
import '@/styles/application-sharing.css';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const readToken = () => {
  const fragment = window.location.hash.replace(/^#/, '');
  const state: unknown = window.history.state;
  const captured = state && typeof state === 'object' && 'careerApplicationShareToken' in state
    ? state.careerApplicationShareToken : '';
  return fragment || (typeof captured === 'string' ? captured : '');
};

function setMeta(name: string, content: string) {
  const prev = document.head.querySelector(`meta[name="${name}"]`);
  const prevContent = prev?.getAttribute('content') ?? null;
  const el = prev ?? document.createElement('meta');
  el.setAttribute('name', name);
  el.setAttribute('content', content);
  if (!prev) document.head.appendChild(el);
  return () => { if (prev) { if (prevContent !== null) prev.setAttribute('content', prevContent); } else el.remove(); };
}

export default function SharedApplication() {
  const [token, setToken] = useState(readToken);
  const [data, setData] = useState<ResolvedApplicationShare | null>(null);
  const [failure, setFailure] = useState<'invalid' | 'unavailable' | 'network' | null>(null);
  const latestRequest = useRef(0);
  const currentToken = useRef(token);
  const resolve = useResolveApplicationShare();
  const mutate = resolve.mutate;

  useEffect(() => {
    const undo = [setMeta('robots', 'noindex,nofollow,noarchive'), setMeta('referrer', 'no-referrer')];
    const onHash = () => {
      const next = readToken();
      if (next === currentToken.current) return;
      currentToken.current = next;
      latestRequest.current++;
      setData(null);
      setToken(next);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      latestRequest.current++;
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
      undo.forEach((u) => u());
    };
  }, []);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    setData(null);
    if (!TOKEN_RE.test(token)) { setFailure('invalid'); return; }
    setFailure(null);
    mutate({ data: { token } }, {
      onSuccess: (r) => { if (request === latestRequest.current) setData(r); },
      onError: (e) => {
        if (request !== latestRequest.current) return;
        const status = (e as { status?: number }).status;
        setFailure(status && status >= 400 && status < 500 ? 'unavailable' : 'network');
      },
    });
  }, [token, mutate]);

  useEffect(() => { load(); }, [load]);

  const pack = data?.pack;
  return (
    <main className="as-shared" data-testid="page-shared-application">
      <div>
        {!data && !failure && <div className="workspace-skeleton" data-testid="status-share-loading" aria-busy="true"><div className="workspace-skeleton-line workspace-skeleton-wide" /><div className="workspace-skeleton-card" /></div>}
        {failure && (
          <div className="workspace-error" role="alert" data-testid="status-share-error">
            <TriangleAlert aria-hidden="true" />
            <div>
              <h1 style={{ font: '500 23px var(--app-font-serif)', margin: 0 }}>{failure === 'network' ? 'Could not load this application' : 'This link is not available'}</h1>
              <p>{failure === 'invalid' ? 'The link is missing or incomplete. Ask the sender for a new one.' : failure === 'unavailable' ? 'It may be invalid, expired or revoked. Ask the sender for a new link.' : 'Check your connection and retry.'}</p>
            </div>
            {failure === 'network' && <button type="button" className="workspace-button workspace-button-dark" onClick={load} data-testid="button-retry-share">Retry</button>}
          </div>
        )}
        {data && pack && (
          <>
            <header>
              <p className="workspace-eyebrow"><span className="workspace-eyebrow-line" />Shared application pack</p>
              <h1 className="font-display" style={{ fontSize: 'clamp(2.2rem,5vw,3.6rem)', lineHeight: 1, margin: '12px 0' }} data-testid="text-share-title">{pack.title}</h1>
              <p className="as-note">Access expires {new Date(data.expiresAt).toLocaleString()}. Shared by link; no account needed.</p>
            </header>
            <div className="as-row">
              <ApplicationPackDownloads pack={pack} zipTestId="button-download-shared" pdfTestId="button-download-pdf-shared" />
            </div>
            <div className="as-preview">
              <h3>Resume — {pack.resume.title}</h3><pre data-testid="text-share-resume">{pack.resume.content}</pre>
              {pack.coverLetter && <><h3>Cover letter — {pack.coverLetter.title}</h3><pre data-testid="text-share-cover">{pack.coverLetter.content}</pre></>}
              {pack.brief && <><h3>Recruiter brief</h3><pre data-testid="text-share-brief">{pack.brief}</pre></>}
              {pack.links.length > 0 && <><h3>Supporting links</h3>
                <ul>{pack.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: 'underline' }}>{l.label || l.url}</a></li>)}</ul></>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
