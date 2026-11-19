/**
 * The one place for every abuse limit. Must stay free of server-only imports:
 * MAX_UPLOAD_BYTES is imported by client code.
 */
export type LimitWindow = { windowMs: number; max: number };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Rolling 24h outbound call starts per user. */
export const CALL_DAILY: readonly LimitWindow[] = [{ windowMs: DAY_MS, max: 100 }];
export const CALL_TIME_LIMIT_SECONDS = 1800;

export const EMAIL_LIMITS: readonly LimitWindow[] = [
  { windowMs: HOUR_MS, max: 30 },
  { windowMs: DAY_MS, max: 200 },
];

/** Unused until the upload route enforces it (C6). */
export const UPLOAD_LIMITS: readonly LimitWindow[] = [
  { windowMs: HOUR_MS, max: 60 },
  { windowMs: DAY_MS, max: 300 },
];

/** Requests per API key (MCP and CLI). Bounds a leaked key or a runaway agent. */
export const API_KEY_LIMITS: readonly LimitWindow[] = [
  { windowMs: 60_000, max: 300 },
  { windowMs: HOUR_MS, max: 5000 },
];

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
