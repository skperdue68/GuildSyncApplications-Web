import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLibraryStore} from '../src/library-store.js';
import {newDocument,exportDocument} from '../src/model.js';

test('optional password protects overwrite without hiding shared files or leaking credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-password-'));
 try{
  const store=createLibraryStore(dir),first=exportDocument(newDocument('@Original')),updated=exportDocument(newDocument('@Updated'));
  const saved=await store.save('Protected',first,false,'test password');
  assert.equal(saved.passwordProtected,true);
  assert.equal((await store.load(saved.id)).toString(),first);
  for(const password of ['', 'wrong'])await assert.rejects(store.save('PROTECTED',updated,true,password),error=>error.status===403);
  assert.equal((await store.load(saved.id)).toString(),first);
  const replaced=await store.save('protected',updated,true,'test password');
  assert.equal(replaced.passwordProtected,true);assert.equal(replaced.createdAt,saved.createdAt);
  const restarted=createLibraryStore(dir);
  await assert.rejects(restarted.save('protected',first,true),error=>error.status===403);
  assert.equal((await restarted.load(saved.id)).toString(),updated);
  const listed=JSON.stringify(await store.list());
  assert.doesNotMatch(listed,/passwordHash|passwordSalt|test password/);
  assert.doesNotMatch(JSON.stringify(saved),/passwordHash|passwordSalt|test password/);
  const disk=await readFile(join(dir,saved.id+'.gsa'),'utf8');
  assert.doesNotMatch(disk,/test password/);assert.match(disk,/passwordHash/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('an unprotected save can acquire a password and concurrent writes cannot bypass protection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-password-race-'));
 try{
  const a=createLibraryStore(dir),b=createLibraryStore(dir),lua=exportDocument(newDocument('@Example'));
  const file=await a.save('Example',lua);
  const results=await Promise.allSettled([a.save('example',lua,true,'secret'),b.save('EXAMPLE',lua,true)]);
  assert.equal(results[0].status,'fulfilled',results[0].reason?.stack);assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.status,403);
  assert.equal((await a.list())[0].passwordProtected,true);
  await assert.rejects(a.save('example',lua,true,null),error=>error.status===400);
  await assert.rejects(a.save('example',lua,true,'x'.repeat(1025)),error=>error.status===400);
  assert.equal((await a.load(file.id)).toString(),lua);
 }finally{await rm(dir,{recursive:true,force:true});}
});
