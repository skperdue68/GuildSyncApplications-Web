import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';
import {parseSavedVariables,writeSavedVariables} from '../src/lua-data.js';

test('template import adds selected wording while retaining recipient records, accounts and usage',()=>{
 const source=model.newDocument('@Writer'),sp=model.profiles(source)[0];
 model.addEntry(sp,'message',{title:'Family',message:'Hello {name}',enabled:false});
 model.addEntry(sp,'email',{title:'Letter',subject:'Welcome',body:'Dear {name}',enabled:true});
 sp.data.settings.welcomeMessages[1].useCount=90;sp.data.records={secret:'source only'};
 const target=parseSavedVariables('GuildSyncApplications={Default={ ["@Friend"]={["$AccountWide"]={version=1,records={keep="recipient"},settings={nextWelcomeMessageId=8,welcomeMessages={[1]={id=7,title="Existing",message="Original",useCount=12}},welcomeEmails={},custom="keep"}}}, ["@Other"]={["$AccountWide"]={records={keep=true},settings={}}}}}');
 const tp=model.profiles(target)[0],before=writeSavedVariables(source);
 assert.deepEqual(model.importTemplates(tp,sp,{message:['1'],email:['1']}),{added:2,skipped:0});
 const out=parseSavedVariables(model.exportDocument(target)),s=out.Default['@Friend'].$AccountWide.settings;
 assert.equal(s.welcomeMessages[1].useCount,12);assert.equal(s.welcomeMessages[2].id,8);
 assert.equal(s.welcomeMessages[2].useCount,0);assert.equal(s.welcomeMessages[2].enabled,false);
 assert.equal(s.welcomeEmails[1].body,'Dear {name}');assert.equal(s.custom,'keep');
 assert.equal(out.Default['@Friend'].$AccountWide.records.keep,'recipient');
 assert.equal(out.Default['@Other'].$AccountWide.records.keep,true);assert.equal(out.Default['@Writer'],undefined);
 assert.equal(writeSavedVariables(source),before);
 assert.deepEqual(model.importTemplates(tp,sp,{message:['1'],email:['1']}),{added:0,skipped:2});
});
test('import into blank settings supports category selection and is atomic on invalid source',()=>{
 const source=model.newDocument('@Writer'),sp=model.profiles(source)[0];
 model.addEntry(sp,'message',{message:'Welcome',enabled:true});
 model.addEntry(sp,'email',{subject:'Hello',body:'Welcome!',enabled:true});
 const target=model.newDocument('@Friend'),tp=model.profiles(target)[0];
 assert.deepEqual(model.importTemplates(tp,sp,{email:['1']}),{added:1,skipped:0});
 assert.equal(model.entries(tp,'message').length,0);
 const before=writeSavedVariables(target);sp.data.settings.welcomeEmails[1].body='';
 assert.throws(()=>model.importTemplates(tp,sp,{message:['1'],email:['1']}),/required/);
 assert.equal(writeSavedVariables(target),before);
 assert.throws(()=>model.importTemplates(tp,sp,{message:['99']}),/no longer exists/i);
});
