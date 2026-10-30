import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/server.js';
import {newDocument,addEntry,profiles,exportDocument} from '../src/model.js';

test('shared library requires explicit overwrite and enforces matching origin',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gsa-web-'));
 const server=createServer({libraryDir:dir}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try {
  const doc=newDocument('@Synthetic'); addEntry(profiles(doc)[0],'message',{message:'Welcome {name}',enabled:true});
  const lua=exportDocument(doc);
  const post=(name,text=lua,requestOrigin=origin,overwrite=false)=>fetch(origin+'/api/library',{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin},body:JSON.stringify({name,lua:text,overwrite})});
  assert.equal((await post('Example',lua,'https://wrong.example')).status,403);
  assert.equal((await post('Bad','GuildSyncApplications = os.execute("no")')).status,400);
  const saved=await post('Example'); assert.equal(saved.status,201); const {file}=await saved.json();
  assert.equal((await post('example')).status,409);
  const list=await (await fetch(origin+'/api/library')).json(); assert.equal(list.files.length,1);
  assert.equal(await (await fetch(origin+'/api/library/'+file.id)).text(),lua);
  const updated=lua.replace('Welcome {name}','Updated welcome');
  assert.equal((await post('EXAMPLE',updated,origin,true)).status,201);
  assert.equal(await (await fetch(origin+'/api/library/'+file.id)).text(),updated);
  assert.equal((await post('Example',lua,'https://wrong.example',true)).status,403);
  assert.equal((await post('Example','GuildSyncApplications = invalid()',origin,true)).status,400);
  assert.equal((await post('Example',lua,origin,'true')).status,400);
  assert.equal(await (await fetch(origin+'/api/library/'+file.id)).text(),updated);
  assert.equal((await fetch(origin+'/api/library/../../etc/passwd')).status,404);
  assert.equal((await fetch(origin+'/model.js')).status,200);
  assert.equal((await fetch(origin+'/')).status,200);
 } finally {await new Promise(r=>server.close(r)); await rm(dir,{recursive:true,force:true});}
});
