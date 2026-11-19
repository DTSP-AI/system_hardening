export const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:54329/bos1_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Throws unless the URL points at this machine. Server tests truncate tables. */
export function assertLocalDatabaseUrl(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("test database URL is not a valid URL");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`refusing to run tests against a non-local database host: ${host}`);
  }
}
