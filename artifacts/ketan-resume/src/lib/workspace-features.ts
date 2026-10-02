export type ResumeDiffSegment = {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
};

export type KeywordMatch = {
  term: string;
  jobCount: number;
  resumeCount: number;
  status: 'strong' | 'partial' | 'missing';
};

export type KeywordHighlightSegment = {
  text: string;
  status: KeywordMatch['status'] | null;
};

export type InterviewPrompt = {
  category: string;
  question: string;
  suggestedAnswerPoints: string[];
};

const stopWords = new Set([
  'about', 'across', 'after', 'along', 'also', 'and', 'any', 'are', 'around',
  'based', 'being', 'both', 'can', 'candidate', 'company', 'day', 'demonstrate',
  'different', 'during', 'each', 'ensure', 'etc', 'experience', 'for', 'from',
  'good', 'have', 'help', 'including', 'into', 'job', 'join', 'looking', 'more',
  'must', 'new', 'our', 'other', 'overview', 'preferred', 'provide', 'role',
  'seeking', 'should', 'such', 'team', 'that', 'the', 'their', 'these', 'this',
  'through', 'under', 'using', 'various', 'what', 'which', 'will', 'with', 'work',
  'years', 'you', 'your',
]);

function mergeSegments(segments: ResumeDiffSegment[]): ResumeDiffSegment[] {
  return segments.reduce<ResumeDiffSegment[]>((merged, segment) => {
    const previous = merged[merged.length - 1];
    if (previous?.type === segment.type) previous.text += segment.text;
    else merged.push({ ...segment });
    return merged;
  }, []);
}

function splitIntoUnits(text: string): string[] {
  if (text.includes('\n')) return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  return text.split(/(\s+)/).filter(Boolean);
}

export function diffResumeText(before: string, after: string): ResumeDiffSegment[] {
  if (before === after) return before ? [{ type: 'unchanged', text: before }] : [];

  const a = splitIntoUnits(before);
  const b = splitIntoUnits(after);
  const cells = (a.length + 1) * (b.length + 1);

  if (cells > 1_200_000) {
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
    let suffix = 0;
    while (
      suffix < a.length - prefix
      && suffix < b.length - prefix
      && a[a.length - suffix - 1] === b[b.length - suffix - 1]
    ) suffix += 1;
    const coarseSegments: ResumeDiffSegment[] = [
      { type: 'unchanged', text: a.slice(0, prefix).join('') },
      { type: 'removed', text: a.slice(prefix, a.length - suffix).join('') },
      { type: 'added', text: b.slice(prefix, b.length - suffix).join('') },
      { type: 'unchanged', text: suffix ? a.slice(a.length - suffix).join('') : '' },
    ];
    return mergeSegments(coarseSegments.filter((segment) => segment.text.length > 0));
  }

  const width = b.length + 1;
  const table = new Uint32Array(cells);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const segments: ResumeDiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      segments.push({ type: 'unchanged', text: a[i] });
      i += 1;
      j += 1;
    } else if (i < a.length && (j === b.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      segments.push({ type: 'removed', text: a[i] });
      i += 1;
    } else {
      segments.push({ type: 'added', text: b[j] });
      j += 1;
    }
  }
  return mergeSegments(segments);
}

function countOccurrences(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) ?? []).length;
}

export function buildKeywordPreview(jobDescription: string, resumeText: string): KeywordMatch[] {
  const jobTerms = (jobDescription.toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g) ?? [])
    .map((term) => term.replace(/[./-]+$/g, ''))
    .filter((term) => term.length >= 3 && !stopWords.has(term));
  const frequencies = new Map<string, number>();
  for (const term of jobTerms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);

  const resumeLower = resumeText.toLowerCase();
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([term, jobCount]) => {
      const resumeCount = countOccurrences(resumeLower, term);
      const relatedFormExists = !resumeCount && term.length >= 5
        && (resumeLower.match(/[a-z][a-z0-9+#./-]*/g) ?? [])
          .some((candidate: string) => candidate.startsWith(term.slice(0, -1)) || term.startsWith(candidate.slice(0, -1)));
      const status = resumeCount >= jobCount ? 'strong' : resumeCount > 0 || relatedFormExists ? 'partial' : 'missing';
      return { term, jobCount, resumeCount, status };
    });
}

export function readKeywordHeatmap(value: unknown): KeywordMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): KeywordMatch[] => {
    if (typeof item !== 'object' || item === null) return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.term !== 'string' || !candidate.term.trim()) return [];
    const rawStatus = candidate.status;
    const status = rawStatus === 'strong' || rawStatus === 'partial' || rawStatus === 'missing'
      ? rawStatus
      : rawStatus === 'matched' || rawStatus === 'match' ? 'strong'
        : rawStatus === 'partial-match' ? 'partial' : 'missing';
    return [{
      term: candidate.term,
      jobCount: typeof candidate.jdCount === 'number'
        ? candidate.jdCount
        : typeof candidate.jobCount === 'number' ? candidate.jobCount : 0,
      resumeCount: typeof candidate.resumeCount === 'number' ? candidate.resumeCount : 0,
      status,
    }];
  });
}

export function highlightKeywordText(text: string, keywords: KeywordMatch[]): KeywordHighlightSegment[] {
  const terms = [...new Map(keywords.map((item) => [item.term.toLowerCase(), item])).values()]
    .sort((a, b) => b.term.length - a.term.length);
  if (!text || terms.length === 0) return [{ text, status: null }];

  const statuses = new Map(terms.map((item) => [item.term.toLowerCase(), item.status]));
  const alternatives = terms.map((item) => item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(?<![a-z0-9])(${alternatives.join('|')})(?![a-z0-9])`, 'gi');
  const segments: KeywordHighlightSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), status: null });
    segments.push({ text: match[1], status: statuses.get(match[1].toLowerCase()) ?? null });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), status: null });
  return segments;
}

export function canonicalJobDescription(content: string, metadata: unknown): string {
  if (content.trim()) return content;
  if (typeof metadata === 'object' && metadata !== null) {
    const values = metadata as Record<string, unknown>;
    const legacy = [values.jobDescription, values.description]
      .find((value) => typeof value === 'string' && value.trim());
    if (typeof legacy === 'string') return legacy;
  }
  return '';
}

export function missingBatchJobIds(
  selectedJobIds: number[],
  records: unknown[],
  batchId: string,
  sourceResumeId: number,
): number[] {
  const completedJobIds = new Set<number>();
  for (const record of records) {
    if (typeof record !== 'object' || record === null) continue;
    const metadata = (record as Record<string, unknown>).metadata;
    if (typeof metadata !== 'object' || metadata === null) continue;
    const values = metadata as Record<string, unknown>;
    if (values.batchId === batchId && values.sourceResumeId === sourceResumeId
      && typeof values.sourceJobId === 'number' && Number.isSafeInteger(values.sourceJobId)) {
      completedJobIds.add(values.sourceJobId);
    }
  }
  return selectedJobIds.filter((id) => !completedJobIds.has(id));
}

export function readInterviewQuestions(value: unknown): InterviewPrompt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): InterviewPrompt[] => {
    if (typeof item === 'string' && item.trim()) {
      return [{ category: 'Question', question: item.trim(), suggestedAnswerPoints: [] }];
    }
    if (typeof item !== 'object' || item === null) return [];
    const question = item as Record<string, unknown>;
    const prompt = [question.question, question.prompt, question.text]
      .find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (typeof prompt !== 'string') return [];
    const rawPoints = [question.suggestedAnswerPoints, question.answerPoints, question.talkingPoints]
      .find(Array.isArray);
    const suggestedAnswerPoints = Array.isArray(rawPoints)
      ? rawPoints.filter((point): point is string => typeof point === 'string' && Boolean(point.trim()))
      : [];
    if (suggestedAnswerPoints.length === 0) {
      const legacyAnswer = [question.suggestedAnswer, question.answer, question.answerPoints, question.talkingPoints]
        .find((candidate) => typeof candidate === 'string' && candidate.trim());
      if (typeof legacyAnswer === 'string') suggestedAnswerPoints.push(legacyAnswer);
    }
    return [{
      category: typeof question.category === 'string' && question.category.trim() ? question.category : 'Question',
      question: prompt,
      suggestedAnswerPoints,
    }];
  });
}