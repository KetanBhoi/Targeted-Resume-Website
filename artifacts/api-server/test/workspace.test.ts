import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo, Server } from 'node:net';

const mockDbState = vi.hoisted(() => ({
  records: [] as Array<Record<string, unknown>>,
  shares: [] as Array<Record<string, unknown>>,
  nextId: 1,
}));

const mockGenerationState = vi.hoisted(() => ({
  response: '',
  calls: 0,
  systemPrompt: '',
  userPrompt: '',
}));

vi.mock('@clerk/express', () => ({
  getAuth: (request: { headers: Record<string, string | string[] | undefined> }) => {
    const value = request.headers['x-test-user'];
    return { userId: typeof value === 'string' ? value : null };
  },
}));

vi.mock('@workspace/db', async () => {
  const [{ workspaceRecordsTable, applicationSharesTable }, { PgDialect }] = await Promise.all([
    import('@workspace/db/schema'),
    import('drizzle-orm/pg-core'),
  ]);
  const dialect = new PgDialect();
  const tables = new Map<unknown, string>([
    [workspaceRecordsTable, 'workspace_records'],
    [applicationSharesTable, 'application_shares'],
  ]);

  function getTable(table: unknown) {
    const name = tables.get(table);
    if (!name) throw new Error('Unexpected table in workspace test database fixture.');
    return {
      name,
      rows: table === workspaceRecordsTable ? mockDbState.records : mockDbState.shares,
    };
  }

  function matchingRows(table: unknown, condition: unknown): Array<Record<string, unknown>> {
    const target = getTable(table);
    const query = dialect.sqlToQuery(condition as never);
    const predicates = Array.from(
      query.sql.matchAll(new RegExp(`"${target.name}"\\."([^"]+)"\\s*=\\s*\\$(\\d+)`, 'g')),
      (match) => ({
        property: match[1].replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase()),
        value: query.params[Number(match[2]) - 1],
      }),
    );
    return target.rows.filter((row) => predicates.every(({ property, value }) => row[property] === value));
  }

  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          orderBy: async () =>
            matchingRows(table, condition)
              .slice()
              .sort((a, b) => {
                const aDate = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
                const bDate = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
                return bDate - aDate;
              })
              .map((record) => structuredClone(record)),
          limit: async (count: number) =>
            matchingRows(table, condition)
              .slice(0, count)
              .map((record) => structuredClone(record)),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const target = getTable(table);
          const now = new Date();
          const record = {
            ...values,
            id: mockDbState.nextId++,
            createdAt: now,
            updatedAt: now,
          };
          target.rows.push(record);
          return [structuredClone(record)];
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const record = matchingRows(table, condition)[0];
            if (!record) return [];
            Object.assign(record, values);
            return [structuredClone(record)];
          },
        }),
      }),
    }),
    delete: (table: unknown) => ({
      where: (condition: unknown) => ({
        returning: async () => deleteMatchingRows(table, condition),
        then: (resolve: (result: Array<Record<string, unknown>>) => unknown) =>
          Promise.resolve(deleteMatchingRows(table, condition)).then(resolve),
      }),
    }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const recordsBefore = structuredClone(mockDbState.records);
      const sharesBefore = structuredClone(mockDbState.shares);
      try {
        return await callback(db);
      } catch (error) {
        mockDbState.records = recordsBefore;
        mockDbState.shares = sharesBefore;
        throw error;
      }
    },
  };

  function deleteMatchingRows(table: unknown, condition: unknown) {
    const target = getTable(table);
    const matches = matchingRows(table, condition);
    const ids = new Set(matches.map((record) => record.id));
    target.rows = target.rows.filter((record) => !ids.has(record.id));
    if (table === workspaceRecordsTable) mockDbState.records = target.rows;
    if (table === applicationSharesTable) mockDbState.shares = target.rows;
    return matches.map((record) => ({ id: record.id }));
  }

  return { db, workspaceRecordsTable, applicationSharesTable };
});

vi.mock('@workspace/integrations-openai-ai-server', () => ({
  openai: {
    chat: {
      completions: {
        create: async (request: {
          messages: Array<{ role: 'system' | 'user'; content: string }>;
        }) => {
          mockGenerationState.calls += 1;
          mockGenerationState.systemPrompt =
            request.messages.find((message) => message.role === 'system')?.content ?? '';
          mockGenerationState.userPrompt =
            request.messages.find((message) => message.role === 'user')?.content ?? '';
          return { choices: [{ message: { content: mockGenerationState.response } }] };
        },
      },
    },
  },
}));

import workspaceRouter from '../src/routes/workspace';

const app = express();
app.use((request, _response, next) => {
  Object.assign(request, { log: { warn: vi.fn() } });
  next();
});
app.use(express.json());
app.use('/api', workspaceRouter);

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

beforeEach(() => {
  mockDbState.records = [];
  mockDbState.shares = [];
  mockDbState.nextId = 1;
  mockGenerationState.response = '';
  mockGenerationState.calls = 0;
  mockGenerationState.systemPrompt = '';
  mockGenerationState.userPrompt = '';
});

async function request(
  path: string,
  options: { userId?: string; method?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (options.userId) headers['x-test-user'] = options.userId;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

describe('workspace API authentication and ownership', () => {
  it('rejects signed-out requests to every workspace write or read endpoint', async () => {
    const responses = await Promise.all([
      request('/api/workspace/records'),
      request('/api/workspace/export'),
      request('/api/workspace/records', { method: 'POST', body: {} }),
      request('/api/workspace/delete-all', { method: 'POST', body: { confirmation: 'DELETE ALL' } }),
      request('/api/workspace/records/1', { method: 'PATCH', body: {} }),
      request('/api/workspace/records/1', { method: 'DELETE' }),
      request('/api/workspace/generate', { method: 'POST', body: {} }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });

  it('keeps create, list, update, and delete scoped to the authenticated account', async () => {
    const createAs = (userId: string, title: string) =>
      request('/api/workspace/records', {
        userId,
        method: 'POST',
        body: { kind: 'resume', title, content: `${title} content` },
      });

    const createA = await createAs('user-a', 'Resume A');
    const createB = await createAs('user-b', 'Resume B');
    expect(createA.status).toBe(201);
    expect(createB.status).toBe(201);
    const recordA = await createA.json() as { id: number; title: string };
    const recordB = await createB.json() as { id: number; title: string };

    const listA = await request('/api/workspace/records', { userId: 'user-a' });
    const listB = await request('/api/workspace/records', { userId: 'user-b' });
    expect((await listA.json()).map((record: { id: number }) => record.id)).toEqual([recordA.id]);
    expect((await listB.json()).map((record: { id: number }) => record.id)).toEqual([recordB.id]);

    const crossAccountUpdate = await request(`/api/workspace/records/${recordA.id}`, {
      userId: 'user-b',
      method: 'PATCH',
      body: { title: 'Compromised' },
    });
    const crossAccountDelete = await request(`/api/workspace/records/${recordA.id}`, {
      userId: 'user-b',
      method: 'DELETE',
    });
    expect(crossAccountUpdate.status).toBe(404);
    expect(crossAccountDelete.status).toBe(404);

    const updateA = await request(`/api/workspace/records/${recordA.id}`, {
      userId: 'user-a',
      method: 'PATCH',
      body: { title: 'Resume A updated' },
    });
    expect(updateA.status).toBe(200);
    expect((await updateA.json()).title).toBe('Resume A updated');

    const deleteA = await request(`/api/workspace/records/${recordA.id}`, {
      userId: 'user-a',
      method: 'DELETE',
    });
    expect(deleteA.status).toBe(204);

    const finalListA = await request('/api/workspace/records', { userId: 'user-a' });
    const finalListB = await request('/api/workspace/records', { userId: 'user-b' });
    expect(await finalListA.json()).toEqual([]);
    expect((await finalListB.json()).map((record: { id: number }) => record.id)).toEqual([recordB.id]);
  });

  it('exports fresh owner-scoped data and atomically deletes only the confirmed owner records', async () => {
    const createAs = (userId: string, title: string) =>
      request('/api/workspace/records', {
        userId,
        method: 'POST',
        body: { kind: 'resume', title, content: `${title} content` },
      });
    const firstA = await createAs('privacy-user-a', 'A first');
    const firstB = await createAs('privacy-user-b', 'B private');
    const recordA = await firstA.json() as { id: number };
    const recordB = await firstB.json() as { id: number };
    mockDbState.shares.push(
      {
        id: 'share-user-a',
        userId: 'privacy-user-a',
        packRecordId: recordA.id,
        title: 'Private A pack',
        snapshot: { resume: { content: 'A private resume' } },
        tokenHash: 'a'.repeat(64),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      },
      {
        id: 'share-user-b',
        userId: 'privacy-user-b',
        packRecordId: recordB.id,
        title: 'Private B pack',
        snapshot: { resume: { content: 'B private resume' } },
        tokenHash: 'b'.repeat(64),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      },
    );

    const exportA = await request('/api/workspace/export', { userId: 'privacy-user-a' });
    const exportedA = await exportA.json() as {
      exportedAt: string;
      records: Array<{ id: number }>;
    };
    expect(exportA.status).toBe(200);
    expect(Number.isNaN(Date.parse(exportedA.exportedAt))).toBe(false);
    expect(exportedA.records.map((record) => record.id)).toEqual([recordA.id]);

    const secondA = await createAs('privacy-user-a', 'A second');
    const recordA2 = await secondA.json() as { id: number };
    const freshExportA = await request('/api/workspace/export', { userId: 'privacy-user-a' });
    const freshRecords = await freshExportA.json() as { records: Array<{ id: number }> };
    expect(freshRecords.records.map((record) => record.id)).toEqual(
      expect.arrayContaining([recordA.id, recordA2.id]),
    );
    expect(freshRecords.records.map((record) => record.id)).not.toContain(recordB.id);

    const exportB = await request('/api/workspace/export', { userId: 'privacy-user-b' });
    const exportedB = await exportB.json() as { records: Array<{ id: number }> };
    expect(exportedB.records.map((record) => record.id)).toEqual([recordB.id]);

    const badConfirmation = await request('/api/workspace/delete-all', {
      userId: 'privacy-user-a',
      method: 'POST',
      body: { confirmation: 'delete all' },
    });
    expect(badConfirmation.status).toBe(400);
    expect((await (await request('/api/workspace/export', { userId: 'privacy-user-a' })).json()).records)
      .toHaveLength(2);

    const deleteA = await request('/api/workspace/delete-all', {
      userId: 'privacy-user-a',
      method: 'POST',
      body: { confirmation: 'DELETE ALL' },
    });
    expect(deleteA.status).toBe(200);
    expect(await deleteA.json()).toEqual({ deletedCount: 2 });
    expect(mockDbState.shares.map((share) => share.id)).toEqual(['share-user-b']);
    expect(mockDbState.shares[0].snapshot).toEqual({ resume: { content: 'B private resume' } });
    expect((await (await request('/api/workspace/export', { userId: 'privacy-user-a' })).json()).records)
      .toEqual([]);
    expect((await (await request('/api/workspace/export', { userId: 'privacy-user-b' })).json()).records)
      .toHaveLength(1);
  });

  it('purges only the deleted owner pack shares and their copied snapshots', async () => {
    const now = new Date();
    mockDbState.records.push({
      id: 41,
      userId: 'pack-owner',
      kind: 'pack',
      title: 'Application pack',
      content: JSON.stringify({ resume: { content: 'Private snapshot' } }),
      metadata: { reviewed: true, resumeId: 7, coverLetterId: null },
      createdAt: now,
      updatedAt: now,
    });
    mockDbState.shares.push(
      {
        id: 'pack-owner-share',
        userId: 'pack-owner',
        packRecordId: 41,
        title: 'Application pack',
        snapshot: { resume: { content: 'Private snapshot' } },
        tokenHash: 'c'.repeat(64),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
        revokedAt: null,
      },
      {
        id: 'other-owner-share',
        userId: 'other-owner',
        packRecordId: 41,
        title: 'Other account snapshot',
        snapshot: { resume: { content: 'Do not delete other account data' } },
        tokenHash: 'd'.repeat(64),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
        revokedAt: null,
      },
    );

    const deleted = await request('/api/workspace/records/41', {
      userId: 'pack-owner',
      method: 'DELETE',
    });
    expect(deleted.status).toBe(204);
    expect(mockDbState.records).toEqual([]);
    expect(mockDbState.shares.map((share) => share.id)).toEqual(['other-owner-share']);
    expect(mockDbState.shares[0].snapshot).toEqual({
      resume: { content: 'Do not delete other account data' },
    });
  });

  it('validates linked source ownership and record kinds before calling the model', async () => {
    const savedResume = await request('/api/workspace/records', {
      userId: 'source-owner',
      method: 'POST',
      body: { kind: 'resume', title: 'Resume', content: 'Python developer.' },
    });
    const resume = await savedResume.json() as { id: number };
    const savedJob = await request('/api/workspace/records', {
      userId: 'source-owner',
      method: 'POST',
      body: { kind: 'job', title: 'Analyst role', content: 'Python required.' },
    });
    const job = await savedJob.json() as { id: number };

    const crossAccount = await request('/api/workspace/generate', {
      userId: 'another-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Tailored resume',
        resumeText: 'Ignored client resume.',
        jobDescription: 'Python experience required.',
        sourceResumeId: resume.id,
      },
    });
    expect(crossAccount.status).toBe(404);
    expect(mockGenerationState.calls).toBe(0);

    const wrongKind = await request('/api/workspace/generate', {
      userId: 'source-owner',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Tailored resume',
        resumeText: 'Ignored client resume.',
        jobDescription: 'Python experience required.',
        sourceResumeId: job.id,
      },
    });
    expect(wrongKind.status).toBe(404);
    expect(mockGenerationState.calls).toBe(0);

    const crossAccountJob = await request('/api/workspace/generate', {
      userId: 'another-user',
      method: 'POST',
      body: {
        kind: 'follow-up',
        title: 'Application follow-up',
        resumeText: 'Not used.',
        sourceJobId: job.id,
      },
    });
    const wrongJobKind = await request('/api/workspace/generate', {
      userId: 'source-owner',
      method: 'POST',
      body: {
        kind: 'follow-up',
        title: 'Application follow-up',
        resumeText: 'Not used.',
        sourceJobId: resume.id,
      },
    });
    expect(crossAccountJob.status).toBe(404);
    expect(wrongJobKind.status).toBe(404);
    expect(mockGenerationState.calls).toBe(0);

    const missingResume = await request('/api/workspace/generate', {
      userId: 'source-owner',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Tailored resume',
        resumeText: 'Python developer.',
        jobDescription: 'Python experience required.',
      },
    });
    const missingJob = await request('/api/workspace/generate', {
      userId: 'source-owner',
      method: 'POST',
      body: {
        kind: 'follow-up',
        title: 'Application follow-up',
        resumeText: 'Not used.',
      },
    });
    expect(missingResume.status).toBe(400);
    expect(missingJob.status).toBe(400);
    expect(mockGenerationState.calls).toBe(0);
  });

  it('creates a new tailored resume with exact, supported source changes', async () => {
    const originalContent = 'Python developer. Built reporting tools to support data review.';
    const savedResume = await request('/api/workspace/records', {
      userId: 'tailor-user',
      method: 'POST',
      body: { kind: 'resume', title: 'Original', content: originalContent },
    });
    const original = await savedResume.json() as { id: number };
    mockGenerationState.response = JSON.stringify({
      revisedResumeText: 'Python developer. Developed reporting tools that supported data review.',
    });

    const response = await request('/api/workspace/generate', {
      userId: 'tailor-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Tailored for analyst role',
        resumeText: 'This untrusted request text must not replace the saved resume.',
        jobDescription: 'Python and reporting experience.',
        sourceResumeId: original.id,
      },
    });

    expect(response.status).toBe(201);
    const tailored = await response.json() as {
      id: number;
      kind: string;
      content: string;
      metadata: {
        sourceResumeId?: number;
        verificationStatus?: string;
        changes?: Array<{ before: string; after: string; why: string }>;
      };
    };
    expect(tailored.kind).toBe('resume');
    expect(tailored.content).toBe('Python developer. Developed reporting tools that supported data review.');
    expect(tailored.metadata).toEqual({
      sourceResumeId: original.id,
      verificationStatus: 'needs-review',
      changes: [{
        before: originalContent,
        after: 'Python developer. Developed reporting tools that supported data review.',
        why: 'Complete before/after comparison; review every change before using this draft.',
      }],
    });
    expect(JSON.parse(mockGenerationState.userPrompt).resumeText).toBe(originalContent);

    const resumes = await request('/api/workspace/records?kind=resume', { userId: 'tailor-user' });
    const resumeRecords = await resumes.json() as Array<{ id: number; content: string }>;
    expect(resumeRecords).toHaveLength(2);
    expect(resumeRecords.some((record) => record.id === original.id && record.content === originalContent)).toBe(true);

    mockGenerationState.response = JSON.stringify({
      revisedResumeText: 'Python developer. Increased revenue by 40%.',
    });
    const unsupported = await request('/api/workspace/generate', {
      userId: 'tailor-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Invalid tailored resume',
        resumeText: originalContent,
        jobDescription: 'Python experience required.',
        sourceResumeId: original.id,
      },
    });
    expect(unsupported.status).toBe(503);
    const afterInvalid = await request('/api/workspace/records?kind=resume', { userId: 'tailor-user' });
    expect(await afterInvalid.json()).toHaveLength(2);

    mockGenerationState.response = JSON.stringify({
      revisedResumeText: 'Python developer. Built reporting tools at Acme.',
    });
    const inventedOrganization = await request('/api/workspace/generate', {
      userId: 'tailor-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Resume with an invented employer',
        resumeText: originalContent,
        jobDescription: 'Python experience required.',
        sourceResumeId: original.id,
      },
    });
    expect(inventedOrganization.status).toBe(503);
    const afterOrganization = await request('/api/workspace/records?kind=resume', { userId: 'tailor-user' });
    expect(await afterOrganization.json()).toHaveLength(2);

    mockGenerationState.response = JSON.stringify({
      revisedResumeText: 'Python developer. Certified PMP.',
    });
    const inventedCredential = await request('/api/workspace/generate', {
      userId: 'tailor-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'Resume with an invented credential',
        resumeText: originalContent,
        jobDescription: 'Python experience required.',
        sourceResumeId: original.id,
      },
    });
    expect(inventedCredential.status).toBe(503);
    const afterCredential = await request('/api/workspace/records?kind=resume', { userId: 'tailor-user' });
    expect(await afterCredential.json()).toHaveLength(2);
  });

  it('adds a deterministic keyword heatmap and actionable missing-skill roadmap', async () => {
    const savedResumeResponse = await request('/api/workspace/records', {
      userId: 'analysis-user',
      method: 'POST',
      body: {
        kind: 'resume',
        title: 'Analysis resume',
        content: 'Python Python and NoSQL.',
      },
    });
    const resume = await savedResumeResponse.json() as { id: number };
    const jobDescription = 'Python Python SQL Tableau.';
    const savedJobResponse = await request('/api/workspace/records', {
      userId: 'analysis-user',
      method: 'POST',
      body: {
        kind: 'job',
        title: 'Analyst role',
        content: jobDescription,
        metadata: { jobDescription: 'Conflicting non-authoritative description.' },
      },
    });
    const job = await savedJobResponse.json() as { id: number };
    mockGenerationState.response = JSON.stringify({
      fitScore: 78,
      summary: 'Relevant Python experience is visible.',
      strengths: ['Python experience'],
      skillGaps: ['Tableau'],
      atsIssues: [],
      keywords: ['Python', 'SQL', 'Tableau', 'Figma'],
      recommendation: 'Address the visible Tableau requirement.',
      roadmap: [{
        skill: 'Tableau',
        requirement: 'The job description requests Tableau.',
        priority: 'high',
        firstStep: 'Review an introductory Tableau course.',
      }],
    });

    const mismatchedDescription = await request('/api/workspace/generate', {
      userId: 'analysis-user',
      method: 'POST',
      body: {
        kind: 'analysis',
        title: 'Mismatched analysis',
        resumeText: 'Python Python and NoSQL.',
        jobDescription: 'Different job description.',
        sourceResumeId: resume.id,
        sourceJobId: job.id,
        batchId: 'comparison-batch-a',
      },
    });
    expect(mismatchedDescription.status).toBe(400);
    expect(mockGenerationState.calls).toBe(0);

    const response = await request('/api/workspace/generate', {
      userId: 'analysis-user',
      method: 'POST',
      body: {
        kind: 'analysis',
        title: 'Analyst match',
        resumeText: 'Python Python and NoSQL.',
        jobDescription,
        sourceResumeId: resume.id,
        sourceJobId: job.id,
        batchId: 'comparison-batch-a',
      },
    });

    expect(response.status).toBe(201);
    const analysis = await response.json() as {
      metadata: {
        sourceResumeId: number;
        sourceJobId: number;
        batchId: string;
        skillGaps: string[];
        roadmap: Array<{ skill: string; firstStep: string }>;
        keywords: string[];
        keywordHeatmap: Array<{ term: string; jdCount: number; resumeCount: number; status: string }>;
      };
    };
    expect(analysis.metadata.sourceResumeId).toBe(resume.id);
    expect(analysis.metadata.sourceJobId).toBe(job.id);
    expect(analysis.metadata.batchId).toBe('comparison-batch-a');
    expect(JSON.parse(mockGenerationState.userPrompt).jobDescription).toBe(jobDescription);
    expect(JSON.parse(mockGenerationState.userPrompt).trackedApplication).toBeUndefined();
    expect(analysis.metadata.skillGaps).toEqual(['Tableau']);
    expect(analysis.metadata.roadmap).toEqual([{
      skill: 'Tableau',
      requirement: 'The job description requests Tableau.',
      priority: 'high',
      firstStep: 'Review an introductory Tableau course.',
    }]);
    expect(analysis.metadata.keywords).toEqual(['Python', 'SQL', 'Tableau']);
    expect(analysis.metadata.keywordHeatmap).toEqual([
      { term: 'Python', jdCount: 2, resumeCount: 2, status: 'strong' },
      { term: 'SQL', jdCount: 1, resumeCount: 0, status: 'missing' },
      { term: 'Tableau', jdCount: 1, resumeCount: 0, status: 'missing' },
    ]);
  });

  it('requires resume text and persists interview categories with suggested answer points', async () => {
    const missingResume = await request('/api/workspace/generate', {
      userId: 'interview-user',
      method: 'POST',
      body: {
        kind: 'interview',
        title: 'STAR practice',
        questionCategory: 'STAR',
      },
    });
    expect(missingResume.status).toBe(400);
    expect(mockGenerationState.calls).toBe(0);

    mockGenerationState.response = JSON.stringify({
      questions: [{
        category: 'STAR',
        question: 'Describe a time you improved reporting.',
        suggestedAnswerPoints: [
          'Use the reporting-tool project from the resume.',
          'Explain the action and supported result without adding a metric.',
        ],
      }],
      questionsToAsk: ['What would success look like in the first months?'],
    });
    const response = await request('/api/workspace/generate', {
      userId: 'interview-user',
      method: 'POST',
      body: {
        kind: 'interview',
        title: 'STAR practice',
        resumeText: 'Built reporting tools to support data review.',
        questionCategory: 'STAR',
      },
    });
    expect(response.status).toBe(201);
    const interview = await response.json() as {
      content: string;
      metadata: {
        questionCategory: string;
        questions: Array<{
          category: string;
          question: string;
          suggestedAnswerPoints: string[];
        }>;
        questionsToAsk: string[];
      };
    };
    expect(interview.metadata.questionCategory).toBe('STAR');
    expect(interview.metadata.questions).toEqual([{
      category: 'STAR',
      question: 'Describe a time you improved reporting.',
      suggestedAnswerPoints: [
        'Use the reporting-tool project from the resume.',
        'Explain the action and supported result without adding a metric.',
      ],
    }]);
    expect(interview.content).toContain('Q [STAR]');
    expect(interview.content).toContain('- Use the reporting-tool project from the resume.');
    expect(JSON.parse(mockGenerationState.userPrompt).questionCategory).toBe('STAR');

    mockGenerationState.response = JSON.stringify({
      questions: [{
        category: 'Technical',
        question: 'Describe a technical challenge.',
        suggestedAnswerPoints: ['Use a supported example.'],
      }],
      questionsToAsk: [],
    });
    const wrongCategory = await request('/api/workspace/generate', {
      userId: 'interview-user',
      method: 'POST',
      body: {
        kind: 'interview',
        title: 'STAR practice',
        resumeText: 'Built reporting tools to support data review.',
        questionCategory: 'STAR',
      },
    });
    expect(wrongCategory.status).toBe(503);
    const savedInterviews = await request('/api/workspace/records?kind=interview', {
      userId: 'interview-user',
    });
    expect(await savedInterviews.json()).toHaveLength(1);
  });

  it('saves a tracked-application follow-up without unsupported dates or stages', async () => {
    const savedJob = await request('/api/workspace/records', {
      userId: 'follow-up-user',
      method: 'POST',
      body: {
        kind: 'job',
        title: 'Data Analyst',
        content: 'Acme is hiring a data analyst with SQL experience.',
        metadata: {
          company: 'Acme',
          status: 'Applied',
          appliedAt: '2025-01-05',
          interviewDate: '',
        },
      },
    });
    const job = await savedJob.json() as { id: number };
    mockGenerationState.response = JSON.stringify({
      subject: 'Invented interview date',
      body: 'I look forward to meeting you tomorrow and discussing the offer.',
      notes: [],
    });

    const response = await request('/api/workspace/generate', {
      userId: 'follow-up-user',
      method: 'POST',
      body: {
        kind: 'follow-up',
        title: 'Acme follow-up',
        sourceJobId: job.id,
      },
    });

    expect(response.status).toBe(201);
    const followUp = await response.json() as {
      kind: string;
      content: string;
      metadata: { subject?: string; notes?: string[]; sourceJobId?: number };
    };
    expect(followUp.kind).toBe('follow-up');
    expect(followUp.content).toContain('Data Analyst at Acme opportunity');
    expect(followUp.content).not.toMatch(/tomorrow|interview|offer|meeting|promise/i);
    expect(followUp.metadata).toEqual({
      subject: 'Following up regarding Data Analyst at Acme',
      notes: [
        'Neutral template using tracked role and company details only; review and personalize before sending.',
      ],
      sourceJobId: job.id,
    });
    expect(mockGenerationState.calls).toBe(0);

    const savedFollowUps = await request('/api/workspace/records?kind=follow-up', {
      userId: 'follow-up-user',
    });
    expect(await savedFollowUps.json()).toHaveLength(1);
  });

  it('blocks generation from an unverified AI-tailored resume', async () => {
    const originalContent = 'Python developer. Built reporting tools to support data review.';
    const savedResume = await request('/api/workspace/records', {
      userId: 'review-gate-user',
      method: 'POST',
      body: { kind: 'resume', title: 'Original', content: originalContent },
    });
    const original = await savedResume.json() as { id: number };
    mockGenerationState.response = JSON.stringify({
      revisedResumeText: 'Python developer. Developed reporting tools that supported data review.',
    });
    const tailoredResponse = await request('/api/workspace/generate', {
      userId: 'review-gate-user',
      method: 'POST',
      body: {
        kind: 'resume-tailor',
        title: 'AI draft',
        resumeText: originalContent,
        jobDescription: 'Python and reporting experience.',
        sourceResumeId: original.id,
      },
    });
    expect(tailoredResponse.status).toBe(201);
    const draft = await tailoredResponse.json() as { id: number; content: string };
    const modelCalls = mockGenerationState.calls;

    const analysis = await request('/api/workspace/generate', {
      userId: 'review-gate-user',
      method: 'POST',
      body: {
        kind: 'analysis',
        title: 'Role analysis',
        resumeText: draft.content,
        jobDescription: 'Python required.',
        sourceResumeId: draft.id,
      },
    });
    const interview = await request('/api/workspace/generate', {
      userId: 'review-gate-user',
      method: 'POST',
      body: {
        kind: 'interview',
        title: 'Interview preparation',
        resumeText: draft.content,
        sourceResumeId: draft.id,
      },
    });
    expect(analysis.status).toBe(409);
    expect(interview.status).toBe(409);
    expect(mockGenerationState.calls).toBe(modelCalls);
  });

  it('validates simulation and practice metadata on create and merged updates', async () => {
    const invalidSimulation = await request('/api/workspace/records', {
      userId: 'typed-record-user',
      method: 'POST',
      body: {
        kind: 'simulation',
        title: 'Customer scenario',
        content: '{"notes":"candidate-written"}',
        metadata: { scenarioId: 'support', stage: '' },
      },
    });
    expect(invalidSimulation.status).toBe(400);

    const simulation = await request('/api/workspace/records', {
      userId: 'typed-record-user',
      method: 'POST',
      body: {
        kind: 'simulation',
        title: 'Customer scenario',
        content: '{"notes":"candidate-written"}',
        metadata: { scenarioId: 'support', stage: 'opening' },
      },
    });
    expect(simulation.status).toBe(201);
    const savedSimulation = await simulation.json() as { id: number; content: string };
    expect(savedSimulation.content).toBe('{"notes":"candidate-written"}');

    const contentOnlyUpdate = await request(`/api/workspace/records/${savedSimulation.id}`, {
      userId: 'typed-record-user',
      method: 'PATCH',
      body: { content: 'Updated written response.' },
    });
    expect(contentOnlyUpdate.status).toBe(200);

    const invalidMergedMetadata = await request(`/api/workspace/records/${savedSimulation.id}`, {
      userId: 'typed-record-user',
      method: 'PATCH',
      body: { metadata: { scenarioId: 'support' } },
    });
    expect(invalidMergedMetadata.status).toBe(400);

    const invalidPractice = await request('/api/workspace/records', {
      userId: 'typed-record-user',
      method: 'POST',
      body: {
        kind: 'practice',
        title: 'Answer practice',
        content: 'Candidate-written answer.',
        metadata: {
          question: 'How do you prioritize?',
          category: 'behavioral',
          duration: 15,
          checks: [true, false, true],
          reflection: '',
        },
      },
    });
    expect(invalidPractice.status).toBe(400);
  });
});