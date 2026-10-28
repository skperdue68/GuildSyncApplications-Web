import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {createServer} from '../src/server.js';

test('standalone ZIP downloads with addon folder, manifest, code and dependency instructions',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/downloads/GuildSyncApplications.zip`);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/zip');
  assert.equal(response.headers.get('content-disposition'),'attachment; filename="GuildSyncApplications.zip"');
  const zip=Buffer.from(await response.arrayBuffer()),files=new Map();let offset=0;
  while(zip.readUInt32LE(offset)===0x04034b50){
   const method=zip.readUInt16LE(offset+8),size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extraLength=zip.readUInt16LE(offset+28);
   const name=zip.subarray(offset+30,offset+30+nameLength).toString('utf8');
   const start=offset+30+nameLength+extraLength,compressed=zip.subarray(start,start+size);
   files.set(name,(method===8?inflateRawSync(compressed):compressed).toString('utf8'));offset=start+size;
  }
  assert.deepEqual([...files.keys()].sort(),['GuildSyncApplications/GuildSyncApplications.lua','GuildSyncApplications/GuildSyncApplications.txt','GuildSyncApplications/README.txt']);
  assert.match(files.get('GuildSyncApplications/GuildSyncApplications.lua'),/GSA.version = "1.4.3"/);
  assert.match(files.get('GuildSyncApplications/GuildSyncApplications.txt'),/## DependsOn: LibAddonMenu-2.0/);
  assert.match(files.get('GuildSyncApplications/README.txt'),/SavedVariables/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
