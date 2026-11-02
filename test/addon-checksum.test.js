import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const downloads=resolve(dirname(fileURLToPath(import.meta.url)),'../public/downloads');

test('add-on ZIP matches the published SHA-256 checksum',async()=>{
 const sums=(await readFile(resolve(downloads,'SHA256SUMS'),'utf8')).trim().split('\n');
 assert.equal(sums.length,1,'SHA256SUMS should list exactly the add-on ZIP.');
 const match=/^([a-f0-9]{64})  (GuildSyncApplications\.zip)$/.exec(sums[0]);
 assert.ok(match,'SHA256SUMS must use the "<sha256>  <file>" format.');
 const actual=createHash('sha256').update(await readFile(resolve(downloads,match[2]))).digest('hex');
 assert.equal(actual,match[1],'The ZIP changed without SHA256SUMS being updated. Rebuild with scripts/package-addon.py.');
});
