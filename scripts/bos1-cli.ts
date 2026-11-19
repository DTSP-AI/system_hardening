/** Entry point for `npm run cli`. See scripts/bos1-cli-lib.ts. */
import dotenv from "dotenv";
import { runCli } from "./bos1-cli-lib";

dotenv.config({ quiet: true });

runCli(process.argv.slice(2), {
  env: { BOS1_URL: process.env.BOS1_URL, BOS1_API_KEY: process.env.BOS1_API_KEY },
  fetch: (url, init) => fetch(url, init),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
}).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
