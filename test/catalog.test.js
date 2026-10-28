import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';
import {parseSavedVariables} from '../src/lua-data.js';
import {starterTemplates} from '../src/defaults.js';

test('catalog detects existing wording across titles and IDs and blocks repeated starter additions',()=>{
 const doc=model.newDocument('@Recipient'),p=model.profiles(doc)[0];
 const template={title:'Starter',message:'Welcome {name}',enabled:true};
 const added=model.addTemplate(p,'message',template);
 assert.equal(added.id,1);
 assert.equal(model.hasTemplate(p,'message',{...template,title:'Renamed',id:99}),true);
 assert.throws(()=>model.addTemplate(p,'message',template),/already/i);
 assert.equal(model.entries(p,'message').length,1);
 assert.equal(typeof added.webTemplateId,'string');
 assert.equal(model.hasTemplate(p,'message',{webTemplateId:added.webTemplateId,message:'Edited wording'}),true);
 assert.equal(model.hasTemplate(model.profiles(model.newDocument('@Other'))[0],'message',template),false);
});

test('permanent template IDs survive imports while numeric IDs stay local and duplication gets a new identity',()=>{
 const source=model.profiles(model.newDocument('@Writer'))[0],targetDoc=model.newDocument('@Friend'),target=model.profiles(targetDoc)[0];
 const original=model.addTemplate(source,'message',{message:'Original',enabled:true});
 model.addEntry(target,'message',{message:'Unrelated',enabled:true});
 model.importTemplates(target,source,{message:['1']});
 const imported=model.entries(target,'message')[1].entry;
 assert.equal(imported.id,2);assert.equal(imported.webTemplateId,original.webTemplateId);
 assert.equal(model.profiles(parseSavedVariables(model.exportDocument(targetDoc)))[0].data.settings.welcomeMessages[2].webTemplateId,original.webTemplateId);
 model.updateEntry(target,'message','2',{message:'Personalized'});
 assert.deepEqual(model.importTemplates(target,source,{message:['1']}),{added:0,skipped:1});
 const copy=model.addEntry(target,'message',{message:imported.message,title:'Intentional copy'});
 assert.notEqual(copy.webTemplateId,imported.webTemplateId);
});
test('mail catalogs compare both subject and body and preserve category boundaries',()=>{
 const p=model.profiles(model.newDocument('@Recipient'))[0];
 model.addTemplate(p,'email',{title:'Mail',subject:'Hello',body:'Welcome',enabled:false});
 assert.equal(model.hasTemplate(p,'email',{subject:'Hello',body:'Welcome'}),true);
 assert.equal(model.hasTemplate(p,'email',{subject:'Different',body:'Welcome'}),false);
 assert.equal(model.hasTemplate(p,'message',{message:'Welcome'}),false);
});

test('legacy starters and custom entries acquire their original identity before wording edits',()=>{
 const p=model.profiles(model.newDocument('@OldAccount'))[0],starter=starterTemplates.message[0];
 const entry=model.addEntry(p,'message',starter);delete entry.webTemplateId;
 model.updateEntry(p,'message','1',{message:'Personalized legacy starter'});
 assert.equal(entry.webTemplateId,starter.webTemplateId);
 assert.equal(model.hasTemplate(p,'message',starter),true);
 const custom=model.addEntry(p,'message',{message:'Old custom'});delete custom.webTemplateId;
 const oldIdentity=model.sourceTemplateId(p,'message',custom,'2');
 model.updateEntry(p,'message','2',{message:'Updated custom'});
 assert.equal(custom.webTemplateId,oldIdentity);
});

test('intentional copies have separate permanent identities and both survive import',()=>{
 const source=model.profiles(model.newDocument('@Writer'))[0],target=model.profiles(model.newDocument('@Friend'))[0];
 model.addEntry(source,'message',{message:'Same wording',title:'Original'});
 model.addEntry(source,'message',{message:'Same wording',title:'Intentional copy'});
 assert.deepEqual(model.importTemplates(target,source,{message:['1','2']}),{added:2,skipped:0});
 assert.equal(model.entries(target,'message').length,2);
});
