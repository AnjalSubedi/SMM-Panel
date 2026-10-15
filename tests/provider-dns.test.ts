import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { providerRequest, ProviderError } from "../lib/server/suvakrio";
import { requestProviderWithPublicDns } from "../lib/server/provider-dns";
process.env.SUVAKRIO_API_KEY="isolated-dns-test-key";
const realFetch=globalThis.fetch;
const endpoint="https://suvakriosmm.com/api/v2";
const clearCache=()=>{delete (globalThis as typeof globalThis & {dmnpProviderAddress?:unknown}).dmnpProviderAddress;};
const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
function dnsFailure(code="ENOTFOUND") {return Object.assign(new TypeError("Mock transport failure"),{cause:{code}});}

test("DNS fallback recovers the Vercel failure without weakening TLS or repeating uncertain orders",async t=>{
  let nativeCalls=0;let lastOptions: https.RequestOptions|undefined;let sentBody="";let nativeError:string|null=null;
  const native=mock.method(https,"request",(url: unknown,options: https.RequestOptions,callback:(response:unknown)=>void)=>{
    nativeCalls++;assert.equal(String(url),endpoint);lastOptions=options;
    const request=new EventEmitter() as EventEmitter & {end:(body:string)=>void;destroy:()=>void};
    request.destroy=()=>undefined;
    request.end=body=>{sentBody=body;queueMicrotask(()=>{
      if(nativeError){request.emit("error",Object.assign(new Error("Mock TLS failure"),{code:nativeError}));return;}
      const response=new PassThrough() as PassThrough & {statusCode:number;headers:Record<string,string>};response.statusCode=200;response.headers={"content-type":"application/json"};
      callback(response);response.end(JSON.stringify(new URLSearchParams(body).get("action")==="add"?{order:12345}:{balance:"252.20",currency:"NPR"}));
    });};
    return request;
  });
  const reset=()=>{clearCache();nativeCalls=0;nativeError=null;lastOptions=undefined;sentBody="";};
  await t.test("a normal connection uses fetch and never enters the fallback",async()=>{
    reset();globalThis.fetch=async()=>json({balance:"1",currency:"NPR"});
    await providerRequest("balance");assert.equal(nativeCalls,0);
  });
  await t.test("ENOTFOUND uses a public HTTPS DNS answer and retains the original TLS hostname",async()=>{
    reset();let dnsCalls=0;
    globalThis.fetch=async(url,options)=>{
      if(String(url)===endpoint)throw dnsFailure();
      dnsCalls++;assert.equal(new URL(String(url)).searchParams.get("name"),"suvakriosmm.com");assert.equal(options?.body,undefined);assert.equal(String(url).includes(process.env.SUVAKRIO_API_KEY!),false);
      return json({Status:0,Answer:[{type:1,data:"93.184.216.34",TTL:120}]});
    };
    assert.deepEqual(await providerRequest("balance"),{balance:"252.20",currency:"NPR"});assert.equal(nativeCalls,1);assert.equal(dnsCalls,1);
    assert.equal(lastOptions!.servername,"suvakriosmm.com");assert.equal(lastOptions!.rejectUnauthorized,true);assert.equal(lastOptions!.agent,false);
    let resolved:unknown;lastOptions!.lookup!("suvakriosmm.com",{all:true},(error,address)=>{assert.equal(error,null);resolved=address;});
    assert.deepEqual(resolved,[{address:"93.184.216.34",family:4}]);assert.equal(new URLSearchParams(sentBody).get("key"),process.env.SUVAKRIO_API_KEY);
  });
  await t.test("an add request is sent once after a DNS failure, and timeout/TLS failures never retry",async()=>{
    reset();globalThis.fetch=async url=>{if(String(url)===endpoint)throw dnsFailure();return json({Status:0,Answer:[{type:1,data:"93.184.216.34",TTL:120}]});};
    assert.deepEqual(await providerRequest("add",{service:1728,quantity:100,link:"https://facebook.com/test"}),{order:12345});assert.equal(nativeCalls,1);
    for(const code of ["ETIMEDOUT","CERT_HAS_EXPIRED","ECONNRESET"]){
      reset();globalThis.fetch=async()=>{throw dnsFailure(code);};
      await assert.rejects(providerRequest("add",{service:1728}),e=>e instanceof ProviderError && e.code==="ambiguous");assert.equal(nativeCalls,0);
    }
  });
  await t.test("both trusted resolvers fail closed on private addresses",async()=>{
    reset();let dnsCalls=0;globalThis.fetch=async url=>{if(String(url)===endpoint)throw dnsFailure();dnsCalls++;return json({Status:0,Answer:[{type:1,data:"127.0.0.1",TTL:120},{type:1,data:"10.0.0.1",TTL:120}]});};
    await assert.rejects(providerRequest("balance"),e=>e instanceof ProviderError && e.code==="unavailable");assert.equal(dnsCalls,2);assert.equal(nativeCalls,0);
  });
  await t.test("a resolver failure can use the second resolver without sending any credentials to DNS",async()=>{
    reset();let dnsCalls=0;globalThis.fetch=async url=>{if(String(url)===endpoint)throw dnsFailure();dnsCalls++;return dnsCalls===1?json({Status:2}):json({Status:0,Answer:[{type:1,data:"93.184.216.34",TTL:120}]});};
    await providerRequest("balance");assert.equal(dnsCalls,2);assert.equal(nativeCalls,1);
  });
  await t.test("a TLS failure on the fallback stops without a second provider attempt",async()=>{
    reset();nativeError="CERT_HAS_EXPIRED";globalThis.fetch=async url=>{if(String(url)===endpoint)throw dnsFailure();return json({Status:0,Answer:[{type:1,data:"93.184.216.34",TTL:120}]});};
    await assert.rejects(providerRequest("add",{service:1728}),e=>e instanceof ProviderError&&e.code==="ambiguous");assert.equal(nativeCalls,1);assert.equal(lastOptions!.rejectUnauthorized,true);
  });
  await t.test("an expired original deadline prevents fallback requests",async()=>{
    reset();let dnsCalls=0;globalThis.fetch=async()=>{dnsCalls++;return json({});};const controller=new AbortController();controller.abort();
    await assert.rejects(requestProviderWithPublicDns("key=fake&action=balance",controller.signal));assert.equal(dnsCalls,0);assert.equal(nativeCalls,0);
  });
  native.mock.restore();
});
after(()=>{mock.restoreAll();clearCache();globalThis.fetch=realFetch;});
