import { describe, expect, it } from 'vitest';
import { portfolio } from '../data/portfolio';
import { portfolioViews } from './portfolio-view';
import { translationEntries } from './portfolio-translations';

describe('approved dual-career positioning', () => {
  it('gives both target roles explicit visibility without inventing employment', () => {
    expect(portfolio.targetRole).toBe('IT Recruiter & AI-Assisted Web Developer | Prompt Engineering');
    expect(portfolioViews.find((view) => view.value === 'recruiter')?.label).toBe('IT Recruiter');
    expect(portfolioViews.find((view) => view.value === 'technical')?.label).toBe('AI Web Developer');
    expect(portfolio.context).toContain('not prior job titles');
    expect(portfolio.experiences.map((entry) => entry.title)).toEqual([
      'Freelance Designer & AI Evaluation Specialist',
      'MERN Stack Web Developer',
      'Intern, Web Developer',
    ]);
    expect(portfolio.experiences[0].company).toBe('Handshake AI');
    expect(portfolio.experiences[0].dates).toBe('May 2026 – Present');
  });
  it('preserves documented dates, education and a separate current work sample', () => {
    expect(portfolio.experiences[1].dates).toBe('January 2026 – April 2026');
    expect(portfolio.experiences[2].dates).toBe('May 2025 – June 2025');
    expect(portfolio.education[0].result).toBe('CGPA 7.58 · SGPA 8.00');
    expect(portfolio.projects[0].name).toBe('MetroMart');
    expect(portfolio.projects[1].context).toContain('Not part of');
    expect(portfolio.projects[1].contribution).not.toContain('owner-only private workspace');
  });
  it('shows the eleven deduplicated, prompt-created Handshake AI profile projects and clear work types', async () => {
    const { featuredPromptProjects, promptProjects } = await import('../data/prompt-projects');
    expect(promptProjects).toHaveLength(11);
    expect(new Set(promptProjects.map((project) => project.id)).size).toBe(11);
    expect(featuredPromptProjects).toHaveLength(5);
    expect(promptProjects.every(({ url }) => url.startsWith('https://'))).toBe(true);
    expect(promptProjects.find(({ id }) => id === 'smarthire-ai')?.category).toBe('Presentation and guide');
    expect(promptProjects.find(({ id }) => id === 'quickdraw')?.platform).toContain('hosting');
    expect(promptProjects.find(({ id }) => id === 'targeted-resume-website')?.url).toBe(
      portfolio.projects[1].link,
    );
  });
  it('translates the new public positioning and work-sample evidence into both languages', () => {
    const sample = portfolio.projects[1];
    const strength = portfolio.strengths[3];
    const phrases = [
      portfolio.targetRole, portfolio.positioning, portfolio.context,
      strength.title, strength.detail, strength.proof,
      portfolio.experiences[0].title, ...portfolio.experiences[0].bullets,
      sample.name, sample.kind, sample.context, sample.problem, sample.contribution, sample.outcome,
      ...portfolioViews.flatMap((view) => [view.label, view.focus, view.evidence]),
    ];
    for (const phrase of phrases) {
      const translation = translationEntries.find(([english]) => english === phrase);
      expect(translation, `Missing translation: ${phrase}`).toBeDefined();
      expect(translation?.[1]).toBeTruthy();
      expect(translation?.[2]).toBeTruthy();
    }
  });
});
