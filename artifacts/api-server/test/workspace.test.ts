import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo, Server } from 'node:net';

const mockDbState = vi.hoisted(() => ({
  records: [] as Array<Record<string, unknown>>,
  nextId: 1,
}));

vi.mock('@clerk/express', () => ({
  getAuth: (request: { headers: Record<string, string | string[] | undefined> }) => {
    const value = request.headers['x-test-user'];
    return { userId: typeof value === 'string' ? value : null };
  },
}));

vi.mock('@workspace/db', async () => {
  const [{ workspaceRecordsTable }, { PgDialect }] = await Promise.all([
    import('@workspace/db/schema'),
    import('drizzle-orm/pg-core'),
  ]);
  const dialect = new PgDialect();
  const fields = [
    ['id', 'id'],
    ['user_id', 'userId'],
    ['kind', 'kind'],
  ] as const;

  function matchingRecords(condition: unknown): Array<Record<string, unknown>> {
    const query = dialect.sqlToQuery(condition as never);
    return mockDbState.records.filter((record) =>
      fields.every(([column, property]) => {
        const match = query.sql.match(
          new RegExp(`"workspace_records"\\."${column}"\\s*=\\s*\\$(\\d+)`),
        );
        return !match || record[property] === query.params[Number(match[1]) - 1];
      }),
    );
  }

  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          orderBy: async () =>
            matchingRecords(condition)
              .slice()
              .sort((a, b) => {
                const aDate = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
                const bDate = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
                return bDate - aDate;
              })
              .map((record) => structuredClone(record)),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const now = new Date();
          const record = {
            ...values,
            id: mockDbState.nextId++,
            createdAt: now,
            updatedAt: now,
          };
          mockDbState.records.push(record);
          return [structuredClone(record)];
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const record = matchingRecords(condition)[0];
            if (!record) return [];
            Object.assign(record, values);
            return [structuredClone(record)];
          },
        }),
      }),
    }),
    delete: () => ({
      where: (condition: unknown) => ({
        returning: async () => {
          const matches = matchingRecords(condition);
          const ids = new Set(matches.map((record) => record.id));
          mockDbState.records = mockDbState.records.filter((record) => !ids.has(record.id));
          return matches.map((record) => ({ id: record.id }));
        },
      }),
    }),
  };

  return { db, workspaceRecordsTable };
});

vi.mock('@workspace/integrations-openai-ai-server', () => ({
  openai: {
    chat: {
      completions: {
        create: async () => ({ choices: [] }),
      },
    },
  },
}));

import workspaceRouter from '../src/routes/workspace';

const app = express();
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
  mockDbState.nextId = 1;
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
      request('/api/workspace/records', { method: 'POST', body: {} }),
      request('/api/workspace/records/1', { method: 'PATCH', body: {} }),
      request('/api/workspace/records/1', { method: 'DELETE' }),
      request('/api/workspace/generate', { method: 'POST', body: {} }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
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
});