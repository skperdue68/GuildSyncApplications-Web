import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLibraryStore,PASSWORD_WINDOW_MS,MAX_FAILED_PASSWORDS} from '../src/library-store.js';
import {validateLua} from '../src/validate-lua.js';
import {createServer,readConfig} from '../src/server.js';
import {newDocument,exportDocument} from '../src/model.js';
import {parseSavedVariables,writeSavedVariables} from '../src/lua-data.js';

const lua=account=>exportDocument(newDocument(account));
async function withDir(run){const dir=await mkdtemp(join(tmpdir(),'gsa-hardening-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}

test('library refuses new files beyond the file cap but still allows replacing existing ones',()=>withDir(async dir=>{
 const store=createLibraryStore(dir,{maxFiles:2});
 await store.save('One',lua('@One'));await store.save('Two',lua('@Two'));
 await assert.rejects(store.save('Three',lua('@Three')),error=>error.status===507);
 await store.save('one',lua('@Uno'),true);
 await assert.rejects(store.save('Two',lua('@Two')),error=>error.status===409);
 assert.equal((await store.list()).length,2);
}));

test('library refuses uploads that would exceed the total size cap',()=>withDir(async dir=>{
 const size=Buffer.byteLength(lua('@One')),store=createLibraryStore(dir,{maxBytes:size*2+50});
 await store.save('One',lua('@One'));await store.save('Two',lua('@Two'));
 await assert.rejects(store.save('Three',lua('@Six')),error=>error.status===507);
 await store.save('One',lua('@Uno'),true);
 assert.equal((await store.list()).length,2);
}));

test('a damaged record is skipped instead of breaking the whole list',()=>withDir(async dir=>{
 const skipped=[],store=createLibraryStore(dir,{onSkip:entry=>skipped.push(entry)});
 await store.save('Good',lua('@Good'));
 const damaged='a'.repeat(64)+'.gsa';await writeFile(join(dir,damaged),'not a library record');
 const files=await store.list();
 assert.deepEqual(files.map(file=>file.name),['Good']);assert.deepEqual(skipped,[damaged]);
}));

test('repeated wrong overwrite passwords lock overwrites for a while, then recover',()=>withDir(async dir=>{
 let time=1_000_000;const store=createLibraryStore(dir,{now:()=>time});
 await store.save('Locked',lua('@A'),false,'right');
 for(let i=0;i<MAX_FAILED_PASSWORDS;i++)await assert.rejects(store.save('Locked',lua('@B'),true,'wrong'+i),error=>error.status===403);
 await assert.rejects(store.save('Locked',lua('@B'),true,'right'),error=>error.status===429);
 time+=PASSWORD_WINDOW_MS+1;
 await store.save('Locked',lua('@B'),true,'right');
 for(let i=0;i<MAX_FAILED_PASSWORDS-1;i++)await assert.rejects(store.save('Locked',lua('@C'),true,'wrong'+i),error=>error.status===403);
 await store.save('Locked',lua('@C'),true,'right');
}));

test('a missing password is refused without counting toward the lockout',()=>withDir(async dir=>{
 const store=createLibraryStore(dir);
 await store.save('Open',lua('@A'),false,'right');
 for(let i=0;i<MAX_FAILED_PASSWORDS*2;i++)await assert.rejects(store.save('Open',lua('@B'),true,''),error=>error.status===403);
 await store.save('Open',lua('@B'),true,'right');
}));

test('SavedVariables checking reports invalid data, a busy server and timeouts',async()=>{
 await validateLua(lua('@Ok'));
 await assert.rejects(validateLua('GuildSyncApplications = nonsense'),error=>error.kind==='invalid');
 await assert.rejects(validateLua(lua('@Ok'),{maxConcurrent:0}),error=>error.kind==='busy');
 await assert.rejects(validateLua(lua('@Ok'),{timeoutMs:1}),error=>error.kind==='timeout');
 await validateLua(lua('@Ok'));
});

test('validating a large upload does not block the event loop',async()=>{
 const doc=parseSavedVariables(lua('@Big')),junk=Object.create(null);
 for(let i=1;i<=12000;i++)junk[i]={id:i,name:'Applicant '+i,note:'x'.repeat(40),when:1700000000+i,ok:true};
 doc.benchJunk=junk;
 const big=writeSavedVariables(doc);
 let last=performance.now(),worst=0;
 const timer=setInterval(()=>{const now=performance.now();worst=Math.max(worst,now-last);last=now;},20);
 try{await validateLua(big);}finally{clearInterval(timer);}
 assert.ok(worst<400,`The event loop stalled for ${Math.round(worst)} ms while checking an upload.`);
});

test('static pages send a strict CSP without inline styles',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
  const policy=response.headers.get('content-security-policy');
  assert.match(policy,/form-action 'self'/);assert.doesNotMatch(policy,/unsafe-inline/);
  assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
  assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('library limits are configurable and validated',()=>{
 assert.equal(readConfig({}).libraryMaxFiles,500);
 assert.equal(readConfig({LIBRARY_MAX_FILES:'10'}).libraryMaxFiles,10);
 for(const bad of ['0','-1','1.5','abc'])assert.throws(()=>readConfig({LIBRARY_MAX_FILES:bad}),/LIBRARY_MAX_FILES/);
 assert.throws(()=>readConfig({LIBRARY_MAX_BYTES:'0'}),/LIBRARY_MAX_BYTES/);
});

test('loading a large saved file does not block the event loop, for new and legacy records',()=>withDir(async dir=>{
 const doc=parseSavedVariables(lua('@Big')),junk=Object.create(null);
 for(let i=1;i<=12000;i++)junk[i]={id:i,name:'Applicant '+i,note:'x'.repeat(40),when:1700000000+i,ok:true};
 doc.benchJunk=junk;
 const store=createLibraryStore(dir),saved=await store.save('Big',writeSavedVariables(doc));
 async function worstStall(){
  let last=performance.now(),worst=0;
  const timer=setInterval(()=>{const now=performance.now();worst=Math.max(worst,now-last);last=now;},20);
  try{await store.load(saved.id);}finally{clearInterval(timer);}
  return worst;
 }
 assert.ok(await worstStall()<400,'Loading a record this server saved stalled the event loop.');
 // A legacy record has no body hash, so it is cleaned on the fly, off the main thread.
 const path=join(dir,saved.id+'.gsa'),disk=await readFile(path,'utf8'),newline=disk.indexOf('\n'),header=JSON.parse(disk.slice(0,newline));
 delete header.bodySha256;await writeFile(path,JSON.stringify(header)+disk.slice(newline),'utf8');
 assert.ok(await worstStall()<400,'Loading a legacy record stalled the event loop.');
}));
