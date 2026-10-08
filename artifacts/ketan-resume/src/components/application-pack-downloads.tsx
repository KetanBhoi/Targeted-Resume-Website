import { useRef, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { ApplicationPackSnapshot } from '@workspace/api-client-react';
import { downloadApplicationPack } from '@/lib/application-pack';

export default function ApplicationPackDownloads({ pack, zipTestId, pdfTestId }: {
  pack: ApplicationPackSnapshot | null;
  zipTestId: string;
  pdfTestId: string;
}) {
  const [busy, setBusy] = useState<'pdf' | 'zip' | null>(null);
  const [error, setError] = useState('');
  const inProgress = useRef(false);

  const download = async (format: 'pdf' | 'zip') => {
    if (!pack || inProgress.current) return;
    inProgress.current = true;
    setBusy(format);
    setError('');
    try {
      if (format === 'pdf') {
        const { downloadApplicationPackPdf } = await import('@/lib/application-pack-pdf');
        await downloadApplicationPackPdf(pack);
      } else await downloadApplicationPack(pack);
    } catch {
      setError(format === 'pdf'
        ? 'PDF could not be created. Check your connection so the embedded fonts can load, then retry.'
        : 'ZIP download failed. Please retry.');
    } finally {
      inProgress.current = false;
      setBusy(null);
    }
  };

  return (
    <>
      <button type="button" className="workspace-button workspace-button-dark"
        disabled={!pack || busy !== null} aria-busy={busy === 'pdf'} data-testid={pdfTestId}
        onClick={() => { void download('pdf'); }}>
        {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
        {busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      <button type="button" className="workspace-button workspace-button-quiet"
        disabled={!pack || busy !== null} aria-busy={busy === 'zip'} data-testid={zipTestId}
        onClick={() => { void download('zip'); }}>
        <Download size={14} aria-hidden="true" />
        {busy === 'zip' ? 'Preparing ZIP…' : 'Download ZIP (text)'}
      </button>
      {error && <p className="as-err" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
    </>
  );
}
