import { describe, expect, it } from 'vitest';
import type { ApplicationPackSnapshot } from '@workspace/api-client-react';
import { applicationPdfFilename, buildApplicationPackPdf, pdfTextRuns } from './application-pack-pdf-content';

const pack: ApplicationPackSnapshot = {
  title: 'Reviewed recruiting application',
  createdAt: '2026-10-08T07:00:00.000Z',
  resume: { title: 'Resume', content: 'English\nहिन्दी में भर्ती कौशल\nગુજરાતીમાં ભરતી કૌશલ્ય\n₹120,000' },
  coverLetter: { title: 'Cover letter', content: 'नमस्ते — મારી અરજી' },
  brief: 'A reviewed candidate brief.',
  links: [{ label: 'Portfolio', url: 'https://example.com/portfolio' }],
};

describe('PDF application snapshot', () => {
  it('preserves mixed-script text and Indic joiners while choosing shaping fonts', () => {
    const text = 'English क्षत्रिय क्‍ष ગુજરાતી ભરતી ₹120,000';
    const runs = pdfTextRuns(text);
    expect(runs.map((run) => run.text).join('')).toBe(text);
    expect(runs.some((run) => run.font === 'NotoHindi' && String(run.text).includes('क्‍ष'))).toBe(true);
    expect(runs.some((run) => run.font === 'NotoGujarati' && String(run.text).includes('ભરતી'))).toBe(true);
  });
  it('includes only the selected immutable documents and links', () => {
    const definition = buildApplicationPackPdf({
      ...pack, metadata: { privateNote: 'NEVER-EXPORT-THIS' },
    } as ApplicationPackSnapshot);
    const output = JSON.stringify(definition);
    const textOf = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map(textOf).join('');
      if (value && typeof value === 'object') {
        if ('text' in value) return textOf(value.text);
        if ('stack' in value) return textOf(value.stack);
      }
      return '';
    };
    const text = (definition.content as unknown[]).map(textOf).join('\n');
    for (const value of [pack.resume.content, pack.coverLetter!.content, pack.brief, pack.links[0].url]) {
      expect(text).toContain(value);
    }
    expect(output).toContain('हिन्दी में भर्ती कौशल');
    expect(output).toContain('ગુજરાતીમાં ભરતી કૌશલ્ય');
    expect(output).toContain(pack.brief);
    expect(output).toContain(pack.links[0].url);
    expect(output).not.toContain('NEVER-EXPORT-THIS');
  });
  it('omits an unselected cover letter without producing an empty section', () => {
    const definition = buildApplicationPackPdf({ ...pack, coverLetter: null, links: [] });
    expect(JSON.stringify(definition)).not.toContain('Cover letter');
    expect(JSON.stringify(definition)).not.toContain('Supporting links');
  });
  it('rejects malformed snapshots and unsafe supporting links', () => {
    expect(() => buildApplicationPackPdf({ ...pack, createdAt: 'invalid' })).toThrow();
    expect(() => buildApplicationPackPdf({ ...pack, links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] })).toThrow();
  });
  it('uses safe filenames while retaining Hindi and Gujarati names', () => {
    expect(applicationPdfFilename('../ગુજરાતી અરજી')).toBe('ગુજરાતી-અરજી.pdf');
    expect(applicationPdfFilename('अर्ज़ी')).toMatch(/\.pdf$/);
    expect(applicationPdfFilename('////')).toBe('application-pack.pdf');
  });
});
