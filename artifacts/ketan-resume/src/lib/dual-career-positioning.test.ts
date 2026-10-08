import { describe, expect, it } from 'vitest';
import { portfolio } from '../data/portfolio';
import { portfolioViews } from './portfolio-view';
import { translationEntries } from './portfolio-translations';

describe('approved dual-career positioning', () => {
  it('gives both target roles explicit visibility without inventing employment', () => {
    expect(portfolio.targetRole).toBe('IT Recruiter & AI-Assisted Web Developer | Prompt Engineering');
    expect(portfolioViews.find((view) => view.value === 'recruiter')?.label).toBe('IT Recruiter');
    expect(portfolioViews.find((view) => view.value === 'technical')?.label).toBe('AI Web Developer');
    expect(portfolio.context).toContain('not past employment');
    expect(portfolio.experiences.map((entry) => entry.title)).toEqual(['MERN Stack Web Developer', 'Intern, Web Developer']);
  });
  it('preserves documented dates, education and a separate current work sample', () => {
    expect(portfolio.experiences[0].dates).toBe('January 2026 – April 2026');
    expect(portfolio.experiences[1].dates).toBe('May 2025 – June 2025');
    expect(portfolio.education[0].result).toBe('CGPA 7.58 · SGPA 8.00');
    expect(portfolio.projects[0].name).toBe('MetroMart');
    expect(portfolio.projects[1].context).toContain('Not part of');
    expect(portfolio.projects[1].contribution).not.toContain('owner-only private workspace');
  });
  it('translates the new public positioning and work-sample evidence into both languages', () => {
    const sample = portfolio.projects[1];
    const strength = portfolio.strengths[3];
    const phrases = [
      portfolio.targetRole, portfolio.positioning, portfolio.context,
      strength.title, strength.detail, strength.proof,
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
