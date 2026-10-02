import { describe, expect, it } from 'vitest';
import { blankOffer, buildOffer, DEFAULT_WEIGHTS, isHttps, weightedScore } from './career-tools';

describe('private offer comparison and source boundaries', () => {
  it('keeps unknown offer amounts null, distinct from an explicit zero', () => {
    const unknown = buildOffer({ ...blankOffer(), company: 'Fictional test company' });
    expect(unknown.ok).toBe(true);
    if (unknown.ok) {
      expect(unknown.metadata.annualSalary).toBeNull();
      expect(unknown.metadata.annualBonus).toBeNull();
      expect(unknown.metadata.hoursPerWeek).toBeNull();
    }
    const zero = buildOffer({ ...blankOffer(), company: 'Fictional test company', annualSalary: '0' });
    expect(zero.ok).toBe(true);
    if (zero.ok) expect(zero.metadata.annualSalary).toBe(0);
  });
  it('rejects impossible hours and non-finite or negative amounts', () => {
    for (const annualSalary of ['-1', 'Infinity', 'not an amount']) {
      expect(buildOffer({ ...blankOffer(), company: 'Test', annualSalary }).ok).toBe(false);
    }
    expect(buildOffer({ ...blankOffer(), company: 'Test', hoursPerWeek: '0' }).ok).toBe(false);
  });
  it('normalizes the weighted score to the judgment scale', () => {
    const ratings = { salary: 5, benefits: 4, location: 3, hours: 2, growth: 1 };
    expect(weightedScore(ratings, DEFAULT_WEIGHTS)).toBe(3);
    expect(weightedScore(ratings, { salary: '100', benefits: '0', location: '0', hours: '0', growth: '0' })).toBe(5);
  });
  it('does not score an invalid or zero-total priority selection', () => {
    const ratings = blankOffer().ratings;
    expect(weightedScore(ratings, { salary: '0', benefits: '0', location: '0', hours: '0', growth: '0' })).toBeNull();
    expect(weightedScore(ratings, { ...DEFAULT_WEIGHTS, salary: '-1' })).toBeNull();
    expect(weightedScore(ratings, { ...DEFAULT_WEIGHTS, salary: 'Infinity' })).toBeNull();
  });
  it('allows only HTTPS sources without embedded credentials', () => {
    expect(isHttps('https://example.com/source')).toBe(true);
    expect(isHttps('http://example.com/source')).toBe(false);
    expect(isHttps('https://name:password@example.com/source')).toBe(false);
    expect(isHttps('javascript:alert(1)')).toBe(false);
  });
});