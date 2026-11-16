import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {createServer} from '../src/server.js';
import {parseSavedVariables} from '../src/lua-data.js';

const dir=await mkdtemp(join(tmpdir(),'gsa-starter-browser-'));
const server=createServer({libraryDir:join(dir,'library'),startersDir:join(dir,'starters'),starterManagementPassword:'test-manager'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||(existsSync(chrome)?chrome:undefined)});
const admin=await browser.newPage({viewport:{width:1440,height:1000}}),reader=await browser.newPage(),errors=[];
for(const page of [admin,reader]){page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());}
try{
 await admin.goto(origin);await admin.getByRole('button',{name:'Starters',exact:true}).click();
 await admin.getByRole('button',{name:'Manage starters',exact:true}).click();
 await admin.getByLabel('Starter-management password',{exact:true}).fill('wrong');
 await admin.getByRole('button',{name:'Unlock management',exact:true}).click();
 await admin.getByText('The starter-management password is missing or incorrect.',{exact:true}).waitFor();
 await admin.getByLabel('Starter-management password',{exact:true}).fill('test-manager');
 await admin.getByRole('button',{name:'Unlock management',exact:true}).click();
 await admin.getByRole('button',{name:'Add starter',exact:true}).click();
 await admin.getByLabel('Starter name',{exact:true}).fill('Published welcome');
 await admin.getByLabel('Starter message',{exact:true}).fill('x'.repeat(336));
 assert.equal((await admin.getByLabel('Starter message',{exact:true}).inputValue()).length,335);
 const original='Welcome {name}!\n\nMake yourself at home.';
 await admin.getByLabel('Starter message',{exact:true}).fill(original);
 await admin.getByRole('button',{name:'Publish starter',exact:true}).click();
 await admin.locator('.starter-notice').filter({hasText:'Starter published for everyone to use.'}).waitFor();
 let catalogue=await(await fetch(origin+'/api/starters')).json();const published=catalogue.templates.find(t=>t.title==='Published welcome');assert.ok(published);
 assert.doesNotMatch(JSON.stringify(catalogue),/test-manager/);
 await reader.goto(origin);await reader.getByRole('button',{name:'Start a new file',exact:true}).click();
 await reader.locator('#new-account').fill('@Reader');await reader.getByRole('button',{name:'Create file',exact:true}).click();
 await reader.getByRole('button',{name:'Browse starters',exact:true}).click();
 const card=reader.locator('#starter-list .starter').filter({has:reader.getByRole('heading',{name:'Published welcome',exact:true})});
 await card.getByRole('button',{name:'Use this starter',exact:true}).click();
 assert.equal(await reader.getByLabel('Message text',{exact:true}).inputValue(),original);
 const downloaded=reader.waitForEvent('download');await reader.getByRole('button',{name:'Download Lua',exact:true}).click();
 const doc=parseSavedVariables(await readFile(await(await downloaded).path(),'utf8'));assert.equal(doc.Default['@Reader'].$AccountWide.settings.welcomeMessages[1].webTemplateId,published.webTemplateId);
 await admin.getByRole('button',{name:'Edit starter Published welcome',exact:true}).click();
 await admin.getByLabel('Starter message',{exact:true}).fill('Updated public wording');
 let releaseWrite;const writeGate=new Promise(resolve=>{releaseWrite=resolve;});
 await admin.route('**/api/starters',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();await writeGate;await route.fulfill({response});});
 const writeStarted=admin.waitForRequest(request=>request.method()==='POST'&&request.url().endsWith('/api/starters'));
 await admin.getByRole('button',{name:'Save starter',exact:true}).click();await writeStarted;
 try{assert.equal(await admin.getByLabel('Starter message',{exact:true}).isDisabled(),true,'Publishing must block newer edits until its response arrives');}finally{releaseWrite();}
 await admin.locator('.starter-notice').filter({hasText:'Shared starter updated.'}).waitFor();
 await admin.unroute('**/api/starters');
 await admin.getByRole('button',{name:'Edit starter Published welcome',exact:true}).click();
 await admin.getByLabel('Starter message',{exact:true}).fill('Draft discarded by explicit reload');
 let releaseReload;const reloadGate=new Promise(resolve=>{releaseReload=resolve;});
 await admin.route('**/api/starters',async route=>{const response=await route.fetch();await reloadGate;await route.fulfill({response});});
 const reloadStarted=admin.waitForRequest(request=>request.method()==='GET'&&request.url().endsWith('/api/starters'));
 await admin.getByRole('button',{name:'Reload catalogue',exact:true}).click();await reloadStarted;
 try{assert.equal(await admin.getByLabel('Starter message',{exact:true}).isDisabled(),true,'Reloading must block edits after its discard confirmation');}finally{releaseReload();}
 await admin.locator('.starter-notice').filter({hasText:'Catalogue reloaded.'}).waitFor();await admin.unroute('**/api/starters');
 catalogue=await(await fetch(origin+'/api/starters')).json();assert.equal(catalogue.templates.find(t=>t.webTemplateId===published.webTemplateId).message,'Updated public wording');
 assert.equal(await reader.getByLabel('Message text',{exact:true}).inputValue(),original,'A published edit must not overwrite a personal copy');
 await reader.getByRole('button',{name:'Browse starters',exact:true}).click();
 await reader.getByText('1 already-added templates hidden for this account.',{exact:true}).waitFor();
 assert.equal(await reader.getByRole('heading',{name:'Published welcome',exact:true}).count(),0);
 await reader.getByRole('button',{name:'Close dialog',exact:true}).click();
 await admin.getByRole('button',{name:'Remove starter Published welcome',exact:true}).click();
 await admin.locator('.starter-notice').filter({hasText:'Starter removed from the shared catalogue.'}).waitFor();
 catalogue=await(await fetch(origin+'/api/starters')).json();assert.equal(catalogue.templates.some(t=>t.webTemplateId===published.webTemplateId),false);
 assert.equal(await reader.getByLabel('Message text',{exact:true}).inputValue(),original);
 await admin.getByRole('tab',{name:'Starter emails',exact:true}).click();await admin.getByRole('button',{name:'Add starter',exact:true}).click();
 await admin.getByLabel('Starter name',{exact:true}).fill('Shared email');
 await admin.getByLabel('Starter subject',{exact:false}).fill('S'.repeat(38));assert.equal((await admin.getByLabel('Starter subject',{exact:false}).inputValue()).length,37);
 await admin.getByLabel('Starter body',{exact:false}).fill('B'.repeat(681));assert.equal((await admin.getByLabel('Starter body',{exact:false}).inputValue()).length,680);
 await admin.getByLabel('Starter subject',{exact:false}).fill('Welcome {name}');await admin.getByLabel('Starter body',{exact:false}).fill('Dear {name},\n\nWelcome!');
 await admin.getByRole('button',{name:'Publish starter',exact:true}).click();await admin.locator('.starter-notice').filter({hasText:'Starter published for everyone to use.'}).waitFor();
 await mkdir('browser-temp',{recursive:true});await admin.screenshot({path:'browser-temp/starter-manager.png',fullPage:true});
 await admin.setViewportSize({width:390,height:844});assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Starter manager fits a narrow screen');
 await admin.getByRole('button',{name:'Lock management',exact:true}).click();await admin.getByLabel('Starter-management password',{exact:true}).waitFor();
 assert.equal(await admin.evaluate(()=>localStorage.length),0);
 await admin.reload();await admin.getByRole('button',{name:'Starters',exact:true}).click();await admin.getByRole('button',{name:'Manage starters',exact:true}).click();
 await admin.getByLabel('Starter-management password',{exact:true}).waitFor();
 // Retry must serialize network operations after an initial listing failure.
 let failedOnce=false,retryCount=0,releaseRetry;
 const retryGate=new Promise(resolve=>{releaseRetry=resolve;});
 await reader.route('**/api/starters',async route=>{
  if(!failedOnce){failedOnce=true;return route.abort();}
  retryCount++;const response=await route.fetch();await retryGate;await route.fulfill({response});
 });
 await reader.getByRole('button',{name:'Starters',exact:true}).click();
 const retry=reader.getByRole('button',{name:'Retry loading starters',exact:true});await retry.waitFor();
 const retryStarted=reader.waitForRequest(request=>request.url().endsWith('/api/starters'));
 await retry.dblclick();await retryStarted;
 try{assert.equal(retryCount,1,'Concurrent retries must not produce late catalogue replacements');}finally{releaseRetry();}
 await reader.getByRole('button',{name:'Manage starters',exact:true}).waitFor();await reader.unroute('**/api/starters');
 await reader.getByRole('button',{name:'Close dialog',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('Starter manager passed: password unlock, public CRUD, stable identity, protected edits, character limits and independent personal copies.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
