import { localPostgres } from "./local-postgres.mjs";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
const port = await new Promise((done, reject) => { const server = createServer(); server.on("error", reject); server.listen(0,"127.0.0.1",()=>{const address=server.address();server.close(()=>done(address.port));}); });
const directory = await mkdtemp(join(tmpdir(), "dmnp-postgres-browser-"));
const chromeDirectory = await mkdtemp(join(tmpdir(), "dmnp-postgres-chrome-"));
const password = randomBytes(24).toString("hex");
const postgres = localPostgres({ directory, user: "dmnp_test", password, port });
const databaseURL = "postgresql://dmnp_test:" + password + "@127.0.0.1:" + port + "/dmnp_qa";
const env = { ...process.env, DATABASE_URL: databaseURL, QA_DATABASE_URL: databaseURL, NEXT_DIST_DIR: ".qa/next-pg-e2e", BETTER_AUTH_URL: "http://localhost:3002", ADMIN_EMAIL: "qa-owner@example.test", BETTER_AUTH_SECRET: "isolated-qa-secret-" + randomBytes(32).toString("hex"), GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", RESEND_API_KEY: "", AUTH_EMAIL_FROM: "", SUVAKRIO_API_KEY: "" };
const run = (args) => new Promise((done,reject)=>{const child=spawn(process.execPath,args,{env,stdio:"inherit",windowsHide:true});child.on("error",reject);child.on("exit",code=>code===0?done():reject(new Error("QA command failed.")));});
const reachable = async url => { try { return (await fetch(url,{signal:AbortSignal.timeout(2000)})).ok; } catch { return false; } };
const ready = async (url, child) => { for(let i=0;i<180;i++){if(await reachable(url))return;if(child.exitCode!==null)throw new Error("QA process exited before ready.");await new Promise(done=>setTimeout(done,500));}throw new Error("QA process did not become ready."); };
const stop = async child => {if(!child || child.exitCode!==null)return;if(process.platform==="win32")await new Promise(done=>{const killer=spawn("taskkill",["/pid",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});killer.on("exit",done);});else child.kill("SIGTERM");};
let server,chrome,started=false;
try {
  if(await reachable("http://localhost:3002/login") || await reachable("http://localhost:9223/json/version"))throw new Error("QA ports 3002 and 9223 must be free.");
  await postgres.initialise();await postgres.start();started=true;await postgres.createDatabase("dmnp_qa");
  await run(["--conditions=react-server","--import","tsx","scripts/setup-accounts.ts"]);
  await mkdir(".qa",{recursive:true});
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--port","3002"],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  let log="";server.stdout.on("data",d=>{log+=d;});server.stderr.on("data",d=>{log+=d;});server.on("error",()=>{});
  await ready("http://localhost:3002/login",server);
  await run(["scripts/verify-accounts-http.cjs"]);
  const chromePath=process.env.QA_CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  chrome=spawn(chromePath,["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=9223","--user-data-dir="+chromeDirectory,"about:blank"],{stdio:"ignore",windowsHide:true});chrome.on("error",()=>{});
  await ready("http://localhost:9223/json/version",chrome);
  await run(["scripts/verify-accounts-browser.cjs"]);
  await writeFile(".qa/postgres-browser.log",log);
  console.log("PostgreSQL HTTP and browser checks passed. No hosted database or provider credentials used.");
} catch(error) {console.error(error instanceof Error ? error.message : "QA failed");process.exitCode=1;}
finally {
  await stop(chrome);await stop(server);if(started)await postgres.stop();
  const config=JSON.parse(await readFile("tsconfig.json","utf8"));config.include=config.include.filter(path=>!path.startsWith(".qa/next-pg-e2e/"));await writeFile("tsconfig.json",JSON.stringify(config,null,2)+"\n");
  for(const folder of [directory,chromeDirectory])if(resolve(folder).startsWith(resolve(tmpdir())+sep))await rm(folder,{recursive:true,force:true,maxRetries:20,retryDelay:250});
}
