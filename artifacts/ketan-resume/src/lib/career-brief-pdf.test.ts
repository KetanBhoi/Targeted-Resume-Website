import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createCareerBriefPdf } from './career-brief-pdf';
import { portfolioViews } from './portfolio-view';

for (const view of portfolioViews) {
  it(`keeps the dual-career ${view.value} brief on one readable page`, async () => {
    const doc = await createCareerBriefPdf(view.value);
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = doc.output();
    expect(raw).toContain('IT Recruiter');
    expect(raw).toContain('Prompt Engineering');
    expect(raw).toContain('Current work sample');
    expect(raw).toContain('CGPA 7.58');
    writeFileSync(`/tmp/dual-career-brief-${view.value}.pdf`, Buffer.from(doc.output('arraybuffer')));
  });
}
