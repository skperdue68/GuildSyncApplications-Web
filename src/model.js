import {parseSavedVariables, writeSavedVariables, setLuaValue, isLuaNumericKey} from './lua-data.js';
import {starterTemplates} from './defaults.js';
const table = value => value && typeof value === 'object' && !Array.isArray(value);
const fields = kind => kind === 'message' ? ['title','message','enabled'] : ['title','subject','body','enabled'];
function names(kind) {
  if (!['message','email'].includes(kind)) throw Error('Unknown template category.');
  return kind === 'message' ? ['welcomeMessages','nextWelcomeMessageId'] : ['welcomeEmails','nextWelcomeEmailId'];
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
export function validateEntry(kind, entry) {
  names(kind);
  for (const key of kind==='message'?['message']:['subject','body']) if (typeof entry[key]!=='string' || !entry[key].trim()) throw Error(`${key[0].toUpperCase()+key.slice(1)} is required.`);
  if (kind==='message' && byteLength(entry.message)>335) throw Error('Chat messages must fit within 335 UTF-8 bytes. Shorten the text before saving.');
  if (entry.title!==undefined && typeof entry.title!=='string') throw Error('Title must be text.');
  if (entry.enabled!==undefined && typeof entry.enabled!=='boolean') throw Error('Enabled must be true or false.');
}
export function updateEntry(profile,kind,key,values) {
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
  accounts[account]={$AccountWide:{version:1,records:{},settings:{welcomeMessages:{},welcomeEmails:{},nextWelcomeMessageId:1,nextWelcomeEmailId:1,welcomeMessagePickSequence:0,welcomeEmailPickSequence:0,welcomeDefaultsInitialized:true}}};
  return doc;
}
export function exportDocument(doc) {
  const accounts=profiles(doc);
  if(!accounts.length) throw Error('No account-wide GuildSyncApplications profiles found. Open the SavedVariables file, not addon source code.');
  for(const p of accounts) for(const kind of ['message','email']) for(const {entry} of entries(p,kind)) {
    try { validateEntry(kind,entry); } catch(error) { throw Error(`${p.account}: ${entry.title || kind}: ${error.message}`); }
  }
  return writeSavedVariables(doc);
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
  const starter=starterTemplates[kind].find(template=>templateContent(kind,template)===templateContent(kind,entry));
  if(starter)return starter.webTemplateId;
  return 'gsa-legacy:'+JSON.stringify([source.namespace,source.account,kind,entry.id??key]);
}
function templateContent(kind,entry){return JSON.stringify(kind==='message'?[entry.message]:[entry.subject,entry.body]);}
export function hasTemplate(profile,kind,template) {
  return entries(profile,kind).some(({entry})=>{
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
