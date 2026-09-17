import "./env";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createPerson } from "../src/lib/user-service";
import { client } from "../src/db";
const rl = createInterface({ input: stdin, output: stdout });
try {
  const name = await rl.question("HOD name: ");
  const username = await rl.question("JS ID: ");
  // The secret comes from a process-scoped environment variable, never an argv
  // parameter or a printed prompt. The README includes hidden-input commands.
  const password = process.env.SETUP_HOD_PASSWORD;
  if (!password) throw new Error("Set the process environment variable SETUP_HOD_PASSWORD first. See README.md.");
  await createPerson(null, { name, username, password, role: "hod" }, true);
  console.log("HOD created. Sign in with this JS ID and change the temporary password.");
} catch (error) { console.error(error instanceof Error ? error.message : "Setup failed."); process.exitCode = 1; }
finally { delete process.env.SETUP_HOD_PASSWORD; rl.close(); client.close(); }
