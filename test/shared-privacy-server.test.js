import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLibraryStore} from '../src/library-store.js';
import {parseSavedVariables} from '../src/lua-data.js';

test('server strips records even for old clients and serves legacy records as empty without mutating disk',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-private-'));
 try{
  const store=createLibraryStore(dir);
  const lua='GuildSyncApplications={Default={["@Officer"]={["$AccountWide"]={records={[1]={applicant="@PrivateRecruit",application="private application text"}},settings={captureApplicationData=false,welcomeMessages={},welcomeEmails={}}}}}}';
  const file=await store.save('Safe shared copy',lua,false,'password');
  const path=join(dir,file.id+'.gsa'),disk=await readFile(path,'utf8');
  assert.doesNotMatch(disk,/@PrivateRecruit|private application text/);
  const shared=(await store.load(file.id)).toString();
  assert.equal(Object.keys(parseSavedVariables(shared).Default['@Officer'].$AccountWide.records).length,0);
  assert.equal(parseSavedVariables(shared).Default['@Officer'].$AccountWide.settings.captureApplicationData,false);
  assert.equal(file.bytes,Buffer.byteLength(shared,'utf8'));
  // Simulate an existing legacy record. Reading is sanitized without rewriting the file.
  const legacy=disk.slice(0,disk.indexOf('\n')+1)+lua;
  await writeFile(path,legacy,'utf8');
  assert.doesNotMatch((await store.load(file.id)).toString(),/@PrivateRecruit|private application text/);
  assert.equal(await readFile(path,'utf8'),legacy);
  await assert.rejects(store.save('Safe shared copy',lua,true,'wrong'),error=>error.status===403);
  await store.save('Safe shared copy',lua,true,'password');
  assert.doesNotMatch(await readFile(path,'utf8'),/@PrivateRecruit|private application text/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
