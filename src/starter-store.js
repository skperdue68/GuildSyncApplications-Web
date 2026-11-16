import {mkdir,readFile,open,rename,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {starterTemplates} from './defaults.js';
import {validateEntry,normalizeNewlines,characterCount} from './model.js';

const MAX_TEMPLATES=200,MAX_CATALOGUE_BYTES=1024*1024;
const pending=new Map();
export class StarterError extends Error{constructor(status,message){super(message);this.status=status;}}
const bad=message=>{throw new StarterError(400,message);};
const validId=id=>typeof id==='string'&&/^(?:gsa-starter:(?:message|email):\d+|gsa-shared:[a-f0-9-]{36})$/.test(id);
const digest=value=>createHash('sha256').update(value).digest();
function templateFields(input){
 if(!input||typeof input!=='object'||Array.isArray(input))bad('Provide a starter template.');
 if(!['message','email'].includes(input.kind))bad('Choose welcome chat or email.');
 if(typeof input.title!=='string'||!input.title.isWellFormed()||!input.title.trim()||characterCount(input.title.trim())>120||/[\p{Cc}]/u.test(input.title))bad('Use a starter name of 1–120 characters without control characters.');
 const result={kind:input.kind,title:input.title.trim()};
 for(const field of input.kind==='message'?['message']:['subject','body']){
  if(typeof input[field]!=='string')bad(`${field} must be text.`);
  if(!input[field].isWellFormed())bad(`${field} contains invalid Unicode text.`);
  result[field]=normalizeNewlines(input[field]);
 }
 try{validateEntry(result.kind,result);}catch(error){bad(error.message);}
 return result;
}
function seeds(){
 return ['message','email'].flatMap(kind=>starterTemplates[kind].map(template=>({...templateFields({...template,kind}),webTemplateId:template.webTemplateId})));
}
async function serialized(key,operation){
 const previous=pending.get(key)||Promise.resolve(),current=previous.catch(()=>{}).then(operation);pending.set(key,current);
 try{return await current;}finally{if(pending.get(key)===current)pending.delete(key);}
}
export function createStarterStore(directory,{managementPassword='',now=Date.now}={}){
 if(typeof managementPassword!=='string'||Buffer.byteLength(managementPassword,'utf8')>1024)throw Error('STARTER_MANAGEMENT_PASSWORD must be text of at most 1024 UTF-8 bytes.');
 const location=resolve(directory),path=resolve(location,'catalogue.json'),secret=digest(managementPassword),failures=new Map();
 const publicView=catalogue=>({revision:catalogue.revision,templates:catalogue.templates,managementEnabled:!!managementPassword});
 async function read(){
  let text;
  try{if((await stat(path)).size>MAX_CATALOGUE_BYTES)throw Error('Starter catalogue is too large.');text=await readFile(path,'utf8');}
  catch(error){if(error.code==='ENOENT')return {version:1,revision:'builtin-v1',templates:seeds()};throw error;}
  const value=JSON.parse(text);
  if(value.version!==1||typeof value.revision!=='string'||!value.revision||value.revision.length>100||!Array.isArray(value.templates)||value.templates.length>MAX_TEMPLATES)throw Error('Invalid starter catalogue.');
  const ids=new Set();
  const templates=value.templates.map(input=>{
   if(!validId(input?.webTemplateId)||ids.has(input.webTemplateId))throw Error('Invalid starter identity.');ids.add(input.webTemplateId);
   const template={...templateFields(input),webTemplateId:input.webTemplateId};
   for(const field of ['createdAt','updatedAt'])if(typeof input[field]==='string')template[field]=input[field];
   return template;
  });
  return {version:1,revision:value.revision,templates};
 }
 async function authorize(password,clientKey='local'){
  if(!managementPassword)throw new StarterError(503,'Starter management is not enabled on this server.');
  const key=String(clientKey),time=now(),entry=failures.get(key);
  if(entry&&time-entry.at<15*60*1000&&entry.count>=5)throw new StarterError(429,'Too many incorrect management passwords. Try again in 15 minutes.');
  if(typeof password!=='string'||Buffer.byteLength(password,'utf8')>1024||!timingSafeEqual(digest(typeof password==='string'?password:''),secret)){
   if(failures.size>=1000&&!failures.has(key))failures.delete(failures.keys().next().value);
   failures.set(key,entry&&time-entry.at<15*60*1000?{...entry,count:entry.count+1}:{at:time,count:1});
   throw new StarterError(403,'The starter-management password is missing or incorrect.');
  }
  failures.delete(key);
 }
 async function mutate(password,revision,clientKey,operation){
  await authorize(password,clientKey);
  return serialized(path,async()=>{
   const catalogue=await read();
   if(typeof revision!=='string')bad('Provide the starter catalogue revision.');
   if(revision!==catalogue.revision)throw new StarterError(409,'The starter catalogue changed. Reload it and review your changes before saving.');
   operation(catalogue);
   catalogue.revision=randomUUID();
   const text=JSON.stringify(catalogue,null,2)+'\n';
   if(Buffer.byteLength(text,'utf8')>MAX_CATALOGUE_BYTES)throw new StarterError(413,'The starter catalogue is full.');
   await mkdir(location,{recursive:true});const temporary=resolve(location,randomUUID()+'.tmp');let handle;
   try{
    handle=await open(temporary,'wx',0o600);await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=null;
    await rename(temporary,path);
   }finally{if(handle)await handle.close();await unlink(temporary).catch(()=>{});}
   return publicView(catalogue);
  });
 }
 return {
  async list(){return publicView(await read());},authorize,
  async save(input,password,revision,clientKey){
   return mutate(password,revision,clientKey,catalogue=>{
    const fields=templateFields(input),at=new Date(now()).toISOString();
    if(input.webTemplateId!==undefined){
     if(!validId(input.webTemplateId))bad('Invalid starter identity.');
     const index=catalogue.templates.findIndex(item=>item.webTemplateId===input.webTemplateId);
     if(index<0)throw new StarterError(404,'Starter not found.');
     const old=catalogue.templates[index];if(old.kind!==fields.kind)bad('A starter cannot change category. Create a new starter instead.');
     catalogue.templates[index]={...fields,webTemplateId:old.webTemplateId,createdAt:old.createdAt||at,updatedAt:at};
    }else{
     if(catalogue.templates.length>=MAX_TEMPLATES)throw new StarterError(413,'The starter catalogue is full.');
     catalogue.templates.push({...fields,webTemplateId:'gsa-shared:'+randomUUID(),createdAt:at,updatedAt:at});
    }
   });
  },
  async remove(id,password,revision,clientKey){return mutate(password,revision,clientKey,catalogue=>{
   if(!validId(id))bad('Invalid starter identity.');
   const index=catalogue.templates.findIndex(template=>template.webTemplateId===id);
   if(index<0)throw new StarterError(404,'Starter not found.');catalogue.templates.splice(index,1);
  });}
 };
}
