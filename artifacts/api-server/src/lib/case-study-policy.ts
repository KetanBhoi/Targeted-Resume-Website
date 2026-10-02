export interface CaseStudyPublicationInput {
  title: string;
  summary: string;
  reasoning: string;
  lessons: string;
  fictionalConfirmed: boolean;
  published: boolean;
}

export function validCaseStudyPublication(input: CaseStudyPublicationInput): boolean {
  return !input.published || (
    input.fictionalConfirmed &&
    input.title.trim().length > 0 &&
    input.summary.trim().length > 0 &&
    input.reasoning.trim().length > 0 &&
    input.lessons.trim().length > 0
  );
}

export function publicCaseStudy(row: {
  id: string;
  title: string;
  summary: string;
  jobDescription: string;
  outreach: string;
  reasoning: string;
  lessons: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    jobDescription: row.jobDescription,
    outreach: row.outreach,
    reasoning: row.reasoning,
    lessons: row.lessons,
    label: "Fictional recruiting practice—not professional experience",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}