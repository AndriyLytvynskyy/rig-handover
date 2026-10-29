import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  it('reads 5 jobs and 1 bad line', async () => {
    const night = await readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('builds rows from the lines, offsets kept', async () => {
    const rows = (await readNight('runs', '2026-10-28'))?.rows ?? [];
    const row = (job: string) => rows.find((r) => r.job === job);
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row('lane/sync')).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(row('notes/backup')).toMatchObject({ owner: 'lane-07', lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastError: null });
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rig-runs-'));
    await writeFile(join(dir, '2026-01-01.jsonl'), '');
    await writeFile(
      join(dir, '2026-01-02.jsonl'),
      [
        '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '   ',
        '{"at":"2026-01-02T02:00:00+01:00","job":"a","status":"done","owner":"rook"}',
        '{"at":"2026-01-02T03:00:00+01:00","job":"a","status":"ok"}',
        '[1,2]',
        '',
      ].join('\n'),
    );
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('missing file → null', async () => {
    expect(await readNight(dir, '2026-01-09')).toBeNull();
  });

  it('empty file → no rows, zero counts', async () => {
    expect(await readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('a night that is not YYYY-MM-DD → null', async () => {
    expect(await readNight(dir, '../2026-01-01')).toBeNull();
    expect(await readNight(dir, '2026-01-01.jsonl')).toBeNull();
    expect(await readNight(dir, '')).toBeNull();
  });

  it('JSON that is not a RunLine is bad; blank lines are skipped', async () => {
    const night = await readNight(dir, '2026-01-02');
    expect(night?.badLines).toBe(3);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
    expect(night?.rows).toHaveLength(1);
  });
});
