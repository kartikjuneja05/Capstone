import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {openStore} from '../server/store.js';
import {createApp,validPractice} from '../server/app.js';
import {validateProfile} from '../shared/calibration-schema.js';
import {randomUUID} from 'node:crypto';
test('profile and summary validation reject invalid input',()=>{
 assert.equal(validateProfile({version:3,measurements:{}}),true);
 assert.equal(validateProfile({version:3,measurements:{'unknown:left':{values:{knee:90},measuredAt:new Date().toISOString()}}}),false);
 assert.equal(validateProfile({version:3,measurements:{'squat:left':{values:{knee:200},measuredAt:new Date().toISOString()}}}),false);
 assert.equal(validPractice({routineId:'fake'}),false);
 const sample={id:randomUUID(),routineId:'concentration',holdSeconds:15,completed:false,poses:[{poseId:'tadasana',side:'both',status:'completed',trackedSeconds:20,inRangeSeconds:15}]};assert.equal(validPractice(sample),false);
 sample.poses[0].poseId='vrikshasana';assert.equal(validPractice(sample),false);sample.poses[0].side='left';assert.equal(validPractice(sample),true);
});
test('accounts, authentication, per-user ownership and persisted records',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yogkinetix-test-'));const path=join(dir,'test.sqlite');let store=openStore(path);
 try{
  const alice=await store.signup('alice@example.test','Alice','sample-password-123');
  const bob=await store.signup('bob@example.test','Bob','sample-password-456');
  assert.equal((await store.login('alice@example.test','sample-password-123')).id,alice.id);
  assert.equal(await store.login('alice@example.test','incorrect-password'),null);
  await assert.rejects(()=>store.signup('alice@example.test','Other','sample-password-789'),/already exists/);
  const token=store.createSession(alice.id);assert.equal(store.user(token).id,alice.id);store.logout(token);assert.equal(store.user(token),null);
  const p={version:3,measurements:{'squat:left':{values:{hip:90,knee:40},measuredAt:new Date().toISOString()}}};store.saveProfile(alice.id,p);assert.deepEqual(store.profile(bob.id).measurements,{});
  const entry={id:randomUUID(),routineId:'concentration',holdSeconds:15,completed:false,poses:[{poseId:'vajrasana',side:'both',status:'completed',trackedSeconds:20,inRangeSeconds:15}]};store.savePractice(alice.id,entry);store.savePractice(alice.id,entry);assert.equal(store.history(alice.id).length,1);assert.equal(store.history(bob.id).length,0);assert.throws(()=>store.savePractice(bob.id,entry),/Invalid session/);
  store.close();store=openStore(path);assert.deepEqual(store.profile(alice.id),p);assert.equal(store.history(alice.id)[0].id,entry.id);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP API validates origin, passwords and cookies, and prevents anonymous writes',async()=>{
 const store=openStore(':memory:');const server=createServer(createApp(store));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const url=`http://127.0.0.1:${server.address().port}`;
 const request=(path,method='GET',data,cookie,origin='http://localhost:5173')=>fetch(url+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 try{
  assert.equal((await request('/api/profile')).status,401);
  assert.equal((await request('/api/auth/signup','POST',{email:'x@example.test',name:'X',password:'short'})).status,400);
  assert.equal((await request('/api/auth/signup','POST',{email:'x@example.test',name:'X',password:'sample-password-123'},null,'https://evil.test')).status,403);
  const created=await request('/api/auth/signup','POST',{email:'x@example.test',name:'X',password:'sample-password-123'});assert.equal(created.status,200);
  const setCookie=created.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);const cookie=setCookie.split(';')[0];
  assert.ok((await (await request('/api/auth/me','GET',undefined,cookie)).json()).user);
  assert.equal((await request('/api/profile','PUT',{version:3,measurements:{}},cookie)).status,200);
  assert.equal((await request('/api/profile','PUT',{version:3,measurements:{}},cookie,'https://evil.test')).status,403);
  assert.equal((await request('/api/sessions','POST',{id:'bad'},cookie)).status,400);
  assert.equal((await request('/api/auth/logout','POST',{},cookie)).status,200);
  assert.equal((await request('/api/profile','GET',undefined,cookie)).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
