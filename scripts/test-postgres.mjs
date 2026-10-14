import { localPostgres } from "./local-postgres.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
const port = await new Promise((done, reject) => { const server = createServer(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => done(address.port)); }); });
const directory = await mkdtemp(join(tmpdir(), "dmnp-postgres-tests-"));
const password = randomBytes(24).toString("hex");
const database = localPostgres({ directory, user: "dmnp_test", password, port });
let started = false;
try {
  await database.initialise(); await database.start(); started = true;
  console.log("Running tests against isolated local PostgreSQL; hosted credentials and provider keys are not used.");
  const files = process.argv.slice(2);
  process.exitCode = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", ...(files.length ? files : ["tests/fulfillment.test.ts", "tests/commerce.test.ts", "tests/auth.test.ts", "tests/email-code.test.ts", "tests/catalog.test.ts", "tests/delivery.test.ts", "tests/migration.test.ts", "tests/notifications.test.ts", "tests/security.test.ts", "tests/terms.test.ts"])], { stdio: "inherit", env: { ...process.env, DATABASE_URL: "", DMNP_TEST_DATABASE_URL: "postgresql://dmnp_test:" + password + "@127.0.0.1:" + port + "/postgres", RESEND_API_KEY: "", AUTH_EMAIL_FROM: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", FULFILLMENT_MODE: "manual", SUVAKRIO_API_KEY: "", BETTER_AUTH_SECRET: "isolated-test-secret-" + randomBytes(32).toString("hex") } });
    child.on("error", reject); child.on("exit", (code) => done(code ?? 1));
  });
} catch (error) { console.error("PostgreSQL test runner failed:", error instanceof Error ? error.message : "Unknown error"); process.exitCode = 1; }
finally { if (started) await database.stop(); if (resolve(directory).startsWith(resolve(tmpdir()) + sep)) await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); }
