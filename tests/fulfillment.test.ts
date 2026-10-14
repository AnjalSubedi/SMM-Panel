import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/postgres";
import { termsAcceptance } from "../lib/terms";
process.env.FULFILLMENT_MODE = "automatic";
process.env.SUVAKRIO_API_KEY = "isolated-fake-provider-key";
process.env.SERVICE_MARKUP_PERCENT = "75";
process.env.ADMIN_EMAIL = "owner@example.test";
let database: Awaited<ReturnType<typeof testDatabase>>;
const originalFetch = globalThis.fetch;
test("automatic fulfillment uses mocked provider and isolated PostgreSQL", async t => {
  database = await testDatabase();
  const { getDb } = await import("../lib/server/db");
  const { createOrder, chooseDelivery, reviewPayment, updateOrderStatus, accountData } = await import("../lib/server/commerce");
  const { runFulfillment, reconcileProviderOrder, cronAuthorized } = await import("../lib/server/fulfillment");
  const { liveRetailCatalog } = await import("../lib/server/suvakrio");
  const { savedProviderCatalog, deliveryTargets, providerCostPaisa } = await import("../lib/fulfillmentCatalog");
  const db = getDb(); const customer = { id: randomUUID(), email: "customer@example.test", name: "Customer", emailVerified: true, isAdmin: false };
  const owner = { ...customer, id: randomUUID(), email: "owner@example.test", name: "Owner", isAdmin: true };
  for (const user of [customer, owner]) await db.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,TRUE,NOW(),NOW())', [user.id,user.name,user.email]);
  await db.query('INSERT INTO "appWallet"("userId","balancePaisa") VALUES($1,1000000000)', [customer.id]);
  let catalog = savedProviderCatalog.map(p => ({...p}));
  let addMode = "ok"; let balance = 1000000; let counter = 9000;
  const adds: URLSearchParams[] = []; const providerOrders = new Map<string,{status:string;remains:number;currency:string}>();
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://suvakriosmm.com/api/v2", "All external network requests must be mocked");
    const form = new URLSearchParams(String(options?.body)); assert.equal(form.get("key"), "isolated-fake-provider-key");
    const json = (value: unknown) => new Response(JSON.stringify(value), {status:200});
    switch(form.get("action")) {
      case "services": return json(catalog);
      case "balance": return json({balance:String(balance),currency:"NPR"});
      case "add": {
        adds.push(form);
        if (addMode === "reject") return json({error:"Service unavailable"});
        if (addMode === "balance") return json({error:"Not enough balance"});
        const id = String(++counter); providerOrders.set(id,{status:"Pending",remains:Number(form.get("quantity"))*Number(form.get("runs")||1),currency:"NPR"});
        if(addMode === "timeout") throw new Error("Simulated connection loss after acceptance");
        return json({order:Number(id)});
      }
      case "status": return form.has("orders") ? json(Object.fromEntries(form.get("orders")!.split(",").map(id => [id,providerOrders.get(id) ?? {error:"Incorrect order ID"}]))) : json(providerOrders.get(form.get("order")!) ?? {error:"Incorrect order ID"});
      default: throw new Error("Unexpected provider action");
    }
  };
  async function invalidate() {
    delete (globalThis as typeof globalThis & { dmnpProviderCatalog?: unknown }).dmnpProviderCatalog;
    await db.query('DELETE FROM "appProviderCatalog"');
  }
  async function input(itemId="IG_06",quantity=1000,method="wallet") {
    const c = await liveRetailCatalog(); const item = [...c.services,...c.packages].find(s=>s.id===itemId)!;
    const expectedAmountPaisa = item.kind === "package" ? Math.round(item.price*100) : Math.round(Math.round(item.price*100)*quantity/(item.unitSize??1));
    return {...termsAcceptance(),itemId,quantity,method,expectedAmountPaisa,requestKey:randomUUID(),links:deliveryTargets(item).map(target=>({platform:target.platform,...(target.key!==target.platform?{target:target.key}:{}),url:"https://"+(target.platform==="Facebook"?"facebook.com":target.platform==="Instagram"?"instagram.com":"youtube.com")+"/"+(target.key.endsWith(":content")?"video-test":"profile-test")})),...(method==="direct"?{reference:"TEST-"+randomUUID()}: {})};
  }
  async function state(id:string) { return (await db.query('SELECT status FROM "appOrder" WHERE id=$1',[id])).rows[0].status; }
  async function jobs(id:string) { return (await db.query('SELECT * FROM "appFulfillment" WHERE "orderId"=$1 ORDER BY step',[id])).rows; }
  async function checkStatus(id:string,status:string,remains:number) {
    const job=(await jobs(id))[0]; providerOrders.set(job.providerOrderId,{status,remains,currency:"NPR"});
    await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[id]);
    await runFulfillment({orderId:id});
  }
  await t.test("prices use provider cost plus markup; unmapped and custom-input services cannot be bought",async()=>{
    const c = await liveRetailCatalog(); const ig=c.services.find(s=>s.id==="IG_01")!;
    assert.equal(ig.price,Math.ceil(providerCostPaisa(ig.id,1000,catalog.find(p=>p.service===ig.providerServiceId)!)*1.75)/100);
    assert.equal(c.services.length,58);
    assert.equal(c.services.find(s=>s.id==="YT_01")!.automaticDeliveryAvailable,false);
    assert.equal(c.services.find(s=>s.id==="IG_11")!.automaticDeliveryAvailable,false);
    assert.equal(c.packages[3].automaticDeliveryAvailable,false);
    await assert.rejects(createOrder(await input("YT_01",1000),customer),/unavailable/);
  });
  let paid = "";
  await t.test("wallet debit and durable jobs are atomic; concurrent workers submit one actual provider ID",async()=>{
    const raw=await input(); const before=(await accountData(customer)).balancePaisa;
    const order=await createOrder(raw,customer);paid=order.id;
    assert.equal((await accountData(customer)).balancePaisa,before-order.amountPaisa);
    const again=await createOrder(raw,customer);assert.equal(again.id,paid);
    const count=adds.length;await Promise.all([runFulfillment({orderId:paid}),runFulfillment({orderId:paid}),runFulfillment({orderId:paid})]);
    assert.equal(adds.length,count+1);assert.equal(adds.at(-1)!.get("service"),"1688");assert.equal(adds.at(-1)!.get("quantity"),"1000");
    assert.equal(await state(paid),"submitted");await runFulfillment({orderId:paid});assert.equal(adds.length,count+1);
    assert.equal((await accountData(customer)).balancePaisa,before-order.amountPaisa);
    await assert.rejects(updateOrderStatus({orderId:paid,status:"completed",note:"verified provider"},owner.id),/automatic delivery/);
    process.env.FULFILLMENT_MODE="manual";
    await assert.rejects(updateOrderStatus({orderId:paid,status:"completed",note:"manual emergency test"},owner.id),/automatic delivery/);
    process.env.FULFILLMENT_MODE="automatic";
    process.env.SUVAKRIO_API_KEY="";assert.equal((await createOrder(raw,customer)).id,paid);process.env.SUVAKRIO_API_KEY="isolated-fake-provider-key";
  });
  await t.test("provider status drives in-progress and completion",async()=>{
    await checkStatus(paid,"In progress",500);assert.equal(await state(paid),"processing");
    await checkStatus(paid,"Completed",0);assert.equal(await state(paid),"completed");
  });
  await t.test("direct payment and timing gate dispatch; native drip uses per-run quantities",async()=>{
    const order=await createOrder(await input("FB_03",100,"direct"),customer);const count=adds.length;
    await runFulfillment({orderId:order.id});assert.equal(adds.length,count);
    const payment=(await db.query('SELECT id FROM "appPayment" WHERE "orderId"=$1',[order.id])).rows[0];
    await reviewPayment({paymentId:payment.id,decision:"approve",confirmedReceived:true,note:"Verified amount and reference"},owner.id);
    assert.equal(await state(order.id),"awaiting_delivery");await runFulfillment({orderId:order.id});assert.equal(adds.length,count);
    await chooseDelivery({orderId:order.id,deliveryWindowMinutes:60},customer);await runFulfillment({orderId:order.id});
    const form=adds.at(-1)!;assert.equal(form.get("service"),"1768");assert.equal(Number(form.get("quantity"))*Number(form.get("runs")),100);assert.ok(Number(form.get("runs"))>1);
    assert.equal((Number(form.get("runs"))-1)*Number(form.get("interval")),60);
  });
  await t.test("bundle steps get distinct page/content links and fixed packs are not multiplied",async()=>{
    const c=await liveRetailCatalog(); const bundle=c.packages[0];assert.equal(bundle.automaticDeliveryAvailable,true);
    const raw=await input(bundle.id,1);assert.equal(raw.links.length,2);
    const order=await createOrder(raw,customer);const count=adds.length;await runFulfillment({orderId:order.id});
    const submitted=adds.slice(count);assert.equal(submitted.length,2);assert.deepEqual(submitted.map(f=>Number(f.get("service"))),[1731,1741]);
    assert.deepEqual(submitted.map(f=>Number(f.get("quantity"))),[10000,1]);assert.equal((await jobs(order.id))[1].payload.costPaisa,Math.ceil(catalog.find(p=>p.service===1741)!.rate*100/1000));assert.notEqual(submitted[0].get("link"),submitted[1].get("link"));
  });
  await t.test("insufficient provider balance is queued for safe retry without duplicate customer debit",async()=>{
    const order=await createOrder(await input(),customer);const count=adds.length;balance=0;await runFulfillment({orderId:order.id});
    assert.equal(adds.length,count);assert.equal(await state(order.id),"queued");balance=1000000;
    await db.query('UPDATE "appFulfillment" SET "nextAttemptAt"=NOW() WHERE "orderId"=$1',[order.id]);await runFulfillment({orderId:order.id});assert.equal(adds.length,count+1);
  });
  await t.test("uncertain acceptance never retries add; admin can link its existing reference",async()=>{
    const order=await createOrder(await input(),customer);const count=adds.length;addMode="timeout";await runFulfillment({orderId:order.id});addMode="ok";
    assert.equal(await state(order.id),"needs_attention");assert.equal(adds.length,count+1);
    await runFulfillment({orderId:order.id});await runFulfillment({orderId:order.id});assert.equal(adds.length,count+1);
    const job=(await jobs(order.id))[0];await assert.rejects(reconcileProviderOrder(order.id,job.id,String(counter),customer.id),/Administrator/);
    await reconcileProviderOrder(order.id,job.id,String(counter),owner.id);assert.equal(await state(order.id),"submitted");await runFulfillment({orderId:order.id});assert.equal(adds.length,count+1);
  });
  await t.test("explicit rejection returns account funds once; partial and cancelled deliveries refund undelivered units",async()=>{
    const before=(await accountData(customer)).balancePaisa;const rejected=await createOrder(await input(),customer);
    addMode="reject";await runFulfillment({orderId:rejected.id});addMode="ok";assert.equal(await state(rejected.id),"delivery_failed");
    assert.equal((await accountData(customer)).balancePaisa,before);await runFulfillment({orderId:rejected.id});assert.equal((await accountData(customer)).balancePaisa,before);
    const partial=await createOrder(await input(),customer);await runFulfillment({orderId:partial.id});const afterDebit=(await accountData(customer)).balancePaisa;
    await checkStatus(partial.id,"Partial",400);assert.equal(await state(partial.id),"partial");assert.equal((await accountData(customer)).balancePaisa,afterDebit+Math.floor(partial.amountPaisa*0.4));
    await runFulfillment({orderId:partial.id});assert.equal((await jobs(partial.id))[0].refundedPaisa,Math.floor(partial.amountPaisa*0.4));
    const cancelled=await createOrder(await input(),customer);await runFulfillment({orderId:cancelled.id});await checkStatus(cancelled.id,"Canceled",1000);assert.equal((await jobs(cancelled.id))[0].refundedPaisa,cancelled.amountPaisa);
  });
  await t.test("legacy queued test order is recovered without changing its paid price",async()=>{
    const id=randomUUID();await db.query(`INSERT INTO "appOrder"(id,"userId",email,"itemId","itemKind","itemName",quantity,"amountPaisa",links,method,status,"requestScope","requestKey","createdAt","updatedAt") VALUES($1,$2,$3,'FB_02','service','Facebook followers',100,1290,$4,'wallet','queued',$5,$6,$7,$7)`,[id,customer.id,customer.email,JSON.stringify([{platform:"Facebook",url:"https://facebook.com/profile-test"}]),"user:"+customer.id,randomUUID(),new Date().toISOString()]);
    const balance=(await accountData(customer)).balancePaisa;await runFulfillment({orderId:id});assert.equal(await state(id),"submitted");assert.equal((await accountData(customer)).balancePaisa,balance);assert.equal((await jobs(id))[0].retailPaisa,1290);
  });
  await t.test("stale prices and unsupported drip stop safely before taking payment or dispatching",async()=>{
    const raw=await input("IG_06",1000);const before=(await accountData(customer)).balancePaisa;
    catalog=catalog.map(p=>p.service===1688?{...p,rate:p.rate*2}:p);await invalidate();await assert.rejects(createOrder(raw,customer),/price has updated/);assert.equal((await accountData(customer)).balancePaisa,before);
    const timed=await createOrder(await input("FB_03",100),customer);catalog=catalog.map(p=>p.service===1768?{...p,dripfeed:false}:p);await invalidate();
    await assert.rejects(chooseDelivery({orderId:timed.id,deliveryWindowMinutes:60},customer),/Timed delivery is unavailable/);assert.equal(await state(timed.id),"awaiting_delivery");
  });
  await t.test("interrupted submissions and missing provider references pause without resubmission",async()=>{
    const interrupted=await createOrder(await input(),customer);const count=adds.length;
    await db.query(`UPDATE "appFulfillment" SET state='submitting',"leaseUntil"=NOW()-INTERVAL '1 minute' WHERE "orderId"=$1`,[interrupted.id]);
    await runFulfillment({orderId:interrupted.id});assert.equal(await state(interrupted.id),"needs_attention");assert.equal(adds.length,count);
    const missing=await createOrder(await input(),customer);await runFulfillment({orderId:missing.id});
    const job=(await jobs(missing.id))[0];providerOrders.delete(job.providerOrderId);
    await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE id=$1',[job.id]);
    await runFulfillment({orderId:missing.id});assert.equal(await state(missing.id),"needs_attention");assert.equal(adds.length,count+1);
  });
  await t.test("explicit add balance rejection retries safely, while a post-payment cost rise refunds instead of losing money",async()=>{
    const order=await createOrder(await input(),customer);const count=adds.length;addMode="balance";await runFulfillment({orderId:order.id});addMode="ok";
    assert.equal(await state(order.id),"queued");assert.equal((await jobs(order.id))[0].providerOrderId,null);
    await db.query('UPDATE "appFulfillment" SET "nextAttemptAt"=NOW() WHERE "orderId"=$1',[order.id]);await runFulfillment({orderId:order.id});assert.equal(await state(order.id),"submitted");assert.equal(adds.length,count+2);
    const before=(await accountData(customer)).balancePaisa;const expensive=await createOrder(await input(),customer);const sent=adds.length;
    catalog=catalog.map(p=>p.service===1688?{...p,rate:p.rate*10}:p);await invalidate();
    await runFulfillment({orderId:expensive.id});assert.equal(await state(expensive.id),"delivery_failed");assert.equal(adds.length,sent);assert.equal((await accountData(customer)).balancePaisa,before);
  });
  await t.test("cron is closed without the configured bearer secret",async()=>{
    delete process.env.CRON_SECRET;assert.equal(cronAuthorized(new Headers()),false);process.env.CRON_SECRET="isolated-cron-secret";
    assert.equal(cronAuthorized(new Headers({authorization:"Bearer wrong"})),false);assert.equal(cronAuthorized(new Headers({authorization:"Bearer isolated-cron-secret"})),true);
  });
});
after(async()=>{globalThis.fetch=originalFetch;if(database)await database.close();});
