import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';
import {parseSavedVariables, writeSavedVariables} from '../src/lua-data.js';

export const fixture = 'GuildSyncApplications = { Default = { ["@Apollo"] = { ["$AccountWide"] = { version = 1, records = {[4]={name="@Recruit", status="accepted"}}, settings = { welcomeDefaultsInitialized=true, nextWelcomeMessageId=9, welcomeMessages = {[1]={id=8,title="Family",message="Hi {name}!",enabled=true,useCount=17,lastUsed=123,lastPickedSequence=3,extra="keep"}}, welcomeEmails={}, customFlag="keep" } } }, ["@Other"] = { ["$AccountWide"]={version=1,records={},settings={welcomeMessages={},welcomeEmails={}}} } } }';

test('edit and export preserve usage, unknown fields, records and other accounts',()=>{
  const doc=parseSavedVariables(fixture); const profiles=model.profiles(doc);
  assert.equal(profiles.length,2);
  const p=profiles[0]; const originalOther=JSON.stringify(doc.Default['@Other']);
  model.updateEntry(p,'message','1',{title:'New name',message:'Welcome {name}',enabled:false});
  const result=parseSavedVariables(model.exportDocument(doc));
  const e=result.Default['@Apollo'].$AccountWide.settings.welcomeMessages[1];
  assert.equal(e.message,'Welcome {name}'); assert.equal(e.title,'New name'); assert.equal(e.enabled,false);
  assert.equal(e.useCount,17); assert.equal(e.lastUsed,123); assert.equal(e.extra,'keep');
  assert.equal(result.Default['@Apollo'].$AccountWide.records[4].name,'@Recruit');
  assert.equal(JSON.stringify(result.Default['@Other']),originalOther);
});
test('new chat and email entries use unique numeric IDs and Lua numeric list keys',()=>{
  const doc=parseSavedVariables(fixture), p=model.profiles(doc)[0];
  const e=model.addEntry(p,'message',{title:'Second',message:'Hello',enabled:true});
  assert.equal(e.id,9); assert.equal(e.createdByUser,true); assert.equal(e.useCount,0);
  model.addEntry(p,'email',{title:'Mail',subject:'Welcome {name}',body:'Line 1\nLine 2',enabled:true});
  const out=model.exportDocument(doc); assert.match(out,/\[2\] =/);
  assert.equal(parseSavedVariables(out).Default['@Apollo'].$AccountWide.settings.nextWelcomeMessageId,10);
  model.removeEntry(p,'message','1');
  const reloaded=model.profiles(parseSavedVariables(model.exportDocument(doc)))[0];
  assert.equal(model.entries(reloaded,'message')[0].entry.id,9);
});
test('UTF-8 byte validation prevents addon truncation and incomplete email saves',()=>{
  assert.doesNotThrow(()=>model.validateEntry('message',{message:'é'.repeat(167)+'!'}));
  assert.throws(()=>model.validateEntry('message',{message:'é'.repeat(168)}),/335/);
  assert.throws(()=>model.validateEntry('message',{message:'  '}),/required/i);
  assert.throws(()=>model.validateEntry('email',{subject:'Hello',body:''}),/required/i);
  assert.equal(model.preview('Hi {name}, {name}!', '@Apollo'),'Hi @Apollo, @Apollo!');
});
test('new configuration is account-wide and can be installed in the addon',()=>{
  const doc=model.newDocument('@Apollo'), p=model.profiles(doc)[0];
  model.addEntry(p,'message',{message:'Welcome!',title:'Hello',enabled:true});
  const round=parseSavedVariables(writeSavedVariables(doc));
  assert.equal(round.Default['@Apollo'].$AccountWide.version,1);
  assert.equal(round.Default['@Apollo'].$AccountWide.settings.welcomeDefaultsInitialized,true);
  assert.throws(()=>model.newDocument('Apollo'),/@/);
});
test('sparse or non-numeric template keys cannot silently lose messages',()=>{
  const doc=parseSavedVariables(fixture), p=model.profiles(doc)[0];
  p.data.settings.welcomeMessages.bad={message:'Keep me'};
  assert.throws(()=>model.exportDocument(doc),/list/i);
});
