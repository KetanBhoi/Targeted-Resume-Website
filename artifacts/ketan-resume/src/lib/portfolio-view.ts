export type PortfolioView = 'recruiter' | 'hiring-manager' | 'technical';
export const portfolioViews: { value: PortfolioView; label: string; focus: string; evidence: string }[] = [
  { value: 'recruiter', label: 'IT Recruiter', focus: 'Target role: structured evaluation and technology fluency', evidence: 'Career focus, not past employment. Structured evaluation skills, organized operations at Jinarth Infotech, and an IT degree with MERN development background. Direct recruiting experience is not documented.' },
  { value: 'hiring-manager', label: 'Hiring manager', focus: 'Ownership and delivery', evidence: 'MetroMart vendor/customer modules and REST API integration; daily staff support and organized reports at Jinarth Infotech. No performance metrics are supplied.' },
  { value: 'technical', label: 'AI Web Developer', focus: 'Target role: stack and prompt-driven building', evidence: 'Career focus, not past employment. MERN development on MetroMart at Haronex Technology, listed Prompt Engineering and LLM quality review skills, and this portfolio as a current work sample built through prompts in Replit. No source-code or live project link is supplied, and no AI employment is documented.' },
];

export function readPortfolioView(): PortfolioView {
  const value = new URLSearchParams(window.location.search).get('view');
  return portfolioViews.some((view) => view.value === value) ? value as PortfolioView : 'recruiter';
}

// Verified using the publishing service; never inferred from the development domain.
export const publicPortfolioUrl = 'https://targeted-resume-website.replit.app';