import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLibraryStore} from '../src/library-store.js';
import {newDocument,profiles,addEntry,exportDocument} from '../src/model.js';

function lua(text){const doc=newDocument('@Synthetic');addEntry(profiles(doc)[0],'message',{message:text});return exportDocument(doc);}
test('explicit overwrite replaces the same normalized name atomically and retains its identity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-overwrite-'));
 try{
  const store=createLibraryStore(dir),original=lua('Original'),updated=lua('Updated');
  const first=await store.save('Café',original);
  await assert.rejects(store.save(' CAFÉ ',updated),error=>error.status===409);
  assert.equal((await store.load(first.id)).toString(),original);
  const saved=await store.save(' CAFE\u0301 ',updated,true);
  assert.equal(saved.id,first.id);assert.equal(saved.createdAt,first.createdAt);assert.equal(typeof saved.updatedAt,'string');
  assert.equal((await createLibraryStore(dir).load(first.id)).toString(),updated);
  assert.equal((await store.list()).length,1);assert.equal((await readdir(dir)).length,1);
  await assert.rejects(store.save('café','GuildSyncApplications = invalid()',true),error=>error.status===400);
  await assert.rejects(store.save('café',original,'true'),error=>error.status===400);
  assert.equal((await store.load(first.id)).toString(),updated);
 }finally{await rm(dir,{recursive:true,force:true});}
});
