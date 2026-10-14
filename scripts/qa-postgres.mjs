import { pathToFileURL } from "node:url";
import { localPostgres } from "./local-postgres.mjs";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
const productionSecurity = process.argv.includes("--production-security");
const seo = process.argv.includes("--seo");
const productionAccounts = process.argv.includes("--production-accounts");
const email = process.argv.includes("--email");
const production = productionSecurity || seo || productionAccounts || email;
const port = await new Promise((done, reject) => { const server = createServer(); server.on("error", reject); server.listen(0,"127.0.0.1",()=>{const address=server.address();server.close(()=>done(address.port));}); });
const directory = await mkdtemp(join(tmpdir(), "dmnp-postgres-browser-"));
const chromeDirectory = await mkdtemp(join(tmpdir(), "dmnp-postgres-chrome-"));
const password = randomBytes(24).toString("hex");
const postgres = localPostgres({ directory, user: "dmnp_test", password, port });
const databaseURL = "postgresql://dmnp_test:" + password + "@127.0.0.1:" + port + "/dmnp_qa";
const distDir = production ? ".next" : ".qa/next-pg-e2e-" + randomBytes(6).toString("hex");
const originalConfig = await readFile("tsconfig.json");
const originalNextEnv = await readFile("next-env.d.ts");
const env = { ...process.env, NODE_ENV: production ? "production" : "development", DATABASE_URL: databaseURL, QA_DATABASE_URL: databaseURL, NEXT_DIST_DIR: distDir, BETTER_AUTH_URL: "http://localhost:3002", ADMIN_EMAIL: "qa-owner@example.test", BETTER_AUTH_SECRET: "isolated-qa-secret-" + randomBytes(32).toString("hex"), GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", RESEND_API_KEY: "", AUTH_EMAIL_FROM: "", SUVAKRIO_API_KEY: "" };
if (email) { env.RESEND_API_KEY = "isolated-qa-mail-key"; env.AUTH_EMAIL_FROM = "Digital Marketing NP <accounts@example.test>"; env.QA_MAILBOX_FILE = join(directory, "mailbox.jsonl"); }
const run = (args) => new Promise((done,reject)=>{const child=spawn(process.execPath,args,{env,stdio:"inherit",windowsHide:true});child.on("error",reject);child.on("exit",code=>code===0?done():reject(new Error("QA command failed.")));});
const reachable = async url => { try { return (await fetch(url,{signal:AbortSignal.timeout(2000)})).ok; } catch { return false; } };
const ready = async (url, child) => { for(let i=0;i<180;i++){if(await reachable(url))return;if(child.exitCode!==null)throw new Error("QA process exited before ready.");await new Promise(done=>setTimeout(done,500));}throw new Error("QA process did not become ready."); };
const stop = async child => {if(!child || child.exitCode!==null)return;if(process.platform==="win32")await new Promise(done=>{const killer=spawn("taskkill",["/pid",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});killer.on("exit",done);});else child.kill("SIGTERM");};
let server,chrome,started=false,log="";
try {
  if(await reachable("http://localhost:3002/login") || await reachable("http://localhost:9223/json/version"))throw new Error("QA ports 3002 and 9223 must be free.");
  await postgres.initialise();await postgres.start();started=true;await postgres.createDatabase("dmnp_qa");
  await run(["--conditions=react-server","--import","tsx","scripts/setup-accounts.ts"]);
  await mkdir(".qa",{recursive:true});
  server=spawn(process.execPath,[...(email ? ["--import", pathToFileURL(resolve("scripts/qa-email-transport.mjs")).href] : []), "node_modules/next/dist/bin/next",production ? "start" : "dev","--port","3002"],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  server.stdout.on("data",d=>{log+=d;});server.stderr.on("data",d=>{log+=d;});server.on("error",()=>{});
  await ready("http://localhost:3002/login",server);
  if (seo) await run(["scripts/verify-seo-http.cjs"]);
  if (!production || productionAccounts) await run(["scripts/verify-accounts-http.cjs"]);
  const chromePath=process.env.QA_CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  chrome=spawn(chromePath,["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=9223","--user-data-dir="+chromeDirectory,"about:blank"],{stdio:"ignore",windowsHide:true});chrome.on("error",()=>{});
  await ready("http://localhost:9223/json/version",chrome);
  await run([email ? "scripts/verify-email-browser.cjs" : seo ? "scripts/verify-seo-browser.cjs" : productionSecurity ? "scripts/verify-security-browser.cjs" : "scripts/verify-accounts-browser.cjs"]);
  await writeFile(".qa/postgres-browser.log",log);
  console.log("PostgreSQL HTTP and browser checks passed. No hosted database or provider credentials used.");
} catch(error) {await mkdir(".qa",{recursive:true});await writeFile(".qa/postgres-browser-failure.log",log);console.error(error instanceof Error ? error.message : "QA failed");process.exitCode=1;}
finally {
  await stop(chrome);await stop(server);if(started)await postgres.stop();
  await writeFile("tsconfig.json",originalConfig);
  await writeFile("next-env.d.ts",originalNextEnv);
  for(const folder of [directory,chromeDirectory])if(resolve(folder).startsWith(resolve(tmpdir())+sep))await rm(folder,{recursive:true,force:true,maxRetries:20,retryDelay:250});
}
