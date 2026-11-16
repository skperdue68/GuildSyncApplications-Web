import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from '../src/server.js';

test('starter API provides public browsing and protects every mutation with password, origin and revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-starter-api-'));
 const server=createServer({libraryDir:join(dir,'library'),startersDir:join(dir,'starters'),starterManagementPassword:'admin-secret'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const mutate=(path,body,method='POST',headers={Origin:origin})=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const initial=await fetch(origin+'/api/starters');assert.equal(initial.status,200);let catalogue=await initial.json();
  assert.equal(catalogue.templates.length,10);assert.equal(catalogue.managementEnabled,true);
  assert.doesNotMatch(JSON.stringify(catalogue),/admin-secret|passwordHash|passwordSalt/);
  assert.equal((await mutate('/api/starters/session',{password:'admin-secret'})).status,200);
  assert.equal((await mutate('/api/starters/session',{password:'wrong'})).status,403);
  const payload={revision:catalogue.revision,template:{kind:'message',title:'Published',message:'Hello {name}'}};
  assert.equal((await mutate('/api/starters',payload)).status,403);
  assert.equal((await mutate('/api/starters',{...payload,password:'admin-secret'},'POST',{Origin:'https://elsewhere.example'})).status,403);
  assert.equal((await mutate('/api/starters',{...payload,password:'admin-secret'},'POST',{})).status,403);
  const added=await mutate('/api/starters',{...payload,password:'admin-secret'});assert.equal(added.status,200);catalogue=await added.json();
  const item=catalogue.templates.at(-1);assert.equal(item.message,'Hello {name}');
  assert.equal((await mutate('/api/starters',{...payload,password:'admin-secret'})).status,409);
  assert.equal((await mutate('/api/starters/'+encodeURIComponent(item.webTemplateId),{revision:catalogue.revision},'DELETE')).status,403);
  const removed=await mutate('/api/starters/'+encodeURIComponent(item.webTemplateId),{revision:catalogue.revision,password:'admin-secret'},'DELETE');
  assert.equal(removed.status,200);assert.equal((await removed.json()).templates.length,10);
  assert.equal((await fetch(origin+'/api/starters/session')).status,405);
  assert.equal((await fetch(origin+'/starters.js')).status,200);
  assert.equal((await mutate('/api/starters',{password:'admin-secret',padding:'x'.repeat(17000)})).status,413);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
