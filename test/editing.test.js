import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../src/model.js';
import {parseSavedVariables,writeSavedVariables} from '../src/lua-data.js';
import {starterTemplates} from '../src/defaults.js';
const make=()=>parseSavedVariables('GuildSyncApplications={Default={["@A"]={['+JSON.stringify('$AccountWide')+']={records={[4]={note="x\\013y"}},settings={captureApplicationData=false,welcomeMessages={[1]={id=7,message="original",useCount=5,lastUsed=8,lastPickedSequence=9}},nextWelcomeMessageId=8,welcomeEmails={}}}},["@B"]={['+JSON.stringify('$AccountWide')+']={records={},settings={custom=true,welcomeMessages={},welcomeEmails={}}}},["@C"]={['+JSON.stringify('$AccountWide')+']={records={},settings={welcomeMessages={},welcomeEmails={}}}}}}');
test('normalized codepoint limits and bounded replacement preserve suffix',()=>{
 assert.equal(m.normalizeNewlines('a\r\n\r\nb\rc'),'a\n\nb\nc');
 assert.equal(m.characterCount('😀\r\nÉ'),3);
 assert.equal(m.constrainTextEdit('abcd','abXYZcd',5),'abXcd');
 assert.equal(m.constrainTextEdit('😀ab','😀XYZab',4),'😀Xab');
 assert.equal(m.constrainTextEdit('abcdef','abcde',3),'abcde');
 assert.equal(m.constrainTextEdit('abcdef','abcXYZdef',3),'abcdef');
 assert.doesNotThrow(()=>m.validateEntry('message',{message:'😀'.repeat(335)}));
 for(const [kind,field,max] of [['message','message',335],['email','subject',37],['email','body',680]])assert.throws(()=>m.validateEntry(kind,{message:'a',subject:'a',body:'a',[field]:'a'.repeat(max+1)}),new RegExp(String(max)));
 for(const kind of ['message','email'])for(const e of starterTemplates[kind])assert.doesNotThrow(()=>m.validateEntry(kind,e));
});
test('template export normalizes without mutating records or source',()=>{
 const doc=make(),p=m.profiles(doc)[0];m.updateEntry(p,'message','1',{message:'a\r\n\r\nb\rc'});
 assert.equal(m.entries(p,'message')[0].entry.message,'a\n\nb\nc');
 p.data.settings.welcomeMessages[1].message='one\r\ntwo';
 const out=m.exportDocument(doc);assert.match(out,/one\\ntwo/);assert.doesNotMatch(out,/\\010/);assert.match(out,/x\\ry/);
 assert.equal(p.data.settings.welcomeMessages[1].message,'one\r\ntwo');
 assert.equal(parseSavedVariables(out).Default['@A'].$AccountWide.records[4].note,'x\ry');
});
test('cross-account update preserves local history and stages atomic failures',()=>{
 const doc=make(),ps=m.profiles(doc),beforeC=writeSavedVariables(doc.Default['@C']);
 const r=m.applyTemplateToAccounts(doc,0,'message','1',{message:'updated'},[1]);
 assert.deepEqual(r,{sourceKey:'1',added:1,updated:1,accountCount:2});
 const a=m.entries(ps[0],'message')[0].entry,b=m.entries(ps[1],'message')[0].entry;
 assert.equal(a.id,7);assert.equal(a.useCount,5);assert.equal(b.useCount,0);assert.equal(a.webTemplateId,b.webTemplateId);assert.equal(ps[0].data.settings.captureApplicationData,false);assert.equal(ps[1].data.settings.custom,true);
 b.useCount=99;m.applyTemplateToAccounts(doc,0,'message','1',{message:'again'},[1]);assert.equal(b.useCount,99);
 assert.equal(m.entries(ps[1],'message')[0].entry.useCount,99);assert.equal(writeSavedVariables(doc.Default['@C']),beforeC);
 const before=writeSavedVariables(doc);assert.throws(()=>m.applyTemplateToAccounts(doc,0,'message','1',{message:'oops'},[99]));assert.equal(writeSavedVariables(doc),before);
 ps[1].data.settings.nextWelcomeMessageId=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>m.applyTemplateToAccounts(doc,0,'email',null,{subject:'hello',body:'a'.repeat(681)},[1]));assert.equal(m.entries(ps[0],'email').length,0);
});
test('new templates share identity; legacy content match updates but distinct identities do not',()=>{
 const doc=make(),ps=m.profiles(doc);m.addEntry(ps[1],'message',{message:'original'});delete m.entries(ps[1],'message')[0].entry.webTemplateId;
 m.applyTemplateToAccounts(doc,0,'message','1',{message:'changed'},[1]);assert.equal(m.entries(ps[1],'message').length,1);
 m.entries(ps[1],'message')[0].entry.webTemplateId='distinct';
 m.applyTemplateToAccounts(doc,0,'message','1',{message:'changed again'},[1]);assert.equal(m.entries(ps[1],'message').length,2);
 const r=m.applyTemplateToAccounts(doc,0,'email',null,{subject:'s\r\nt',body:'hello\rworld'},[1,1]);assert.equal(r.added,2);assert.equal(r.updated,0);assert.equal(r.accountCount,2);
 assert.equal(m.entries(ps[1],'email')[0].entry.body,'hello\nworld');
});
test('recipient allocation failure rolls back source and earlier recipients',()=>{
 const doc=make(),ps=m.profiles(doc);ps[2].data.settings.nextWelcomeMessageId=Number.MAX_SAFE_INTEGER;
 const before=writeSavedVariables(doc);
 assert.throws(()=>m.applyTemplateToAccounts(doc,0,'message','1',{message:'replacement'},[1,2]),/ID limit/);
 assert.equal(writeSavedVariables(doc),before);
});
test('legacy over-limit templates stay intact until explicitly corrected',()=>{
 const doc=make(),p=m.profiles(doc)[0];p.data.settings.welcomeMessages[1].message='a'.repeat(336);
 assert.equal(m.entries(p,'message')[0].entry.message.length,336);
 assert.throws(()=>m.exportDocument(doc),/335/);assert.equal(p.data.settings.welcomeMessages[1].message.length,336);
 assert.equal(m.constrainTextEdit('a'.repeat(336),'a'.repeat(336)+'x',335),'a'.repeat(336));
 m.updateEntry(p,'message','1',{message:'a'.repeat(335)});assert.doesNotThrow(()=>m.exportDocument(doc));
});
test('equivalent legacy CRLF content updates recipients and preserves local history',()=>{
 const doc=make(),ps=m.profiles(doc);ps[0].data.settings.welcomeMessages[1].message='line one\r\n\r\nline two\rline three';
 const dest=m.addEntry(ps[1],'message',{message:'line one\n\nline two\nline three'});delete dest.webTemplateId;dest.useCount=42;const id=dest.id;
 m.applyTemplateToAccounts(doc,0,'message','1',{message:'edited'},[1]);
 const list=m.entries(ps[1],'message');assert.equal(list.length,1);assert.equal(list[0].entry.id,id);assert.equal(list[0].entry.useCount,42);assert.equal(list[0].entry.message,'edited');
});
test('template import skips legacy content with equivalent newlines',()=>{
 const doc=make(),ps=m.profiles(doc);ps[0].data.settings.welcomeMessages[1].message='same\r\n\r\nbody';
 const dest=m.addEntry(ps[1],'message',{message:'same\n\nbody'});delete dest.webTemplateId;
 assert.deepEqual(m.importTemplates(ps[1],ps[0],{message:['1']}),{added:0,skipped:1});
});
test('original addon mail presets retain the shortened web preset identities',async()=>{
 const {legacyStarterTemplates}=await import('../src/defaults.js');assert.equal(legacyStarterTemplates.email.length,2);
 const doc=make(),source=m.profiles(doc)[0];
 for(const entry of legacyStarterTemplates.email){
   assert.match(entry.webTemplateId,/^gsa-starter:email:(2|4)$/);
   const original={...entry};delete original.webTemplateId;
   assert.equal(m.sourceTemplateId(source,'email',original,99),entry.webTemplateId);
   assert.equal(m.sourceTemplateId(source,'email',{...original,body:original.body.replaceAll('\n','\r\n')},99),entry.webTemplateId);
 }
 assert.equal(legacyStarterTemplates.email[0].subject,"Congratulations - You've Been Made {name}");
 assert.match(legacyStarterTemplates.email[1].body,/Your application has been reviewed by several shadowy figures/);
});
test('explicit legacy read export preserves oversized content while retaining validation and scrubbing records',()=>{
 const doc=make(),p=m.profiles(doc)[0],body='x'.repeat(681)+'\r\nlast';
 m.addEntry(p,'email',{subject:'hello',body:'short'});p.data.settings.welcomeEmails[1].body=body;
 assert.throws(()=>m.exportDocument(doc),/680/);assert.throws(()=>m.exportServerDocument(doc),/680/);
 const result=parseSavedVariables(m.exportServerDocument(doc,{allowOversized:true}));
 assert.equal(result.Default['@A'].$AccountWide.settings.welcomeEmails[1].body,'x'.repeat(681)+'\nlast');
 assert.deepEqual(Object.keys(result.Default['@A'].$AccountWide.records),[]);
 assert.equal(p.data.settings.welcomeEmails[1].body,body);assert.equal(p.data.records[4].note,'x\ry');
 assert.doesNotThrow(()=>m.exportDocument(doc,{allowOversized:true}));
 p.data.settings.welcomeEmails[1].body=42;assert.throws(()=>m.exportServerDocument(doc,{allowOversized:true}),/required/);
 p.data.settings.welcomeEmails[1].body=' ';assert.throws(()=>m.exportServerDocument(doc,{allowOversized:true}),/required/);
});
test('legacy addon email aliases suppress current preset duplicates and update by effective identity',async()=>{
 const {legacyStarterTemplates}=await import('../src/defaults.js');
 for(const legacy of legacyStarterTemplates.email){
  const doc=make(),ps=m.profiles(doc),current=starterTemplates.email.find(item=>item.webTemplateId===legacy.webTemplateId);
  const old={id:91,subject:legacy.subject,body:legacy.body,useCount:17,lastUsed:123,lastPickedSequence:5};
  const {setLuaValue}=await import('../src/lua-data.js');setLuaValue(ps[1].data.settings.welcomeEmails,1,old);
  assert.equal(m.hasTemplate(ps[1],'email',current),true);
  const source=m.addTemplate(ps[0],'email',current);
  const result=m.applyTemplateToAccounts(doc,0,'email','1',{subject:source.subject,body:source.body},[1]);
  assert.equal(result.added,0);assert.equal(result.updated,2);
  const list=m.entries(ps[1],'email');assert.equal(list.length,1);assert.equal(list[0].entry.id,91);assert.equal(list[0].entry.useCount,17);assert.equal(list[0].entry.lastUsed,123);assert.equal(list[0].entry.lastPickedSequence,5);assert.equal(list[0].entry.body,current.body);assert.equal(list[0].entry.webTemplateId,current.webTemplateId);
 }
});
