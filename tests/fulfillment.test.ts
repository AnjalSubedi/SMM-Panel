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
  let catalogUnavailable = false;
  let balanceFailure: string | null = null;
  let rejectService: number | null = null; let timeoutService: number | null = null;
  let addMode = "ok"; let balance = 1000000; let counter = 9000;
  const adds: URLSearchParams[] = []; const providerOrders = new Map<string,{status:string;remains:unknown;currency:string}>();
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://suvakriosmm.com/api/v2", "All external network requests must be mocked");
    const form = new URLSearchParams(String(options?.body)); assert.equal(form.get("key"), "isolated-fake-provider-key");
    const json = (value: unknown) => new Response(JSON.stringify(value), {status:200});
    switch(form.get("action")) {
      case "services": if (catalogUnavailable) throw new Error("Mock provider unavailable"); return json(catalog);
      case "balance": return balanceFailure ? json({error:balanceFailure}) : json({balance:String(balance),currency:"NPR"});
      case "add": {
        adds.push(form);
        if (addMode === "reject" || Number(form.get("service")) === rejectService) return json({error:"Service unavailable"});
        if (addMode === "balance") return json({error:"Not enough balance"});
        const id = String(++counter); providerOrders.set(id,{status:"Pending",remains:Number(form.get("quantity"))*Number(form.get("runs")||1),currency:"NPR"});
        if(addMode === "timeout" || Number(form.get("service")) === timeoutService) throw new Error("Simulated connection loss after acceptance");
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
  await t.test("a durable lease works across connections, expires, and only its owner can renew or release it",async()=>{
    const {claimFulfillmentLease,renewFulfillmentLease,releaseFulfillmentLease}=await import("../lib/server/fulfillment-lease");
    const a=await db.connect(),b=await db.connect();
    try {
      const token=await claimFulfillmentLease(a);assert.ok(token);
      assert.equal(await claimFulfillmentLease(b),null,"A different backend cannot start a second worker");
      assert.equal(await renewFulfillmentLease(b,token),true,"Ownership is independent of the backend session");
      await db.query(`UPDATE "appFulfillmentWorker" SET "leaseUntil"=NOW()-INTERVAL '1 second' WHERE id=1`);
      const replacement=await claimFulfillmentLease(b);assert.ok(replacement);assert.notEqual(token,replacement);
      await releaseFulfillmentLease(a,token);assert.equal(await claimFulfillmentLease(a),null,"An expired owner cannot delete its replacement's lease");
      assert.equal(await renewFulfillmentLease(a,token),false);await releaseFulfillmentLease(b,replacement);
      const final=await claimFulfillmentLease(a);assert.ok(final);await releaseFulfillmentLease(b,final);
    } finally {a.release();b.release();}
  });
  await t.test("prices use provider cost plus markup; unmapped and custom-input services cannot be bought",async()=>{
    const c = await liveRetailCatalog(); const ig=c.services.find(s=>s.id==="IG_01")!;
    assert.equal(ig.price,Math.ceil(providerCostPaisa(ig.id,1000,catalog.find(p=>p.service===ig.providerServiceId)!)*1.75)/100);
    assert.equal(c.services.length,58);
    assert.equal(c.services.find(s=>s.id==="YT_01")!.automaticDeliveryAvailable,false);
    assert.equal(c.services.find(s=>s.id==="IG_11")!.automaticDeliveryAvailable,false);
    assert.equal(c.packages[3].automaticDeliveryAvailable,false);
    await assert.rejects(createOrder(await input("YT_01",1000),customer),/unavailable/);
  });
  await t.test("private provider diagnostics identify authentication failures without storing the key or raw reply",async()=>{
    await invalidate();balanceFailure="Invalid API key " + process.env.SUVAKRIO_API_KEY;
    try {
      await assert.rejects(liveRetailCatalog(),(error: unknown)=>(error as {diagnostic:{stage:string}}).diagnostic.stage==="authentication");
      await assert.rejects(liveRetailCatalog());
      const rows=(await db.query(`SELECT note FROM "appAudit" WHERE action='provider_connection_failed' AND note LIKE '%authentication%'`)).rows;
      assert.equal(rows.length,1,"Repeated failures are deduplicated");
      assert.equal(rows[0].note.includes(process.env.SUVAKRIO_API_KEY!),false);
      assert.deepEqual(JSON.parse(rows[0].note),{code:"rejected",action:"balance",stage:"authentication",httpStatus:200});
    } finally {balanceFailure=null;await invalidate();}
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
  await t.test("checkout timing is saved before payment; approval dispatches native drip without another step",async()=>{
    const order=await createOrder({...await input("FB_03",100,"direct"),deliveryWindowMinutes:60},customer);const count=adds.length;
    await runFulfillment({orderId:order.id});assert.equal(adds.length,count);
    const payment=(await db.query('SELECT id FROM "appPayment" WHERE "orderId"=$1',[order.id])).rows[0];
    await reviewPayment({paymentId:payment.id,decision:"approve",confirmedReceived:true,note:"Verified amount and reference"},owner.id);
    assert.equal(await state(order.id),"queued");assert.equal((await jobs(order.id))[0].payload.runs,5);
    await runFulfillment({orderId:order.id});assert.equal(adds.length,count+1);
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
  await t.test("each available combo sends only its verified components, quantities and distinct links after one wallet debit", async () => {
    const expected = [
      {id:"COMBO_FB_MONETIZATION",ids:[1731,1741],quantities:[10000,1],targets:["Facebook:profile","Facebook:content"]},
      {id:"COMBO_CREATOR_STARTER",ids:[1731,1914,1756],quantities:[5000,2500,1000],targets:["Facebook:profile","Instagram:profile","Facebook:content"]},
      {id:"COMBO_VIRAL_PACK",ids:[1688,1695,1740],quantities:[50000,2000,25000],targets:["Instagram:content","Instagram:content","Facebook:content"]},
    ];
    for (const bundle of expected) {
      const raw=await input(bundle.id,1); const before=(await accountData(customer)).balancePaisa; const sent=adds.length;
      // Distinct fixtures expose accidentally reusing a page URL for a video.
      raw.links=raw.links.map(link=>({...link,url:link.url+"-"+encodeURIComponent(link.target??link.platform)}));
      const order=await createOrder(raw,customer);assert.equal(adds.length,sent);
      assert.equal((await createOrder(raw,customer)).id,order.id);
      const prepared=await jobs(order.id);
      assert.equal(prepared.length,bundle.ids.length);
      assert.equal(prepared.reduce((n,j)=>n+j.retailPaisa,0),order.amountPaisa);
      assert.ok(prepared.every(j=>j.retailPaisa>=j.payload.costPaisa));
      await Promise.all([runFulfillment({orderId:order.id}),runFulfillment({orderId:order.id})]);
      const calls=adds.slice(sent);
      assert.deepEqual(calls.map(f=>Number(f.get("service"))),bundle.ids);
      assert.deepEqual(calls.map(f=>Number(f.get("quantity"))),bundle.quantities);
      assert.deepEqual(calls.map(f=>f.get("link")),bundle.targets.map(target=>raw.links.find(l=>l.target===target)!.url));
      assert.ok(calls.every(f=>!f.has("runs")&&!f.has("interval")));
      assert.equal((await accountData(customer)).balancePaisa,before-order.amountPaisa);
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM "appLedger" WHERE "sourceId"=$1',[order.id])).rows[0].n,1);
      for(const job of await jobs(order.id))providerOrders.set(job.providerOrderId,{status:"Completed",remains:0,currency:"NPR"});
      await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[order.id]);
      await runFulfillment({orderId:order.id});assert.equal(await state(order.id),"completed");assert.equal(adds.length,sent+bundle.ids.length);
    }
    const before=(await accountData(customer)).balancePaisa;const count=(await accountData(customer)).orders.length;
    await assert.rejects(createOrder(await input("COMBO_YPP_COMPLETE",1),customer),/unavailable/);
    assert.equal((await accountData(customer)).balancePaisa,before);assert.equal((await accountData(customer)).orders.length,count);
  });
  await t.test("underfunded combos are unavailable before payment, while standalone availability is unchanged",async()=>{
    const before=(await accountData(customer)).balancePaisa;const count=(await accountData(customer)).orders.length;const sent=adds.length;
    const paymentCount=(await db.query('SELECT COUNT(*)::int AS n FROM "appPayment"')).rows[0].n;
    balance=235.4;
    try {
      const c=await liveRetailCatalog();assert.ok(c.packages.every(p=>p.automaticDeliveryAvailable===false));assert.equal(c.services.find(s=>s.id==="IG_06")!.automaticDeliveryAvailable,true);
      for(const itemId of ["COMBO_FB_MONETIZATION","COMBO_CREATOR_STARTER","COMBO_VIRAL_PACK"]){
        await assert.rejects(createOrder(await input(itemId,1),customer),/unavailable/);
        await assert.rejects(createOrder({...await input(itemId,1,"direct"),email:"guest-bundle@example.test"},null),/unavailable/);
      }
      assert.equal((await accountData(customer)).balancePaisa,before);assert.equal((await accountData(customer)).orders.length,count);assert.equal(adds.length,sent);
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM "appPayment"')).rows[0].n,paymentCount,"No underfunded direct-payment claims were created");
    } finally {balance=1000000;}
  });
  await t.test("a combo waits for enough provider balance for every component, then retries without another debit",async()=>{
    const order=await createOrder(await input("COMBO_CREATOR_STARTER",1),customer);const prepared=await jobs(order.id);const sent=adds.length;
    const paidBalance=(await accountData(customer)).balancePaisa;
    balance=(prepared[0].payload.costPaisa+100)/100;
    try {await runFulfillment({orderId:order.id});assert.equal(adds.length,sent);assert.equal(await state(order.id),"queued");assert.ok((await jobs(order.id)).every(j=>j.state==="ready"));}
    finally {balance=1000000;}
    await db.query('UPDATE "appFulfillment" SET "nextAttemptAt"=NOW() WHERE "orderId"=$1',[order.id]);
    await runFulfillment({orderId:order.id});assert.equal(adds.length,sent+3);
    assert.equal((await accountData(customer)).balancePaisa,paidBalance);
  });
  await t.test("a missing or unaffordable later component stops the whole untouched combo and refunds it once",async()=>{
    for(const failure of ["missing","price"]){
      const before=(await accountData(customer)).balancePaisa;const order=await createOrder(await input("COMBO_CREATOR_STARTER",1),customer);const sent=adds.length;const saved=catalog;
      try {
        catalog=failure==="missing"?catalog.filter(p=>p.service!==1756):catalog.map(p=>p.service===1914?{...p,rate:p.rate*10}:p);
        // Do not invalidate the quote cache: bundle dispatch must refresh it itself.
        await runFulfillment({orderId:order.id});
        assert.equal(adds.length,sent);assert.equal(await state(order.id),"delivery_failed");assert.ok((await jobs(order.id)).every(j=>j.state==="rejected"));
        assert.equal((await accountData(customer)).balancePaisa,before);
        await runFulfillment({orderId:order.id});assert.equal((await accountData(customer)).balancePaisa,before);
        assert.equal((await jobs(order.id)).reduce((n,j)=>n+j.refundedPaisa,0),order.amountPaisa);
      } finally {catalog=saved;await invalidate();}
    }
  });
  await t.test("a combo with one rejected component refunds only that component; completed components remain paid",async()=>{
    const before=(await accountData(customer)).balancePaisa;const order=await createOrder(await input("COMBO_CREATOR_STARTER",1),customer);const prepared=await jobs(order.id);const sent=adds.length;
    rejectService=1914;try {await runFulfillment({orderId:order.id});} finally {rejectService=null;}
    const mixed=await jobs(order.id);assert.deepEqual(mixed.map(j=>j.state),["submitted","rejected","submitted"]);
    assert.equal((await accountData(customer)).balancePaisa,before-order.amountPaisa+prepared[1].retailPaisa);
    for(const job of mixed.filter(j=>j.providerOrderId))providerOrders.set(job.providerOrderId,{status:"Completed",remains:0,currency:"NPR"});
    await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[order.id]);
    await runFulfillment({orderId:order.id});assert.equal(await state(order.id),"partial");await runFulfillment({orderId:order.id});
    assert.equal(adds.length,sent+3);assert.equal((await accountData(customer)).balancePaisa,before-order.amountPaisa+prepared[1].retailPaisa);
  });
  await t.test("a timeout on a combo's second component pauses the rest and never repeats accepted work",async()=>{
    const order=await createOrder(await input("COMBO_CREATOR_STARTER",1),customer);const sent=adds.length;const before=(await accountData(customer)).balancePaisa;
    timeoutService=1914;try {await runFulfillment({orderId:order.id});} finally {timeoutService=null;}
    const uncertain=await jobs(order.id);assert.deepEqual(uncertain.map(j=>j.state),["submitted","unknown","ready"]);
    assert.equal(await state(order.id),"needs_attention");assert.equal(adds.length,sent+2);
    await runFulfillment({orderId:order.id});assert.equal(adds.length,sent+2);assert.equal((await accountData(customer)).balancePaisa,before);
    await reconcileProviderOrder(order.id,uncertain[1].id,String(counter),owner.id);
    await runFulfillment({orderId:order.id});assert.equal(adds.length,sent+3);assert.equal((await jobs(order.id)).filter(j=>j.providerOrderId).length,3);
  });
  await t.test("a partial status with an empty or malformed remaining count cannot finalize or under-refund a combo component",async()=>{
    const order=await createOrder(await input("COMBO_VIRAL_PACK",1),customer);await runFulfillment({orderId:order.id});
    const prepared=await jobs(order.id);const before=(await accountData(customer)).balancePaisa;
    for(const remains of [null,"",false]){
      providerOrders.set(prepared[1].providerOrderId,{status:"Partial",remains,currency:"NPR"});
      await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[order.id]);
      await runFulfillment({orderId:order.id});
      assert.equal((await jobs(order.id))[1].state,"submitted");assert.equal((await accountData(customer)).balancePaisa,before);
    }
    providerOrders.set(prepared[1].providerOrderId,{status:"Partial",remains:"500",currency:"NPR"});
    await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[order.id]);await runFulfillment({orderId:order.id});
    assert.equal((await jobs(order.id))[1].refundedPaisa,Math.floor(prepared[1].retailPaisa*500/2000));
  });
  await t.test("partial delivery of one combo component refunds its undelivered fraction exactly once",async()=>{
    const order=await createOrder(await input("COMBO_VIRAL_PACK",1),customer);await runFulfillment({orderId:order.id});
    const prepared=await jobs(order.id);const before=(await accountData(customer)).balancePaisa;
    for(const [index,job] of prepared.entries())providerOrders.set(job.providerOrderId,{status:index===1?"Partial":"Completed",remains:index===1?500:0,currency:"NPR"});
    await db.query('UPDATE "appFulfillment" SET "lastCheckedAt"=NULL WHERE "orderId"=$1',[order.id]);
    await runFulfillment({orderId:order.id});assert.equal(await state(order.id),"partial");
    const refund=Math.floor(prepared[1].retailPaisa*500/2000);
    assert.equal((await accountData(customer)).balancePaisa,before+refund);await runFulfillment({orderId:order.id});
    assert.equal((await accountData(customer)).balancePaisa,before+refund);assert.equal((await jobs(order.id)).reduce((n,j)=>n+j.refundedPaisa,0),refund);
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
    const balance=(await accountData(customer)).balancePaisa;
    // Reproduce the production defect: an old lock remains on another backend.
    const legacy=await db.connect();
    try { await legacy.query("SELECT pg_advisory_lock(hashtextextended('dmnp-suvakrio',0))");await runFulfillment({orderId:id}); }
    finally {await legacy.query("SELECT pg_advisory_unlock(hashtextextended('dmnp-suvakrio',0))");legacy.release();}
    assert.equal(await state(id),"submitted");assert.equal((await accountData(customer)).balancePaisa,balance);assert.equal((await jobs(id))[0].retailPaisa,1290);
  });
  await t.test("pre-submission catalog failure remains paid, reports the problem, releases the lease and recovers",async()=>{
    const id=randomUUID();await db.query(`INSERT INTO "appOrder"(id,"userId",email,"itemId","itemKind","itemName",quantity,"amountPaisa",links,method,status,"requestScope","requestKey","createdAt","updatedAt") VALUES($1,$2,$3,'FB_02','service','Facebook followers',100,1290,$4,'wallet','queued',$5,$6,$7,$7)`,[id,customer.id,customer.email,JSON.stringify([{platform:"Facebook",url:"https://facebook.com/profile-test"}]),"user:"+customer.id,randomUUID(),new Date().toISOString()]);
    const before=(await accountData(customer)).balancePaisa;const count=adds.length;await invalidate();catalogUnavailable=true;
    await runFulfillment({orderId:id});catalogUnavailable=false;
    assert.equal(adds.length,count);assert.equal(await state(id),"queued");assert.equal((await jobs(id)).length,0);
    assert.match((await accountData(customer)).orders.find(o=>o.id===id)!.deliveryMessage!,/paid order is saved/);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "appFulfillmentWorker"')).rows[0].count,0);
    await runFulfillment({orderId:id});assert.equal(await state(id),"submitted");assert.equal(adds.length,count+1);
    assert.equal((await accountData(customer)).balancePaisa,before);assert.equal((await accountData(customer)).orders.find(o=>o.id===id)!.deliveryMessage,"");
  });
  await t.test("stale prices and unsupported drip stop safely before taking payment or dispatching",async()=>{
    const raw=await input("IG_06",1000);const before=(await accountData(customer)).balancePaisa;
    catalog=catalog.map(p=>p.service===1688?{...p,rate:p.rate*2}:p);await invalidate();await assert.rejects(createOrder(raw,customer),/price has updated/);assert.equal((await accountData(customer)).balancePaisa,before);
    catalog=catalog.map(p=>p.service===1768?{...p,dripfeed:false}:p);await invalidate();
    const balanceBefore=(await accountData(customer)).balancePaisa;
    await assert.rejects(createOrder({...await input("FB_03",100),deliveryWindowMinutes:60},customer),/Gradual delivery is not available/);
    assert.equal((await accountData(customer)).balancePaisa,balanceBefore,"Unsupported timing is rejected before charging");
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
