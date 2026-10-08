import type { ApplicationPackSnapshot } from '@workspace/api-client-react';
import type { TFontDictionary } from 'pdfmake/interfaces';
import { applicationPdfFilename, buildApplicationPackPdf } from './application-pack-pdf-content';

const fontFiles = [
  'NotoSans-Regular.ttf', 'NotoSans-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf', 'NotoSansGujarati-Regular.ttf',
] as const;

export const applicationPdfFonts: TFontDictionary = {
  NotoSans: {
    normal: fontFiles[0], bold: fontFiles[1],
    italics: fontFiles[0], bolditalics: fontFiles[1],
  },
  NotoHindi: {
    normal: fontFiles[2], bold: fontFiles[2],
    italics: fontFiles[2], bolditalics: fontFiles[2],
  },
  NotoGujarati: {
    normal: fontFiles[3], bold: fontFiles[3],
    italics: fontFiles[3], bolditalics: fontFiles[3],
  },
};

let fontPromise: Promise<Record<string, string>> | undefined;

async function loadFonts(): Promise<Record<string, string>> {
  if (!fontPromise) {
    fontPromise = Promise.all(fontFiles.map(async (name) => {
      // Fonts are served by this artifact; document text never leaves the browser.
      const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`, {
        credentials: 'omit', cache: 'force-cache',
      });
      if (!response.ok) throw new Error('PDF font download failed.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1000 || bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) {
        throw new Error('PDF font file is unavailable.');
      }
      let binary = '';
      for (let start = 0; start < bytes.length; start += 8192) {
        binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      }
      return [name, btoa(binary)] as const;
    })).then((entries) => Object.fromEntries(entries)).catch((error: unknown) => {
      fontPromise = undefined; // A failed font request must remain retryable.
      throw error;
    });
  }
  return fontPromise;
}

export async function createApplicationPackPdfBlob(pack: ApplicationPackSnapshot): Promise<Blob> {
  const definition = buildApplicationPackPdf(pack);
  const [{ default: pdfMake }, vfs] = await Promise.all([
    import('pdfmake/build/pdfmake'), loadFonts(),
  ]);
  // Use the synchronous stream factory so layout/font errors are caught, not
  // thrown inside pdfmake's callback-only async API.
  const stream = pdfMake.createPdf(definition, {}, applicationPdfFonts, vfs).getStream();
  return new Promise<Blob>((resolve, reject) => {
    const chunks: ArrayBuffer[] = [];
    stream.on('data', (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk).buffer));
    stream.on('error', reject);
    stream.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
    stream.end();
  });
}

export async function downloadApplicationPackPdf(pack: ApplicationPackSnapshot): Promise<void> {
  const blob = await createApplicationPackPdfBlob(pack);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = applicationPdfFilename(pack.title);
    document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
