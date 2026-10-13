const assert=require('node:assert/strict');
(async()=>{
 const base='http://localhost:3002';
 for(const path of ['/login','/services','/api/account']){
  const response=await fetch(base+path);const csp=response.headers.get('content-security-policy');
  assert.match(csp,/frame-ancestors 'none'/); assert.match(csp,/object-src 'none'/);assert.ok(!csp.includes('unsafe-eval'));assert.ok(!csp.includes('script-src https:'));
  assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');assert.equal(response.headers.get('x-powered-by'),null);
 }
 const target=await(await fetch('http://localhost:9223/json/new?'+base+'/services',{method:'PUT'})).json();
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}});
 const call=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,allowUnsafeEvalBlockedByCSP:false})).result.value;
 try{
  await call('Runtime.enable');
  for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('#service-platform')"))break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(await evaluate("!!document.querySelector('#service-platform')"));
  assert.equal(await evaluate("(()=>{try{new Function('return 1')();return false;}catch(e){return e.name==='EvalError';}})()"),true,'Browser blocks dynamic script evaluation in production');
  assert.equal(await evaluate("new Promise(resolve=>{const frame=document.createElement('iframe');frame.src='/login';frame.onload=()=>resolve(frame.contentDocument===null);document.body.append(frame);setTimeout(()=>resolve(frame.contentDocument===null),2500);})"),true,'Browser refuses to embed the login page');
  console.log('Production browser policy enforced: no eval, no framing, security headers present, public catalog hydrated.');
 }finally{socket.close();await fetch('http://localhost:9223/json/close/'+target.id);}
})().catch(error=>{console.error(error);process.exitCode=1});
