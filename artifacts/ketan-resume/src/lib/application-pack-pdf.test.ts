import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import type { ApplicationPackSnapshot } from '@workspace/api-client-react';
import { createApplicationPackPdfBlob } from './application-pack-pdf';

afterEach(() => vi.unstubAllGlobals());

it('recovers from font failures and generates a real multi-page PDF with embedded shaping fonts', async () => {
  let fail = true;
  vi.stubGlobal('fetch', async (input: string) => {
    if (fail && input.endsWith('NotoSansGujarati-Regular.ttf')) return new Response('', { status: 503 });
    const name = input.split('/').pop()!;
    const bytes = readFileSync(new URL(`../../public/fonts/${name}`, import.meta.url));
    return new Response(new Uint8Array(bytes));
  });
  const pack: ApplicationPackSnapshot = {
    title: 'TEST PDF — Mixed-language application',
    createdAt: '2026-10-08T07:00:00.000Z',
    resume: {
      title: 'Synthetic resume — not a real applicant',
      content: 'Synthetic sample. Not real professional experience.\n₹120,000\n'
        + Array.from({ length: 35 }, (_, n) => `Sample ${n + 1}. हिन्दी: भर्ती, उम्मीदवारों का चयन और साक्षात्कार। ગુજરાતી: ભરતી, ઉમેદવારોની પસંદગી અને કૌશલ્ય.`).join('\n'),
    },
    coverLetter: { title: 'Synthetic cover letter', content: 'नमस्ते\nઆ એક કલ્પિત આવરણપત્ર છે.\nThis cover letter is a synthetic test.' },
    brief: 'This is a synthetic recruiter brief, not applicant facts.',
    links: [{ label: 'Sample proof', url: 'https://example.com/portfolio' }],
  };
  await expect(createApplicationPackPdfBlob(pack)).rejects.toThrow('PDF font download failed');
  fail = false;
  const blob = await createApplicationPackPdfBlob(pack);
  const bytes = Buffer.from(await blob.arrayBuffer());
  expect(blob.type).toBe('application/pdf');
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10_000);
  const raw = bytes.toString('latin1');
  expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  expect(raw).toContain('/FontFile2');
  expect(raw).toContain('/ToUnicode');
  writeFileSync('/tmp/application-pack-pdf-verification.pdf', bytes);
}, 20_000);
