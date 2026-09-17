import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) { console.log(".env.local already exists; left unchanged."); }
else {
  writeFileSync(".env.local", `TURSO_DATABASE_URL=file:./local.db\nTURSO_AUTH_TOKEN=\nBETTER_AUTH_URL=http://127.0.0.1:3000\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nCRON_SECRET=${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
  console.log("Created a local-only .env.local with random secrets. Run npm run db:migrate next.");
}
