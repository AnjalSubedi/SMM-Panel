const assert=require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
(async()=>{
 const base='http://localhost:3002';
 for(const path of ['/login','/services','/api/account']){
  const response=await fetch(base+path);const csp=response.headers.get('content-security-policy');
  assert.match(csp,/frame-ancestors 'none'/); assert.match(csp,/object-src 'none'/);assert.ok(!csp.includes('unsafe-eval'));assert.ok(!csp.includes('script-src https:'));
  assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');assert.equal(response.headers.get('x-powered-by'),null);
 }
 const target=await(await fetch('http://localhost:9223/json/new?'+base+'/services',{method:'PUT'})).json();
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;let rejectLogout=false;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Fetch.requestPaused'){void call(rejectLogout?'Fetch.fulfillRequest':'Fetch.continueRequest',rejectLogout?{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Simulated network failure'})).toString('base64')}:{requestId:m.params.requestId});return;}if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}});
 const call=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,allowUnsafeEvalBlockedByCSP:false})).result.value;
 try{
  await call('Runtime.enable');
  for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('#service-platform')"))break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(await evaluate("!!document.querySelector('#service-platform')"));
  assert.equal(await evaluate("(()=>{try{new Function('return 1')();return false;}catch(e){return e.name==='EvalError';}})()"),true,'Browser blocks dynamic script evaluation in production');
  assert.equal(await evaluate("new Promise(resolve=>{const frame=document.createElement('iframe');frame.src='/login';frame.onload=()=>resolve(frame.contentDocument===null);document.body.append(frame);setTimeout(()=>resolve(frame.contentDocument===null),2500);})"),true,'Browser refuses to embed the login page');
  const databaseURL=new URL(process.env.QA_DATABASE_URL || '');
  assert.equal(databaseURL.hostname,'127.0.0.1'); assert.equal(databaseURL.username,'dmnp_test');
  const db=new Pool({connectionString:databaseURL.toString(),max:1});
  const userId='logout-'+randomUUID(); const email=userId+'@example.test'; const password='Isolated-Logout-Password-2026!';
  const {hashPassword}=await import('better-auth/crypto');
  try {
    const now=new Date();
    await db.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,$4,$4)',[userId,'Logout Customer',email,now]);
    await db.query('INSERT INTO "account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,$3,$2,$4,$5,$5)',[randomUUID(),userId,'credential',await hashPassword(password),now]);
    const signedIn=await evaluate('fetch("/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify('+JSON.stringify({email,password})+')}).then(r=>r.status)');
    assert.equal(signedIn,200,'Production sign-in POST succeeds');
    await call('Page.navigate',{url:base+'/account'});
    const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate('Boolean(document.body) && ('+expression+')'))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Not ready: '+expression);};
    const mouseClick=async selector=>{
      const point=await evaluate('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');el.scrollIntoView({block:"nearest",behavior:"instant"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
      await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    };
    await waitFor('!!document.querySelector("button[aria-haspopup=menu]")');
    await mouseClick('button[aria-haspopup=menu]');
    await waitFor('!!document.querySelector("[role=menu]")');
    assert.equal(await evaluate('(()=>{const b=document.querySelector("[role=menu] button[role=menuitem]").getBoundingClientRect();const m=document.querySelector("[role=menu]").getBoundingClientRect();return b.top>=m.top && b.bottom<=m.bottom && b.bottom<=innerHeight;})()'),true,'Sign-out remains visible without scrolling the menu');
    rejectLogout=true;await call('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/sign-out',requestStage:'Request'}]});
    await mouseClick('[role=menu] button[role=menuitem]');
    await waitFor('document.querySelector("[role=alert]")?.textContent.includes("Unable to sign out")');
    assert.equal(await evaluate('(()=>{const e=document.querySelector("[role=alert]").getBoundingClientRect();const m=document.querySelector("[role=menu]").getBoundingClientRect();return e.top>=m.top && e.bottom<=m.bottom && e.bottom<=innerHeight;})()'),true,'Failure message remains inside the visible menu');
    assert.equal(await evaluate('document.querySelector("[role=menu] button[role=menuitem]").disabled'),false,'Failed sign-out can be retried');
    assert.equal(await evaluate('fetch("/api/account").then(r=>r.status)'),200,'A failed response does not claim the user is signed out');
    rejectLogout=false;await call('Fetch.disable');
    await mouseClick('[role=menu] button[role=menuitem]');
    await waitFor('location.pathname==="/login" && !!document.querySelector("#auth-email") && document.querySelector("header")?.textContent.includes("Sign in")');
    assert.equal(await evaluate('fetch("/api/account").then(r=>r.status)'),401,'Account access ends after sign-out');
    assert.equal(await evaluate('fetch("/api/auth/get-session").then(r=>r.json())'),null,'Session cookie is cleared');
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM session WHERE "userId"=$1',[userId])).rows[0].count,'0','Server session is revoked');
    const stale=await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:'dmnp.session_token=obsolete.invalid'},body:'{}'});
    assert.equal(stale.status,200,'Expired cookies do not prevent signing out');
    const foreign=await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json',Cookie:'dmnp.session_token=obsolete.invalid'},body:'{}'});
    assert.equal(foreign.status,403,'Logout still enforces origin protection');
    console.log('Production sign-out passed: real mouse click, failure/retry, cleared cookie, revoked server session, stale-cookie handling and CSRF protection.');
  } finally { await db.end(); }
  console.log('Production browser policy enforced: no eval, no framing, security headers present, public catalog hydrated.');
 }finally{socket.close();await fetch('http://localhost:9223/json/close/'+target.id);}
})().catch(error=>{console.error(error);process.exitCode=1});
