import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';
import {parseSavedVariables,writeSavedVariables} from '../src/lua-data.js';

test('shared exports empty all application record tables without changing personal data or Lua key types',()=>{
 const doc=parseSavedVariables('GuildSyncApplications={records={[1]={secret="legacy"}},Default={["@One"]={["$AccountWide"]={version=1,records={[7]={applicant="@Private",application="secret text"}},settings={captureApplicationData=false,welcomeMessages={},welcomeEmails={},unknown={[2]="numeric"}}},["Character"]={records={[1]={private="character"}}}},["@Two"]={["$AccountWide"]={records={[1]={private="second"}},settings={}}}}}');
 const before=writeSavedVariables(doc);
 const shared=model.exportServerDocument(doc),out=parseSavedVariables(shared);
 assert.equal(Object.keys(out.records).length,0);
 assert.equal(Object.keys(out.Default['@One'].$AccountWide.records).length,0);
 assert.equal(Object.keys(out.Default['@One'].Character.records).length,0);
 assert.equal(Object.keys(out.Default['@Two'].$AccountWide.records).length,0);
 assert.equal(out.Default['@One'].$AccountWide.settings.captureApplicationData,false);
 assert.match(shared,/\[2\] = "numeric"/);
 assert.doesNotMatch(shared,/@Private|secret text|legacy|character|second/);
 assert.equal(writeSavedVariables(doc),before);
 assert.equal(parseSavedVariables(model.exportDocument(doc)).Default['@One'].$AccountWide.records[7].application,'secret text');
});

test('capture setting defaults enabled, remains per account and preserves records when disabled',()=>{
 const doc=parseSavedVariables('GuildSyncApplications={Default={["@One"]={["$AccountWide"]={records={keep=true},settings={}}},["@Two"]={["$AccountWide"]={records={},settings={}}}}}');
 const [one,two]=model.profiles(doc);
 assert.equal(model.captureApplicationData(one),true);
 model.setCaptureApplicationData(one,false);
 assert.equal(model.captureApplicationData(one),false);assert.equal(model.captureApplicationData(two),true);
 assert.equal(one.data.records.keep,true);
 assert.equal(parseSavedVariables(model.exportDocument(doc)).Default['@One'].$AccountWide.settings.captureApplicationData,false);
 assert.equal(model.profiles(model.newDocument('@New'))[0].data.settings.captureApplicationData,true);
 assert.throws(()=>model.setCaptureApplicationData(one,'false'),/boolean/i);
});
