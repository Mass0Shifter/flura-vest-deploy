// Vercel build: apply migrations (and seed demo data once) before building, when enabled.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: new URL("../../..", import.meta.url).pathname });

if (process.env.AUTO_MIGRATE === "true") {
  run("pnpm --filter @fluravest/core migrate");
  if (process.env.SEED_DEMO === "true") run("pnpm --filter @fluravest/core seed");
}
execSync("next build", { stdio: "inherit" });
