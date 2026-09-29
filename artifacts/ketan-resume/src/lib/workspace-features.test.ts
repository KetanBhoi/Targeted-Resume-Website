import { describe, expect, it } from 'vitest';
import {
  buildKeywordPreview,
  canonicalJobDescription,
  diffResumeText,
  highlightKeywordText,
  missingBatchJobIds,
  readInterviewQuestions,
  readKeywordHeatmap,
} from './workspace-features';

describe('workspace feature helpers', () => {
  it('reports exact additions and removals when comparing resume versions', () => {
    expect(diffResumeText('Built dashboards\nUsed SQL\n', 'Built dashboards\nUsed Python\n')).toEqual([
      { type: 'unchanged', text: 'Built dashboards\n' },
      { type: 'removed', text: 'Used SQL\n' },
      { type: 'added', text: 'Used Python\n' },
    ]);
  });

  it('labels job terms as strong, partial, or missing from resume evidence', () => {
    const preview = buildKeywordPreview('Python Python SQL Power BI', 'Python and Power BI');
    expect(preview.find((item) => item.term === 'python')?.status).toBe('partial');
    expect(preview.find((item) => item.term === 'power')?.status).toBe('strong');
    expect(preview.find((item) => item.term === 'sql')?.status).toBe('missing');
  });

  it('accepts only valid server heatmap items', () => {
    expect(readKeywordHeatmap([
      { term: 'Python', status: 'strong', jobCount: 2, resumeCount: 1 },
      { term: '', status: 'missing' },
      null,
    ])).toEqual([
      { term: 'Python', status: 'strong', jobCount: 2, resumeCount: 1 },
    ]);
  });

  it('highlights exact job terms without matching a substring inside another word', () => {
    expect(highlightKeywordText('Pythonist, then Python.', [
      { term: 'Python', jobCount: 1, resumeCount: 1, status: 'strong' },
    ])).toEqual([
      { text: 'Pythonist, then ', status: null },
      { text: 'Python', status: 'strong' },
      { text: '.', status: null },
    ]);
  });

  it('uses a legacy metadata-only job description until it is migrated into content', () => {
    expect(canonicalJobDescription('', { jobDescription: '  Stored role requirements  ' })).toBe('  Stored role requirements  ');
    expect(canonicalJobDescription('Canonical content', { notes: 'call recruiter' })).toBe('Canonical content');
    expect(canonicalJobDescription('Updated role requirements', { jobDescription: 'Outdated role requirements' })).toBe('Updated role requirements');
  });

  it('returns only missing job IDs for the same saved batch and resume', () => {
    expect(missingBatchJobIds([10, 11, 12], [
      { metadata: { batchId: 'batch-a', sourceJobId: 10, sourceResumeId: 4 } },
      { metadata: { batchId: 'batch-old', sourceJobId: 11, sourceResumeId: 4 } },
      { metadata: { batchId: 'batch-a', sourceJobId: 12, sourceResumeId: 99 } },
    ], 'batch-a', 4)).toEqual([11, 12]);
  });

  it('reads interview categories and suggested answer points from generated metadata', () => {
    expect(readInterviewQuestions([
      { category: 'STAR', question: 'Tell me about a time.', suggestedAnswerPoints: ['Situation', 'Outcome'] },
      { category: 'HR', question: 'Why this role?', suggestedAnswer: 'Connect your interest to evidence.' },
      null,
    ])).toEqual([
      { category: 'STAR', question: 'Tell me about a time.', suggestedAnswerPoints: ['Situation', 'Outcome'] },
      { category: 'HR', question: 'Why this role?', suggestedAnswerPoints: ['Connect your interest to evidence.'] },
    ]);
  });
});