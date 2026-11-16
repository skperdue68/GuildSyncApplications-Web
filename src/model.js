import {parseSavedVariables, writeSavedVariables, setLuaValue, isLuaNumericKey} from './lua-data.js';
import {starterTemplates,legacyStarterTemplates} from './defaults.js';
const table = value => value && typeof value === 'object' && !Array.isArray(value);
const fields = kind => kind === 'message' ? ['title','message','enabled'] : ['title','subject','body','enabled'];
function names(kind) {
  if (!['message','email'].includes(kind)) throw Error('Unknown template category.');
  return kind === 'message' ? ['welcomeMessages','nextWelcomeMessageId'] : ['welcomeEmails','nextWelcomeEmailId'];
}
export const TEXT_LIMITS = Object.freeze({message:335,subject:37,body:680});
export const normalizeNewlines = text => String(text).replace(/\r\n?/g,'\n');
export const characterCount = text => Array.from(normalizeNewlines(text)).length;
export function constrainTextEdit(previous,next,max) {
  previous=normalizeNewlines(previous);next=normalizeNewlines(next);
  const old=Array.from(previous), value=Array.from(next), limit=Math.max(max,old.length);
  if(value.length<=limit)return next;
  let prefix=0,suffix=0;
  while(prefix<old.length&&prefix<value.length&&old[prefix]===value[prefix])prefix++;
  while(suffix<old.length-prefix&&suffix<value.length-prefix&&old[old.length-1-suffix]===value[value.length-1-suffix])suffix++;
  return [...value.slice(0,prefix),...value.slice(prefix,value.length-suffix).slice(0,Math.max(0,limit-prefix-suffix)),...value.slice(value.length-suffix)].join('');
}
function normalizedValues(kind,values){const copy={...values};for(const field of fields(kind))if(typeof copy[field]==='string')copy[field]=normalizeNewlines(copy[field]);return copy;}
function cloneLua(value){
  if(!value||typeof value!=='object')return value;
  const copy=Object.create(null);
  for(const [key,item] of Object.entries(value))setLuaValue(copy,key,cloneLua(item),isLuaNumericKey(value,key));
  return copy;
}
export const byteLength = text => new TextEncoder().encode(text).length;
export function preview(text, name) { return String(text || '').replaceAll('{name}', name || '@NewMember'); }
export function profiles(doc) {
  const result=[];
  for (const [namespace, accounts] of Object.entries(doc)) {
    if (!table(accounts)) continue;
    for (const [account, scopes] of Object.entries(accounts)) {
      if (!account.startsWith('@') || !table(scopes) || !table(scopes.$AccountWide)) continue;
      result.push({namespace,account,data:scopes.$AccountWide,label:`${account} · ${namespace}`});
    }
  }
  return result;
}
function settings(profile) {
  if (profile.data.settings !== undefined && !table(profile.data.settings)) throw Error('Invalid settings table.');
  return profile.data.settings || {};
}
export function entries(profile, kind) {
  const list=settings(profile)[names(kind)[0]];
  if (list === undefined) return [];
  if (!table(list)) throw Error('Invalid template list.');
  const keys=Object.keys(list).sort((a,b)=>Number(a)-Number(b));
  if (keys.some((key,i)=>key!==String(i+1) || !isLuaNumericKey(list,key) || !table(list[key]))) throw Error('Template list must have consecutive numeric Lua keys. Keep the original file and repair it in the addon.');
  return keys.map(key=>({key,entry:list[key]}));
}
export function validateEntry(kind, entry, {allowOversized=false}={}) {
  names(kind);
  for (const key of kind==='message'?['message']:['subject','body']) if (typeof entry[key]!=='string' || !entry[key].trim()) throw Error(`${key[0].toUpperCase()+key.slice(1)} is required.`);
  for(const field of kind==='message'?['message']:['subject','body'])if(!allowOversized&&characterCount(entry[field])>TEXT_LIMITS[field])throw Error(`${field[0].toUpperCase()+field.slice(1)} must fit within ${TEXT_LIMITS[field]} characters. Shorten the text before saving.`);
  if (entry.title!==undefined && typeof entry.title!=='string') throw Error('Title must be text.');
  if (entry.enabled!==undefined && typeof entry.enabled!=='boolean') throw Error('Enabled must be true or false.');
}
export function updateEntry(profile,kind,key,values) {
  values=normalizedValues(kind,values);
  const entry=entries(profile,kind).find(item=>item.key===String(key))?.entry;
  if (!entry) throw Error('Template no longer exists.');
  const updated={...entry};
  for (const field of fields(kind)) if (Object.hasOwn(values,field)) updated[field]=values[field];
  validateEntry(kind,updated);
  // Materialize legacy identity before changing its original wording.
  setLuaValue(entry,'webTemplateId',sourceTemplateId(profile,kind,entry,key));
  for (const field of fields(kind)) if (Object.hasOwn(values,field)) setLuaValue(entry,field,values[field]);
  return entry;
}
export function addEntry(profile,kind,values) {
  values=normalizedValues(kind,values);
  validateEntry(kind,values);
  const existing=entries(profile,kind), [listName,nextName]=names(kind), s=settings(profile);
  const id=Math.max(1, Number.isSafeInteger(s[nextName])?s[nextName]:1,...existing.map(({entry})=>Number.isSafeInteger(entry.id)?entry.id+1:1));
  if (!Number.isSafeInteger(id+1)) throw Error('Template ID limit reached.');
  const webTemplateId='gsa-web:'+Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const entry={id,webTemplateId,createdByUser:true,title:values.title?.trim()||`Welcome ${kind} ${id}`,enabled:values.enabled!==false,lastUsed:0,useCount:0,lastPickedSequence:0};
  for (const key of fields(kind)) if (key!=='title' && Object.hasOwn(values,key)) entry[key]=values[key];
  if (!profile.data.settings) setLuaValue(profile.data,'settings',s);
  if (!s[listName]) setLuaValue(s,listName,{});
  setLuaValue(s[listName],existing.length+1,entry);
  setLuaValue(s,nextName,id+1);
  setLuaValue(s,'welcomeDefaultsInitialized',true);
  return entry;
}
export function removeEntry(profile,kind,key) {
  const existing=entries(profile,kind), index=existing.findIndex(item=>item.key===String(key));
  if(index<0) throw Error('Template no longer exists.');
  const list=settings(profile)[names(kind)[0]];
  for(let i=index;i<existing.length-1;i++) setLuaValue(list,i+1,existing[i+1].entry);
  setLuaValue(list,existing.length,undefined);
}
export function newDocument(account) {
  account=account.trim();
  if(!/^@[^\s\p{Cc}]{1,100}$/u.test(account)) throw Error('Enter your ESO account name, starting with @.');
  const doc=Object.create(null), accounts=Object.create(null);
  doc.Default=accounts;
  accounts[account]={$AccountWide:{version:1,records:{},settings:{captureApplicationData:true,welcomeMessages:{},welcomeEmails:{},nextWelcomeMessageId:1,nextWelcomeEmailId:1,welcomeMessagePickSequence:0,welcomeEmailPickSequence:0,welcomeDefaultsInitialized:true}}};
  return doc;
}
export function exportDocument(doc, {allowOversized=false}={}) {
  const normalized=cloneLua(doc);
  const accounts=profiles(normalized);
  if(!accounts.length) throw Error('No account-wide GuildSyncApplications profiles found. Open the SavedVariables file, not addon source code.');
  for(const p of accounts){const value=settings(p).captureApplicationData;if(value!==undefined&&typeof value!=='boolean')throw Error(`${p.account}: application-data capture must be a boolean.`);}
  for(const p of accounts) for(const kind of ['message','email']) for(const {entry} of entries(p,kind)) {
    for(const field of fields(kind))if(typeof entry[field]==='string')setLuaValue(entry,field,normalizeNewlines(entry[field]));
    try { validateEntry(kind,entry,{allowOversized}); } catch(error) { throw Error(`${p.account}: ${entry.title || kind}: ${error.message}`); }
  }
  return writeSavedVariables(normalized);
}

export function captureApplicationData(profile){return settings(profile).captureApplicationData!==false;}
export function setCaptureApplicationData(profile,enabled){
  if(typeof enabled!=='boolean')throw Error('Application-data capture must be a boolean.');
  const s=settings(profile);if(!profile.data.settings)setLuaValue(profile.data,'settings',s);
  setLuaValue(s,'captureApplicationData',enabled);
}
export function exportServerDocument(doc, {allowOversized=false}={}){
  function sanitized(value,depth=0){
    if(depth>100)throw Error('Table nesting limit exceeded');
    if(!value||typeof value!=='object')return value;
    const copy=Object.create(null);
    for(const [key,item] of Object.entries(value))setLuaValue(copy,key,key==='records'?Object.create(null):sanitized(item,depth+1),isLuaNumericKey(value,key));
    return copy;
  }
  return exportDocument(sanitized(doc),{allowOversized});
}

export function importTemplates(target, source, selection) {
  // Stage the recipient settings through the Lua codec to retain numeric key types.
  // Commit only after every selection succeeds; no records or account branches travel.
  const staged=profiles(parseSavedVariables(writeSavedVariables({Default:{'@Recipient':{$AccountWide:{settings:settings(target)}}}})))[0];
  let added=0,skipped=0;
  for(const kind of ['message','email']) {
    const sourceEntries=entries(source,kind);
    for(const key of new Set(selection[kind]||[])) {
      const entry=sourceEntries.find(item=>item.key===String(key))?.entry;
      if(!entry)throw Error('A selected source template no longer exists.');
      const values={};
      for(const field of fields(kind))if(Object.hasOwn(entry,field))values[field]=entry[field];
      validateEntry(kind,values);
      const webTemplateId=sourceTemplateId(source,kind,entry,key);
      if(hasTemplate(staged,kind,{...values,webTemplateId})){skipped++;continue;}
      addTemplate(staged,kind,{...values,webTemplateId});added++;
    }
  }
  if(added)setLuaValue(target.data,'settings',staged.data.settings);
  return {added,skipped};
}

export function sourceTemplateId(source,kind,entry,key) {
  if(typeof entry.webTemplateId==='string'&&entry.webTemplateId)return entry.webTemplateId;
  const starter=[...starterTemplates[kind],...legacyStarterTemplates[kind]].find(template=>templateContent(kind,template)===templateContent(kind,entry));
  if(starter)return starter.webTemplateId;
  return 'gsa-legacy:'+JSON.stringify([source.namespace,source.account,kind,entry.id??key]);
}
function templateContent(kind,entry){return JSON.stringify((kind==='message'?[entry.message]:[entry.subject,entry.body]).map(value=>typeof value==='string'?normalizeNewlines(value):value));}
export function hasTemplate(profile,kind,template) {
  return entries(profile,kind).some(({entry,key})=>{
    if(template.webTemplateId===sourceTemplateId(profile,kind,entry,key))return true;
    const bothIdentified=typeof template.webTemplateId==='string'&&template.webTemplateId&&typeof entry.webTemplateId==='string'&&entry.webTemplateId;
    return bothIdentified?entry.webTemplateId===template.webTemplateId:templateContent(kind,entry)===templateContent(kind,template);
  });
}
export function addTemplate(profile,kind,template) {
  if(hasTemplate(profile,kind,template))throw Error('This template has already been added to this account.');
  const entry=addEntry(profile,kind,template);
  if(typeof template.webTemplateId==='string'&&template.webTemplateId)setLuaValue(entry,'webTemplateId',template.webTemplateId);
  return entry;
}

export function applyTemplateToAccounts(doc,sourceIndex,kind,key,values,targetIndices) {
  names(kind);
  const accounts=profiles(doc),indices=new Set([sourceIndex,...targetIndices]);
  for(const index of indices)if(!Number.isInteger(index)||index<0||index>=accounts.length)throw Error('Invalid account selection.');
  const source=accounts[sourceIndex];
  const original=key===null?null:entries(source,kind).find(item=>item.key===String(key))?.entry;
  if(key!==null&&!original)throw Error('Template no longer exists.');
  const staged=new Map([...indices].map(index=>[index,{...accounts[index],data:{settings:cloneLua(settings(accounts[index]))}}]));
  const sourceStage=staged.get(sourceIndex);
  let sourceKey,identity,added=0,updated=0;
  if(original){updateEntry(sourceStage,kind,key,values);identity=entries(sourceStage,kind).find(item=>item.key===String(key)).entry.webTemplateId;sourceKey=String(key);updated++;}
  else {const entry=addEntry(sourceStage,kind,values);identity=entry.webTemplateId;sourceKey=entries(sourceStage,kind).find(item=>item.entry===entry).key;added++;}
  const edited=entries(sourceStage,kind).find(item=>item.key===sourceKey).entry;
  const editable=Object.fromEntries(fields(kind).filter(field=>Object.hasOwn(edited,field)).map(field=>[field,edited[field]]));
  for(const [index,recipient] of staged){
    if(index===sourceIndex)continue;
    const match=entries(recipient,kind).find(({entry,key:recipientKey})=>{
      if(identity===sourceTemplateId(recipient,kind,entry,recipientKey))return true;
      return original&&(!entry.webTemplateId||!original.webTemplateId)&&templateContent(kind,entry)===templateContent(kind,original);
    });
    if(match){updateEntry(recipient,kind,match.key,editable);setLuaValue(match.entry,'webTemplateId',identity);updated++;}
    else {const entry=addEntry(recipient,kind,editable);setLuaValue(entry,'webTemplateId',identity);added++;}
  }
  for(const [index,recipient] of staged)setLuaValue(accounts[index].data,'settings',recipient.data.settings);
  return {sourceKey,added,updated,accountCount:indices.size};
}
