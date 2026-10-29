import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

const normal =
  [
    line('2026-10-29T01:00:00+01:00', 'b/job', 'ok', 'rook'),
    line('2026-10-29T01:10:00+01:00', 'a/flaky', 'retry', 'rook', 'upstream 503'),
    line('2026-10-29T01:11:00+01:00', 'a/flaky', 'retry', 'rook', 'upstream 503'),
    line('2026-10-29T01:12:00+01:00', 'a/flaky', 'retry', 'rook', 'upstream 503'),
    line('2026-10-29T01:13:00+01:00', 'a/flaky', 'ok', 'rook'),
    line('2026-10-29T01:20:00+01:00', 'c/broken', 'fail', null, 'quota exceeded'),
  ].join('\n') + '\n';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rig-routes-'));
  await writeFile(join(dir, '2026-01-01.jsonl'), normal);
  await writeFile(join(dir, '2026-01-02.jsonl'), '');
  await writeFile(
    join(dir, '2026-01-03.jsonl'),
    line('2026-01-04T01:00:00+01:00', 'x/job', 'ok', 'rook') + '\n{"at":"2026-01-04T01:01:00+01:00","job":"x/jo\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const pageJobs = (html: string) =>
  [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].flatMap((m) => (m[1] ? [m[1]] : []));

describe('GET /digest/:night', () => {
  it('200 on a normal night, with retry and fail flagged', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('3 (many)');
    expect(html).toContain('fail (!)');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });

  it('empty night says nothing ran', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line still renders, with the notice', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/1 line couldn(&#39;|')t be read/);
    expect(html).toContain('x/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 on a normal night', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.find((r) => r.job === 'a/flaky')).toMatchObject({ retries: 3, lastStatus: 'ok' });
    expect(body.rows.find((r) => r.job === 'c/broken')).toMatchObject({ lastStatus: 'fail', owner: null });
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-01-09' });
  });

  it('empty night has no rows', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(((await res.json()) as Night).rows).toEqual([]);
  });

  it('bad-line night is 200 with badLines 1', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    expect(body.rows.map((r) => r.job)).toEqual(['a/flaky', 'b/job', 'c/broken']);
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
