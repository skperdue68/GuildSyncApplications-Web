import { mkdir, open, readdir, readFile, link, unlink, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { parseSavedVariables } from './lua-data.js';
import { exportDocument } from './model.js';

export const MAX_LUA_BYTES = 20 * 1024 * 1024;
export class LibraryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const validId = id => /^[a-f0-9]{64}$/.test(id);
const deriveKey=promisify(scrypt);
const pendingWrites=new Map();
async function serializedWrite(key,write){
  const previous=pendingWrites.get(key)||Promise.resolve();
  const current=previous.catch(()=>{}).then(write);pendingWrites.set(key,current);
  try{return await current;}finally{if(pendingWrites.get(key)===current)pendingWrites.delete(key);}
}
function publicMetadata(record){
  const {id,name,createdAt,updatedAt,bytes}=record;
  return {id,name,createdAt,...(updatedAt?{updatedAt}:{}),bytes,passwordProtected:!!record.passwordHash};
}
export function createLibraryStore(directory) {
  const location = resolve(directory);
  const filename = id => resolve(location, `${id}.gsa`);
  async function metadata(path) {
    const handle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const newline = buffer.subarray(0, bytesRead).indexOf(10);
      if (newline < 0) throw Error('Invalid library record');
      const value = JSON.parse(buffer.subarray(0, newline).toString('utf8'));
      if (!validId(value.id) || typeof value.name !== 'string' || typeof value.createdAt !== 'string' || !Number.isInteger(value.bytes)) throw Error('Invalid library record');
      if((value.passwordHash!==undefined||value.passwordSalt!==undefined)&&(!/^[a-f0-9]{64}$/.test(value.passwordHash||'')||!/^[a-f0-9]{32}$/.test(value.passwordSalt||'')))throw Error('Invalid password metadata');
      return value;
    } finally { await handle.close(); }
  }
  return {
    async list() {
      let entries;
      try { entries = await readdir(location); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      const files = [];
      for (const entry of entries) {
        if (!/^[a-f0-9]{64}\.gsa$/.test(entry)) continue;
        files.push(publicMetadata(await metadata(resolve(location, entry))));
      }
      return files.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt) || a.id.localeCompare(b.id));
    },
    async save(name, lua, overwrite = false, password = '') {
      if(typeof overwrite !== 'boolean')throw new LibraryError(400, 'Overwrite must be true or false.');
      if(typeof password!=='string'||Buffer.byteLength(password,'utf8')>1024)throw new LibraryError(400, 'Password must be text of at most 1024 UTF-8 bytes.');
      if (typeof name !== 'string') throw new LibraryError(400, 'Provide a friendly name.');
      name = name.trim().normalize('NFC');
      if (!name || [...name].length > 120 || /\p{Cc}/u.test(name)) throw new LibraryError(400, 'Use a name of 1–120 characters without control characters.');
      if (typeof lua !== 'string') throw new LibraryError(400, 'Provide SavedVariables Lua text.');
      const bytes = Buffer.byteLength(lua, 'utf8');
      if (bytes > MAX_LUA_BYTES) throw new LibraryError(413, 'SavedVariables must be at most 20 MiB.');
      try { exportDocument(parseSavedVariables(lua)); }
      catch(error) { throw new LibraryError(400, 'Provide valid GuildSyncApplications SavedVariables: ' + error.message); }
      const id = createHash('sha256').update(name.toLowerCase().normalize('NFC')).digest('hex');
      return serializedWrite(filename(id),async()=>{
      const now=new Date().toISOString();
      let original;
      if(overwrite){
        try{original=await metadata(filename(id));}
        catch(error){if(error.code!=='ENOENT')throw error;}
      }
      const file = { id, name, createdAt: original?.createdAt || now, updatedAt: now, bytes };
      if(original?.passwordHash){
        const supplied=await deriveKey(password,original.passwordSalt,32);
        if(!password||!timingSafeEqual(supplied,Buffer.from(original.passwordHash,'hex')))throw new LibraryError(403,'The overwrite password is missing or incorrect. The saved file has not changed.');
        file.passwordHash=original.passwordHash;file.passwordSalt=original.passwordSalt;
      }else if(password){
        file.passwordSalt=randomBytes(16).toString('hex');
        file.passwordHash=(await deriveKey(password,file.passwordSalt,32)).toString('hex');
      }
      await mkdir(location, { recursive: true });
      const temporary = resolve(location, `${randomUUID()}.tmp`);
      let handle;
      try {
        handle = await open(temporary, 'wx');
        await handle.writeFile(JSON.stringify(file) + '\n' + lua, 'utf8');
        await handle.sync();
        await handle.close(); handle = null;
        if(overwrite)await rename(temporary,filename(id));
        else {
          try { await link(temporary, filename(id)); }
          catch (error) { if (error.code === 'EEXIST') throw new LibraryError(409, 'That name already exists. Confirm overwrite to replace it.'); throw error; }
        }
        return publicMetadata(file);
      } finally { if (handle) await handle.close(); await unlink(temporary).catch(() => {}); }
      });
    },
    async load(id) {
      if (!validId(id)) throw new LibraryError(404, 'Shared file not found.');
      let data;
      try { data = await readFile(filename(id)); }
      catch (error) { if (error.code === 'ENOENT') throw new LibraryError(404, 'Shared file not found.'); throw error; }
      const newline = data.indexOf(10);
      if (newline < 0) throw Error('Invalid library record');
      return data.subarray(newline + 1);
    },
  };
}
