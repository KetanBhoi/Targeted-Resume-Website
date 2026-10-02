import type { WorkspaceRecordKind } from '@workspace/api-client-react';

export const SIMULATION_KIND = 'simulation' satisfies WorkspaceRecordKind;
export const PRACTICE_KIND = 'practice' satisfies WorkspaceRecordKind;

export const LAB_DISCLAIMER =
  'Fictional practice only. Every company, role and candidate here is invented. Never paste real candidate information. This is not professional recruiting evidence.';

export type Criterion = { id: string; label: string; hint: string };
export type FictionalCandidate = { id: string; name: string; summary: string };
export type Scenario = {
  id: string;
  company: string;
  role: string;
  blurb: string;
  brief: string;
  candidates: FictionalCandidate[];
};

export const STAGES = [
  { id: 'job-description', label: 'Job description' },
  { id: 'scorecard', label: 'Scorecard comparison' },
  { id: 'outreach', label: 'Outreach draft' },
  { id: 'review', label: 'Review' },
] as const;

export const CRITERIA: Criterion[] = [
  { id: 'skills', label: 'Role-relevant skills', hint: 'Skills the job description lists as required, backed by an example.' },
  { id: 'experience', label: 'Relevant work examples', hint: 'Projects or tasks similar to the work in the role.' },
  { id: 'communication', label: 'Written communication', hint: 'Clarity of the written summary provided.' },
  { id: 'learning', label: 'Evidence of learning new tools', hint: 'A documented case of picking up something unfamiliar.' },
  { id: 'availability', label: 'Stated availability match', hint: 'Start window and working hours compared with the role.' },
];

export const SCORE_LABELS = ['Not scored', 'No evidence', 'Some evidence', 'Clear evidence', 'Strong, specific evidence'];

export const SCENARIOS: Scenario[] = [
  {
    id: 'harbourlight-support',
    company: 'Harbourlight Freight Co-op',
    role: 'Dispatch Support Coordinator',
    blurb: 'Entry-level coordination role at an invented shipping co-operative.',
    brief: 'Harbourlight Freight Co-op is a made-up regional carrier. The coordinator tracks pickups, updates a shared board and answers driver questions during a 7am to 3pm shift.',
    candidates: [
      { id: 'a', name: 'Mirela Quennt', summary: 'Two years running a school supply depot rota. Uses spreadsheets daily. Wrote a clear one-page handover guide.' },
      { id: 'b', name: 'Tobias Arkwell', summary: 'Six months as a warehouse picker. Learned a handheld scanner system in a week. Brief written summary with few details.' },
      { id: 'c', name: 'Saffi Dunmore', summary: 'Volunteer logistics for a fictional town fair. Strong written notes, available from the first of next month.' },
    ],
  },
  {
    id: 'pinecrest-data',
    company: 'Pinecrest Orchard Analytics',
    role: 'Junior Reporting Analyst',
    blurb: 'Data tidy-up and weekly reports for an invented fruit-growers group.',
    brief: 'Pinecrest Orchard Analytics is invented. The analyst cleans harvest spreadsheets, builds a weekly summary and flags odd numbers to the field team.',
    candidates: [
      { id: 'a', name: 'Joren Valbright', summary: 'Built a household budget workbook with pivot tables. Short course in basic SQL. Clear, structured summary.' },
      { id: 'b', name: 'Ilse Marrowfield', summary: 'Taught herself charting tools to track club results. Summary is long but unfocused.' },
      { id: 'c', name: 'Pavan Oakhurst', summary: 'Internship checking data entry accuracy at a fictional clinic. Available part-time only.' },
    ],
  },
  {
    id: 'lantern-people',
    company: 'Lanternworks Print Studio',
    role: 'People and Office Assistant',
    blurb: 'Scheduling, onboarding paperwork and a warm front desk at an invented print studio.',
    brief: 'Lanternworks Print Studio is invented. The assistant schedules interviews, prepares onboarding folders and keeps the shared calendar accurate.',
    candidates: [
      { id: 'a', name: 'Odalys Fenwick', summary: 'Managed a club calendar for 40 members. Confident with calendar tools. Concise written summary.' },
      { id: 'b', name: 'Kesar Linnet', summary: 'Retail shift lead for one year. Trained two new starters. Summary lists duties but few outcomes.' },
      { id: 'c', name: 'Bram Thistledown', summary: 'Recent graduate with a records-keeping project. Learned a scheduling app for coursework.' },
    ],
  },
];

export const JD_CHECKLIST = [
  'Lists the real day-to-day tasks, not only a title.',
  'Separates required skills from nice-to-have skills.',
  'Every requirement relates to doing the job.',
  'Avoids age, gender, family, origin or health wording.',
  'States hours, location and next steps plainly.',
];
export const OUTREACH_CHECKLIST = [
  'Opens with why this role, in one sentence.',
  'Refers to a job-related detail from the candidate summary.',
  'States the next step and a way to decline.',
  'No pressure language, no promises about outcomes.',
  'Contains no protected traits or private details.',
];
export const REVIEW_PROMPTS = [
  'Did you score every candidate against the same criteria?',
  'Which score would you change if you re-read only the evidence?',
  'Which criterion had the thinnest evidence across all candidates?',
  'What would you ask in a structured screen to fill that gap?',
];

export type LabCandidateState = { id: string; name: string; scores: Record<string, number>; notes: string };
export type LabContent = {
  jobDescription: string;
  candidates: LabCandidateState[];
  outreach: string;
  jdChecks: boolean[];
  outreachChecks: boolean[];
  reviewNotes: string;
};

export function emptyLab(s: Scenario): LabContent {
  return {
    jobDescription: '',
    candidates: s.candidates.map((c) => ({ id: c.id, name: c.name, scores: {}, notes: '' })),
    outreach: '',
    jdChecks: JD_CHECKLIST.map(() => false),
    outreachChecks: OUTREACH_CHECKLIST.map(() => false),
    reviewNotes: '',
  };
}

export function parseLab(raw: string, s: Scenario): LabContent {
  const base = emptyLab(s);
  try {
    const p = JSON.parse(raw) as Partial<LabContent>;
    return {
      jobDescription: typeof p.jobDescription === 'string' ? p.jobDescription : '',
      candidates: base.candidates.map((c) => {
        const f = Array.isArray(p.candidates) ? p.candidates.find((x) => x?.id === c.id) : undefined;
        return f ? { ...c, scores: f.scores && typeof f.scores === 'object' ? f.scores : {}, notes: typeof f.notes === 'string' ? f.notes : '' } : c;
      }),
      outreach: typeof p.outreach === 'string' ? p.outreach : '',
      jdChecks: base.jdChecks.map((_, i) => Boolean(p.jdChecks?.[i])),
      outreachChecks: base.outreachChecks.map((_, i) => Boolean(p.outreachChecks?.[i])),
      reviewNotes: typeof p.reviewNotes === 'string' ? p.reviewNotes : '',
    };
  } catch {
    return base;
  }
}

export function totalScore(c: LabCandidateState): { sum: number; scored: number } {
  let sum = 0;
  let scored = 0;
  CRITERIA.forEach((k) => {
    const v = c.scores[k.id];
    if (v) { sum += v; scored += 1; }
  });
  return { sum, scored };
}

export function fmtDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.valueOf()) ? 'No date' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
