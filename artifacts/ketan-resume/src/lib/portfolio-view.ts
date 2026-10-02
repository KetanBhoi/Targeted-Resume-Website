export type PortfolioView = 'recruiter' | 'hiring-manager' | 'technical';
export const portfolioViews: { value: PortfolioView; label: string; focus: string; evidence: string }[] = [
  { value: 'recruiter', label: 'Recruiter', focus: 'Role fit and transferable strengths', evidence: 'Structured evaluation, organized operations, and technology fluency. Direct recruiting experience is not documented.' },
  { value: 'hiring-manager', label: 'Hiring manager', focus: 'Ownership and delivery', evidence: 'MetroMart vendor/customer modules and REST API integration; daily staff support and organized reports at Jinarth Infotech. No performance metrics are supplied.' },
  { value: 'technical', label: 'Technical reviewer', focus: 'Stack and implementation', evidence: 'MERN stack development, REST APIs, programming skills, and an IT degree. No source-code repository or live project link is supplied.' },
];

export function readPortfolioView(): PortfolioView {
  const value = new URLSearchParams(window.location.search).get('view');
  return portfolioViews.some((view) => view.value === value) ? value as PortfolioView : 'recruiter';
}

// Verified using the publishing service; never inferred from the development domain.
export const publicPortfolioUrl = 'https://targeted-resume-website.replit.app';