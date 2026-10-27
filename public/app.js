import {parseSavedVariables} from '/lua-data.js';
import {profiles,entries,validateEntry,updateEntry,addEntry,removeEntry,newDocument,exportDocument,byteLength,preview} from '/model.js';
import {starterTemplates} from '/defaults.js';

const $=id=>document.getElementById(id);
const state={doc:null,profiles:[],profile:0,kind:'message',selected:undefined,draftDirty:false,changed:false};
let lastField='content';
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function run(action){return async event=>{try{await action(event);}catch(error){status(error.message,true);const box=$('dialog-error');if(box)box.textContent=error.message;}};}
function bind(id,event,action){$(id).addEventListener(event,run(action));}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
const current=()=>state.profiles[state.profile];
const list=()=>entries(current(),state.kind);
function updateState(){
 $('file-state').textContent=state.changed?'Changes in this session':'No unsaved file changes';
 $('draft-state').textContent=state.draftDirty?'Unapplied changes':'Applied';
}
function values(){return {title:$('title').value,enabled:$('enabled').checked,...(state.kind==='message'?{message:$('content').value}:{subject:$('subject').value,body:$('content').value})};}
function applyDraft(){
 if(!state.doc || state.selected===undefined || !state.draftDirty)return;
 const v=values();validateEntry(state.kind,v);
 if(state.selected===null){addEntry(current(),state.kind,v);state.selected=list().at(-1).key;}
 else updateEntry(current(),state.kind,state.selected,v);
 state.draftDirty=false;state.changed=true;renderList();updateState();
}
function canReplace(){return !(state.changed||state.draftDirty)||confirm('Replace the current workspace? Download or save any changes you want to keep first.');}
function loadDocument(doc,source){
 const found=profiles(doc);if(!found.length)throw Error('No account-wide profiles found. Choose SavedVariables/GuildSyncApplications.lua, not the addon source file.');
 // Check list shapes before replacing anything; incomplete text remains editable.
 for(const p of found)for(const kind of ['message','email'])entries(p,kind);
 state.doc=doc;state.profiles=found;state.profile=0;state.kind='message';state.selected=undefined;state.draftDirty=false;state.changed=false;
 $('account').replaceChildren(...found.map((p,i)=>{const option=el('option',p.label);option.value=i;return option;}));
 $('landing').hidden=true;$('workspace').hidden=false;$('search').value='';render();
 status(`${source} · Editing stays in your browser. Apply changes before saving or downloading.`);
}
function renderList(){
 const chat=entries(current(),'message'),email=entries(current(),'email');
 $('chat-count').textContent=chat.length;$('email-count').textContent=email.length;$('total-count').textContent=chat.length+email.length;
 $('tab-message').setAttribute('aria-selected',String(state.kind==='message'));$('tab-email').setAttribute('aria-selected',String(state.kind==='email'));
 $('add').textContent=state.kind==='message'?'+ New message':'+ New email';
 const query=$('search').value.toLowerCase();const items=list().filter(({entry})=>[entry.title,entry.message,entry.subject,entry.body].some(v=>String(v||'').toLowerCase().includes(query)));
 const nodes=items.map(({key,entry})=>{
  const button=el('button',undefined,'template-item'+(key===state.selected?' active':''));button.type='button';button.setAttribute('aria-pressed',String(key===state.selected));
  const dot=el('span',undefined,'dot'+(entry.enabled===false?' off':''));dot.setAttribute('aria-hidden','true');
  const copy=el('span',undefined,'item-copy');copy.append(el('strong',entry.title||`Welcome ${state.kind} ${entry.id||key}`),el('small',(entry.enabled===false?'Disabled · ':'')+(entry.message||entry.subject||'')));
  button.append(dot,copy);button.addEventListener('click',run(()=>{applyDraft();state.selected=key;render();}));return button;
 });
 if(!nodes.length)nodes.push(el('p',query?'No templates match your search.':`No welcome ${state.kind==='message'?'messages':'emails'} yet. Create one or browse starter templates.`,'empty-list'));
 $('template-list').replaceChildren(...nodes);
}
function render(){
 const items=list();if(state.selected===undefined && items.length)state.selected=items[0].key;
 renderList();const item=items.find(x=>x.key===state.selected)?.entry;
 const show=state.selected===null||!!item;$('editor').hidden=!show;$('editor-empty').hidden=show;
 if(show){
  const v=item||{};$('title').value=v.title||'';$('content').value=(state.kind==='message'?v.message:v.body)||'';$('subject').value=v.subject||'';$('enabled').checked=v.enabled!==false;
  $('editor-kind').textContent=state.kind==='message'?'WELCOME CHAT':'WELCOME EMAIL';$('editor-heading').textContent=state.selected===null?'Create your welcome':'Edit your welcome';
  $('content-label').textContent=state.kind==='message'?'Message text':'Email body';$('subject-label').hidden=state.kind==='message';
  $('duplicate').disabled=!item;$('delete').disabled=!item;
 }
 updateState();renderPreview();
}
function renderPreview(){
 const show=!$('editor').hidden,v=show?values():{},text=state.kind==='message'?v.message:v.body;
 const expanded=preview(text,$('preview-name').value);const bytes=byteLength(text||'');
 $('preview-channel').textContent=state.kind==='message'?'GUILD CHAT · ALPHABET MAFIA':'IN-GAME MAIL · WELCOME LETTER';
 $('preview-content').textContent=show?expanded:'Your welcome will appear here.';
 $('preview-subject').hidden=state.kind==='message'||!show;$('preview-subject').textContent=preview(v.subject,$('preview-name').value);
 $('length').textContent=state.kind==='message'?`${bytes} / 335 bytes`:`${[...(text||'')].length} characters`;
 $('length').classList.toggle('over-limit',state.kind==='message'&&bytes>335);
 const tooLong=state.kind==='message'&&byteLength(expanded)>335;
 $('preview-warning').textContent=tooLong?'This preview exceeds 335 bytes after name substitution. Leave extra room for longer account names.':'Preview only. Messages are sent by the add-on inside ESO.';
 $('preview-warning').classList.toggle('over-limit',tooLong);
}
function showDialog(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;$('dialog').showModal();}
const dialogError='<p id="dialog-error" class="dialog-error" role="alert"></p>';
function help(){showDialog('From your browser to your guild',`<p>This editor changes welcome chat messages and in-game emails for GuildSyncApplications. It does not send messages or connect to ESO.</p><ol><li>Use your newest <code>GuildSyncApplications.lua</code> from <code>Documents/Elder Scrolls Online/live/SavedVariables</code>. The add-on’s source file has the same name; choose the one in SavedVariables.</li><li>Select your ESO account. Edit or create templates, then choose <b>Apply changes</b>. Use <code>{name}</code> for the applicant’s ESO account name.</li><li><b>Save to server</b> stores a complete copy in the shared library. Everyone using this site can load it, including account names and application records.</li><li><b>Download Lua</b> creates an updated <code>GuildSyncApplications.lua</code>. Close ESO, back up your original SavedVariables file, then replace it with the download. Check that the browser did not add a number to its filename.</li></ol><p>Always start from the latest file after playing ESO: downloading an older workspace can replace newer application records and usage history. A new file is best for a fresh install; open an existing file to preserve its records.</p><p>Compatible with GuildSyncApplications 1.4.3 settings. Existing message and email pools remain separate; enabled entries are available to the add-on.</p>`);}
bind('help','click',help);bind('install-help','click',help);bind('close-dialog','click',()=>$('dialog').close());
bind('open','change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 if(file.size>20*1024*1024)throw Error('Choose a Lua file smaller than 20 MiB.');
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}
 catch{throw Error('This file contains invalid UTF-8 bytes. Keep the original; the editor cannot safely import it without changing those bytes.');}
 const doc=parseSavedVariables(text);if(canReplace())loadDocument(doc,`Opened ${file.name}`);
});
document.querySelector('label.button').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('open').click();}});
bind('open-another','click',()=>$('open').click());
bind('load-server','click',()=>$('library').click());
bind('new','click',()=>{
 if(!canReplace())return;
 showDialog('Start a new welcome file',`<p>For a fresh setup, enter the ESO account that will use these templates. To keep existing application records and settings, open your current SavedVariables instead.</p><form id="new-form"><label>ESO account name<input id="new-account" placeholder="@YourAccount" required autocomplete="off"></label>${dialogError}<button class="gold">Create file</button></form>`);
 $('new-form').addEventListener('submit',run(event=>{event.preventDefault();loadDocument(newDocument($('new-account').value),'Created a new file');state.changed=true;updateState();$('dialog').close();}));
});
bind('sample','click',()=>{
 if(!canReplace())return;const doc=newDocument('@ExampleAccount'),p=profiles(doc)[0];
 for(const kind of ['message','email'])for(const template of starterTemplates[kind])addEntry(p,kind,{...template,enabled:true});
 loadDocument(doc,'Sample workspace · Example account only');
});
bind('account','change',event=>{
 const index=Number(event.target.value);
 try{applyDraft();state.profile=index;state.selected=undefined;$('search').value='';render();}catch(error){event.target.value=state.profile;throw error;}
});
for(const kind of ['message','email'])bind('tab-'+kind,'click',()=>{applyDraft();state.kind=kind;state.selected=undefined;$('search').value='';render();});
bind('search','input',renderList);
bind('add','click',()=>{applyDraft();state.selected=null;state.draftDirty=true;render();$('title').focus();});
for(const id of ['title','content','subject','enabled'])bind(id,'input',()=>{state.draftDirty=true;updateState();renderPreview();});
for(const id of ['content','subject'])bind(id,'focus',()=>{lastField=id;});
bind('preview-name','input',renderPreview);
bind('insert-name','click',()=>{
 const field=$(lastField==='subject'&&state.kind==='email'?'subject':'content');
 field.setRangeText('{name}',field.selectionStart,field.selectionEnd,'end');field.focus();state.draftDirty=true;updateState();renderPreview();
});
bind('editor','submit',event=>{event.preventDefault();applyDraft();status('Changes applied. Save to server or download Lua to keep this version.');});
bind('discard','click',()=>{state.draftDirty=false;if(state.selected===null)state.selected=undefined;render();status('Draft discarded. Applied templates are unchanged.');});
bind('duplicate','click',()=>{applyDraft();const v=values();addEntry(current(),state.kind,{...v,title:(v.title||'Welcome')+' — copy'});state.selected=list().at(-1).key;state.changed=true;render();status('Template duplicated with a new ID and fresh usage history.');});
bind('delete','click',()=>{
 if(!confirm('Delete this welcome template? This removes it from the current workspace.'))return;
 removeEntry(current(),state.kind,state.selected);state.selected=undefined;state.draftDirty=false;state.changed=true;render();status('Template deleted. Save or download to keep the change.');
});
bind('starters','click',()=>{
 applyDraft();showDialog('A little inspiration',`<p>Optional Alphabet Mafia starters from the add-on. Add a copy to your current account and make it your own. Existing templates stay as they are.</p><div id="starter-list"></div>${dialogError}`);
 for(const template of starterTemplates[state.kind]){
  const card=el('article',undefined,'starter');card.append(el('h3',template.title),el('p',template.message||template.subject+'\n\n'+template.body));
  const button=el('button','Use this starter');button.addEventListener('click',run(()=>{addEntry(current(),state.kind,{...template,enabled:true});state.selected=list().at(-1).key;state.changed=true;render();$('dialog').close();status('Starter added. Edit the wording to make it your own.');}));card.append(button);$('starter-list').append(card);
 }
});
bind('download','click',()=>{
 applyDraft();const lua=exportDocument(state.doc),url=URL.createObjectURL(new Blob([lua],{type:'text/plain;charset=utf-8'}));
 const a=el('a');a.href=url;a.download='GuildSyncApplications.lua';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 state.changed=false;updateState();status('Downloaded GuildSyncApplications.lua. Close ESO and back up your original before replacing SavedVariables.');
});
async function request(path,options){const response=await fetch(path,options);if(!response.ok){let message;try{message=(await response.json()).error;}catch{}throw Error(message||'Unable to reach the shared server library.');}return response;}
bind('save-server','click',()=>{
 applyDraft();exportDocument(state.doc);
 showDialog('Save a shared copy',`<p>Everyone using this site can load this complete file, including account names, application records and usage history. Use a unique name for each revision. Existing saves are never overwritten.</p><form id="save-form"><label>Save name<input id="save-name" maxlength="120" placeholder="Apollonia · Welcome messages · Oct 27" required></label><label class="check"><input id="shared-consent" type="checkbox" required><span>I understand this file is shared</span></label>${dialogError}<button id="confirm-save" class="gold">Save shared copy</button></form>`);
 $('save-form').addEventListener('submit',run(async event=>{
  event.preventDefault();const form=event.currentTarget,button=$('confirm-save'),savedDocument=state.doc,lua=exportDocument(state.doc),name=$('save-name').value;button.disabled=true;
  try{
   await request('/api/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,lua})});
   const unchanged=state.doc===savedDocument&&!state.draftDirty&&exportDocument(state.doc)===lua;
   if(unchanged)state.changed=false;
   updateState();if($('save-form')===form)$('dialog').close();
   status(unchanged?'Saved to server. Your named copy is now available in the shared library.':'Saved the submitted version to server. Your newer workspace changes still need saving or downloading.');
  }
  finally{button.disabled=false;}
 }));
});
bind('library','click',async()=>{
 showDialog('Shared server library','<p>Loading saved files…</p>');
 const loadingNode=$('dialog-body').firstElementChild;
 const data=await (await request('/api/library')).json();
 if(!$('dialog').open||$('dialog-body').firstElementChild!==loadingNode)return;
 $('dialog-body').replaceChildren(el('p','Complete configurations shared by this site’s users. Loading a copy opens it in your browser; the saved version stays unchanged.'));
 if(!data.files.length)$('dialog-body').append(el('p','No shared files yet. Open or create a file, then choose Save to server.'));
 for(const file of data.files){
  const row=el('div',undefined,'library-row'),copy=el('div');copy.append(el('strong',file.name),el('small',new Date(file.createdAt).toLocaleString()+' · '+Math.ceil(file.bytes/1024)+' KB'));
  const button=el('button','Load');button.setAttribute('aria-label','Load '+file.name);button.addEventListener('click',run(async()=>{
   button.disabled=true;
   try{
    const text=await(await request('/api/library/'+file.id)).text();
    if(!$('dialog').open||!button.isConnected)return;
    if(!canReplace())return;
    loadDocument(parseSavedVariables(text),'Loaded '+file.name);$('dialog').close();
   }finally{button.disabled=false;}
  }));row.append(copy,button);$('dialog-body').append(row);
 }
 $('dialog-body').append(el('p','Shared copies include complete account data. Download and install while ESO is closed.'));
});
window.addEventListener('beforeunload',event=>{if(state.changed||state.draftDirty){event.preventDefault();event.returnValue='';}});
