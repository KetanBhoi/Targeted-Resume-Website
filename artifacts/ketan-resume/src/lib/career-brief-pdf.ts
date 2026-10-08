import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { portfolio } from '../data/portfolio';
import { portfolioViews, publicPortfolioUrl, type PortfolioView } from './portfolio-view';

export const careerBriefLimitation = 'Limitations: career focus and target roles, not past employment. The resume documents no performance metrics, no direct recruiting experience, and no prior AI employment.';
export const careerBriefUrl = (view: PortfolioView) => `${publicPortfolioUrl}/brief?view=${view}`;

/** A concise, one-page English brief; leave room for the QR only in the header. */
export async function createCareerBriefPdf(view: PortfolioView): Promise<jsPDF> {
  const cfg = portfolioViews.find((entry) => entry.value === view) ?? portfolioViews[0];
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 42;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const write = (text: string, size = 9.1, bold = false, gap = 4, available = width) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, available) as string[];
    doc.text(lines, margin, y + size);
    y += lines.length * (size + 2.4) + gap;
  };
  doc.setProperties({ title: `${portfolio.name} — Career brief`, subject: portfolio.targetRole });
  write(portfolio.name, 19, true, 3, width - 105);
  write(`${portfolio.targetRole} — ${cfg.label} view`, 10.2, false, 6, width - 105);
  write(portfolio.positioning, 9.1, false, 6, width - 105);
  y = Math.max(y, margin + 108);
  write('Focus evidence', 10.5, true, 3);
  write(`${cfg.focus}. ${cfg.evidence}`, 9.1, false, 7);
  write('Relevant work', 10.5, true, 3);
  portfolio.experiences.forEach((entry) =>
    write(`${entry.title}, ${entry.company} (${entry.dates}). ${entry.bullets[0]}`, 9.1, false, 4));
  write('Current work sample (not employment)', 10.5, true, 3);
  const sample = portfolio.projects.find((project) => project.name === 'This portfolio (current work sample)');
  if (sample) write(`${sample.name}. ${sample.contribution}`, 9.1, false, 7);
  write('Education', 10.5, true, 3);
  portfolio.education.forEach((entry) => write(
    `${entry.credential}, ${entry.institution}, ${entry.completed}${entry.result ? ` (${entry.result})` : ''}`,
    9.1, false, 4,
  ));
  write('Skills', 10.5, true, 3);
  // Avoid repeating identical skills across the two related AI skill groups.
  const skills = [...new Set(portfolio.skills.flatMap((group) => group.items))];
  write(skills.join(', '), 8.8, false, 7);
  write(careerBriefLimitation, 9.1, true, 8);
  const links = [{ label: 'Portfolio', url: publicPortfolioUrl }];
  if (portfolio.publicLinks.linkedin) links.push({ label: 'LinkedIn', url: portfolio.publicLinks.linkedin });
  if (portfolio.publicContact) links.push({ label: 'Email', url: portfolio.publicContact.url });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(30, 70, 150);
  for (const link of links) {
    doc.textWithLink(`${link.label}: ${link.url.replace('mailto:', '')}`, margin, y + 9, { url: link.url });
    y += 14;
  }
  const qr = await QRCode.toDataURL(careerBriefUrl(view), { margin: 1, width: 300 });
  const qrX = doc.internal.pageSize.getWidth() - margin - 84;
  doc.addImage(qr, 'PNG', qrX, margin, 84, 84);
  doc.setTextColor(0);
  doc.setFontSize(7);
  doc.text('Scan for live brief', qrX, margin + 96);
  if (y > doc.internal.pageSize.getHeight() - margin) throw new Error('Brief exceeds one page');
  return doc;
}
