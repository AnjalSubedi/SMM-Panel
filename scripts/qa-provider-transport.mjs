import { readFile, appendFile } from "node:fs/promises";
import assert from "node:assert/strict";
assert.equal(process.env.SUVAKRIO_API_KEY, "isolated-qa-provider-key");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "127.0.0.1");
const catalog = JSON.parse(await readFile(new URL("../data/suvakrio-services.json",import.meta.url),"utf8"));
const realFetch=globalThis.fetch; let counter=10000; const orders=new Map();
globalThis.fetch=async (url,options)=>{
  const address=String(url instanceof Request?url.url:url);
  if (new URL(address).hostname === "localhost" || new URL(address).hostname === "127.0.0.1") return realFetch(url,options);
  assert.equal(address,"https://suvakriosmm.com/api/v2","QA blocks every unmocked external request");
  const form=new URLSearchParams(typeof options?.body==="string"?options.body:url instanceof Request?await url.clone().text():String(options?.body));
  assert.equal(form.get("key"),"isolated-qa-provider-key");
  const json=value=>new Response(JSON.stringify(value),{status:200});
  switch(form.get("action")) {
    case "services":return json(catalog);
    case "balance":return json({balance:"1000000",currency:"NPR"});
    case "add":{
      const id=String(++counter);orders.set(id,{status:"Completed",remains:"0",currency:"NPR"});
      await appendFile(process.env.QA_PROVIDER_FILE,JSON.stringify({id,...Object.fromEntries([...form].filter(([key])=>key!=="key"))})+"\n");
      return json({order:Number(id)});
    }
    case "status":return form.has("orders")?json(Object.fromEntries(form.get("orders").split(",").map(id=>[id,orders.get(id)??{error:"Incorrect order ID"}]))):json(orders.get(form.get("order"))??{error:"Incorrect order ID"});
    default:throw new Error("Unexpected mock provider action");
  }
};
