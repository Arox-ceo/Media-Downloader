import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
test('assets, CORS, session isolation and private file endpoints',async()=>{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const dir=await mkdtemp(path.join(os.tmpdir(),'mediahub-test-'));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',FRONTEND_ORIGIN:'https://example.github.io',DOWNLOAD_DIR:dir},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),40000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error(`Early exit ${code}`));});});const base=`http://127.0.0.1:${port}`;
  for(const url of ['/','/config.js','/tiktok.js','/youtube.js','/style.css'])assert.equal((await fetch(base+url)).status,200);
  const a=await(await fetch(base+'/api/status')).json(),b=await(await fetch(base+'/api/status')).json();assert.notEqual(a.sessionId,b.sessionId);assert.notEqual(a.token,b.token);
  const same=await(await fetch(base+'/api/status',{headers:{'X-Media-Session':a.sessionId}})).json();assert.equal(same.token,a.token);
  const denied=await fetch(base+'/api/download',{method:'POST',headers:{'X-Media-Session':a.sessionId,'X-Clipnest-Token':b.token,'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
  const preflight=await fetch(base+'/api/status',{method:'OPTIONS',headers:{Origin:'https://example.github.io','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-media-session'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://example.github.io');
  assert.equal((await fetch(base+'/api/status',{headers:{Origin:'https://other.example'}})).status,403);
  assert.equal((await fetch(base+'/api/file/nonexistent',{headers:{'X-Media-Session':a.sessionId}})).status,404);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
 }finally{child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});await rm(dir,{recursive:true,force:true});}
});
