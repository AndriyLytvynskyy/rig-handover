// Plan morning-digest § 1. The contract every part of § 2 builds against; the reader is #2.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string; // ISO time with the offset as written; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Missing data is null, never dropped; views show it as '—'.
export type DigestRow = {
  job: string;
  owner: string | null; // from the job's last line
  runs: number; // lines for this job, every status
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null; // most recent `error` on any of the job's lines, even if it later went ok
  firstAt: string; // `at` of the job's first line, offset kept
  lastAt: string; // `at` of the job's last line, offset kept
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty when the file is empty ("nothing ran")
  counts: Record<RunStatus, number>; // lines per status, for the board link (§ 2c)
  badLines: number; // lines that didn't parse; counted, never thrown
};

// null: no runs/<night>.jsonl on disk (the page answers 404). An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Promise<Night | null>;
