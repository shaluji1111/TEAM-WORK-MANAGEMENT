import { mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
mkdirSync(".test-db", { recursive: true });
const production = process.env.E2E_PRODUCTION === "1";
const env = { ...process.env,
  NEXT_DIST_DIR: production ? ".next" : ".next-e2e",
  TURSO_DATABASE_URL: `file:./.test-db/e2e-${crypto.randomUUID()}.db`, TURSO_AUTH_TOKEN: "",
  BETTER_AUTH_SECRET: "e2e-only-secret-32-characters-not-for-production",
  CRON_SECRET: "e2e-only-cron-secret", BETTER_AUTH_URL: "http://127.0.0.1:3101"
};
for (const script of ["scripts/migrate.ts", "scripts/seed-demo.ts"]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], { env, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3101"], { env, stdio: "inherit", windowsHide: true });
process.on("SIGTERM", () => child.kill()); process.on("SIGINT", () => child.kill());
child.on("exit", code => process.exit(code || 0));
