/**
 * Prepares the database the server tests run against: a throwaway local Postgres.
 *
 * - TEST_DATABASE_URL set (CI service container): use it as given.
 * - Otherwise: start (or reuse) the Docker container `bos1-test-pg` on port 54329.
 *
 * Then applies the Prisma migrations to it. Refuses any host that is not local,
 * so the tests can never reach a shared or production database.
 */
import { execSync, spawnSync } from "node:child_process";
import { DEFAULT_TEST_DATABASE_URL, assertLocalDatabaseUrl } from "../tests/helpers/test-db-url";

const CONTAINER = "bos1-test-pg";
const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
assertLocalDatabaseUrl(url);

function docker(args: string[]): { status: number; out: string } {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  return { status: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function ensureContainer() {
  const state = docker(["inspect", "-f", "{{.State.Running}}", CONTAINER]);
  if (state.status === 0 && state.out.trim() === "true") return;
  if (state.status === 0) {
    const started = docker(["start", CONTAINER]);
    if (started.status !== 0) throw new Error("test-db: could not start container: " + started.out);
    return;
  }
  const run = docker([
    "run", "-d", "--name", CONTAINER,
    "-e", "POSTGRES_PASSWORD=test", "-e", "POSTGRES_DB=bos1_test",
    "-p", "127.0.0.1:54329:5432",
    "--tmpfs", "/var/lib/postgresql/data",
    "postgres:17-alpine",
  ]);
  if (run.status !== 0) {
    throw new Error("test-db: could not create the test database container. Is Docker running?\n" + run.out);
  }
}

function waitReady() {
  for (let i = 0; i < 60; i++) {
    const r = docker(["exec", CONTAINER, "pg_isready", "-U", "postgres", "-d", "bos1_test"]);
    if (r.status === 0) return;
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]);
  }
  throw new Error("test-db: Postgres did not become ready");
}

if (!process.env.TEST_DATABASE_URL) {
  ensureContainer();
  waitReady();
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
