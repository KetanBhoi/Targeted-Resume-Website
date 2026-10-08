import type { ApplicationPackSnapshot } from '@workspace/api-client-react';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import { parseApplicationPack } from './application-pack';

type FontName = 'NotoSans' | 'NotoHindi' | 'NotoGujarati';

/** Keep Indic syllables, combining marks and joiners together for fontkit shaping. */
export function pdfTextRuns(text: string): ContentText[] {
  const runs: ContentText[] = [];
  let previous: FontName = 'NotoSans';
  for (const char of text) {
    const font: FontName = /[\u0900-\u097f\u1cd0-\u1cff\ua8e0-\ua8ff]/u.test(char)
      ? 'NotoHindi'
      : /[\u0a80-\u0aff]/u.test(char) ? 'NotoGujarati'
        : /^[\p{Mark}\p{White_Space}\p{Punctuation}\p{Number}\u200c\u200d]$/u.test(char)
          ? previous : 'NotoSans';
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text = String(last.text) + char;
    else runs.push({ text: char, font });
    previous = font;
  }
  return runs.length ? runs : [{ text: '', font: 'NotoSans' }];
}

export function applicationPdfFilename(title: string): string {
  const name = title.normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80);
  return `${name || 'application-pack'}.pdf`;
}

export function buildApplicationPackPdf(input: ApplicationPackSnapshot): TDocumentDefinitions {
  // Apply the same allowlist/validation as ZIP exports, even if input has extra fields.
  const pack = parseApplicationPack(JSON.stringify(input));
  if (!pack) throw new Error('The application snapshot is incomplete.');
  const content: Content[] = [
    { text: 'APPLICATION PACK', color: '#59677a', fontSize: 9, characterSpacing: 1.8, margin: [0, 0, 0, 12] },
    { text: pdfTextRuns(pack.title), fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
    { text: `Snapshot: ${new Date(pack.createdAt).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')}`, fontSize: 8.5, color: '#59677a', margin: [0, 0, 0, 18] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.7, lineColor: '#d7dde5' }], margin: [0, 0, 0, 20] },
    { text: 'Resume', style: 'sectionHeading' },
    { text: pdfTextRuns(pack.resume.title), style: 'documentTitle' },
    { text: pdfTextRuns(pack.resume.content), margin: [0, 0, 0, 14] },
  ];
  if (pack.coverLetter) content.push(
    { text: 'Cover letter', style: 'sectionHeading', pageBreak: 'before' },
    { text: pdfTextRuns(pack.coverLetter.title), style: 'documentTitle' },
    { text: pdfTextRuns(pack.coverLetter.content), margin: [0, 0, 0, 14] },
  );
  content.push(
    { text: 'Recruiter brief', style: 'sectionHeading', pageBreak: 'before' },
    { text: pdfTextRuns(pack.brief), margin: [0, 0, 0, 20] },
  );
  if (pack.links.length) {
    content.push({ text: 'Supporting links', style: 'sectionHeading', headlineLevel: 1 });
    for (const link of pack.links) content.push({
      stack: [
        { text: pdfTextRuns(link.label), link: link.url, color: '#24528a', bold: true },
        { text: pdfTextRuns(link.url), link: link.url, color: '#59677a', fontSize: 9, margin: [0, 4, 0, 0] },
      ],
      unbreakable: true,
      margin: [0, 0, 0, 12],
    });
  }
  return {
    pageSize: 'A4',
    pageMargins: [48, 54, 48, 54],
    info: { title: pack.title, subject: 'Reviewed application documents', creator: 'Career workspace' },
    defaultStyle: { font: 'NotoSans', fontSize: 10.5, lineHeight: 1.35, color: '#1d2536' },
    styles: {
      sectionHeading: { fontSize: 17, bold: true, margin: [0, 0, 0, 12] },
      documentTitle: { fontSize: 11, bold: true, color: '#59677a', margin: [0, 0, 0, 14] },
    },
    content,
    footer: (page, count) => ({
      text: `${page} / ${count}`, alignment: 'right', fontSize: 8.5,
      color: '#59677a', margin: [48, 12, 48, 0],
    }),
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
  };
}
