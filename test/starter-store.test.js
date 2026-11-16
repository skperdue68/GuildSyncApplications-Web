import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStarterStore} from '../src/starter-store.js';

test('shared starters persist CRUD, preserve identity and do not restore removed seeds',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gsa-starters-'));
 try{
  const options={managementPassword:'manager-secret'},store=createStarterStore(directory,options);
  let catalogue=await store.list();assert.equal(catalogue.templates.length,10);assert.equal(catalogue.managementEnabled,true);
  const seed=catalogue.templates[0];
  catalogue=await store.save({webTemplateId:seed.webTemplateId,kind:'message',title:'Updated starter',message:'Hello\r\n\r\n{name}',records:{secret:'not copied'}},'manager-secret',catalogue.revision);
  assert.equal(catalogue.templates[0].webTemplateId,seed.webTemplateId);assert.equal(catalogue.templates[0].message,'Hello\n\n{name}');
  catalogue=await store.save({kind:'email',title:'New mail',subject:'Welcome',body:'Dear {name}'},'manager-secret',catalogue.revision);
  const added=catalogue.templates.at(-1);assert.match(added.webTemplateId,/^gsa-shared:/);
  assert.equal((await createStarterStore(directory,options).list()).templates.at(-1).webTemplateId,added.webTemplateId);
  const previous=catalogue.revision;
  catalogue=await store.remove(seed.webTemplateId,'manager-secret',catalogue.revision);
  await assert.rejects(store.save({kind:'message',title:'Stale',message:'no'},'manager-secret',previous),error=>error.status===409);
  assert.equal((await store.list()).templates.some(t=>t.webTemplateId===seed.webTemplateId),false);
  const disk=await readFile(join(directory,'catalogue.json'),'utf8');assert.doesNotMatch(disk,/manager-secret|not copied|password/);
  for(const item of [...catalogue.templates])catalogue=await store.remove(item.webTemplateId,'manager-secret',catalogue.revision);
  assert.equal((await createStarterStore(directory,options).list()).templates.length,0);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('management auth, limits and revisions are enforced independently of the UI',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gsa-starter-auth-'));
 try{
  let now=1000;
  const store=createStarterStore(directory,{managementPassword:'manager-secret',now:()=>now});
  const initial=await store.list();
  await assert.rejects(store.save({kind:'message',title:'Unauthorized',message:'x'},'',initial.revision),error=>error.status===403);
  await assert.rejects(store.authorize('wrong'),error=>error.status===403);
  await store.authorize('manager-secret');
  await assert.rejects(store.save({kind:'email',title:'Too long',subject:'x'.repeat(38),body:'hello'},'manager-secret',initial.revision),error=>error.status===400);
  await assert.rejects(store.save({kind:'message',title:'',message:'hello'},'manager-secret',initial.revision),error=>error.status===400);
  await assert.rejects(store.save({kind:'message',title:'Invalid Unicode',message:'\ud800'},'manager-secret',initial.revision),error=>error.status===400);
  await assert.rejects(store.remove(initial.templates[0].webTemplateId,'wrong',initial.revision),error=>error.status===403);
  assert.equal((await store.list()).revision,initial.revision);
  for(let i=0;i<4;i++)await assert.rejects(store.authorize('wrong','attacker'),error=>error.status===403);
  await assert.rejects(store.authorize('wrong','attacker'),error=>error.status===403);
  await assert.rejects(store.authorize('manager-secret','attacker'),error=>error.status===429);
  await store.authorize('manager-secret','different-client');now+=15*60*1000+1;await store.authorize('manager-secret','attacker');
  const disabled=createStarterStore(directory);assert.equal((await disabled.list()).managementEnabled,false);
  await assert.rejects(disabled.authorize('anything'),error=>error.status===503);
  await writeFile(join(directory,'catalogue.json'),'not JSON','utf8');
  await assert.rejects(store.list());assert.equal(await readFile(join(directory,'catalogue.json'),'utf8'),'not JSON');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('concurrent catalogue writes reject stale revisions instead of dropping edits',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gsa-starter-race-'));
 try{
  const a=createStarterStore(directory,{managementPassword:'secret'}),b=createStarterStore(directory,{managementPassword:'secret'}),initial=await a.list();
  const results=await Promise.allSettled([a.save({kind:'message',title:'One',message:'One'},'secret',initial.revision),b.save({kind:'message',title:'Two',message:'Two'},'secret',initial.revision)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const rejected=results.find(result=>result.status==='rejected');assert.equal(rejected.reason.status,409);
  assert.equal((await a.list()).templates.length,11);
 }finally{await rm(directory,{recursive:true,force:true});}
});
