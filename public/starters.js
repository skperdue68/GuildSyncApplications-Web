import {TEXT_LIMITS,characterCount,normalizeNewlines,constrainTextEdit,preview} from '/model.js';

// A management password is held only in this page's memory. It is never persisted.
let managementPassword='';
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
async function api(path,options){
 const response=await fetch(path,options);const result=await response.json();
 if(!response.ok)throw Object.assign(Error(result.error||'Unable to access shared starters.'),{status:response.status});
 return result;
}
const jsonRequest=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

export async function openStarterCatalogue({dialog,body,title,initialKind='message',canUse=()=>false,isAdded=()=>false,use,onStatus=()=>{}}){
 const root=element('section',undefined,'starter-studio');body.replaceChildren(root);title.textContent='Shared starters';if(!dialog.open)dialog.showModal();
 let catalogue,kind=initialKind,mode='browse',dirty=false,busy=false,notice='';
 const active=()=>dialog.open&&root.isConnected;
 function lockFields(scope){
  busy=true;const fields=[...scope.querySelectorAll('input,textarea,select')].map(field=>[field,field.disabled]);
  fields.forEach(([field])=>{field.disabled=true;});
  return ()=>{fields.forEach(([field,disabled])=>{field.disabled=disabled;});busy=false;};
 }
 function error(message){if(active()){const box=root.querySelector('[data-starter-error]');if(box)box.textContent=message;}}
 const action=handler=>async event=>{if(busy){if(event.type==='submit')event.preventDefault();return;}try{await handler(event);}catch(problem){error(problem.message);}};
 function button(text,handler,className){const node=element('button',text,className);node.type='button';node.addEventListener('click',action(handler));return node;}
 function discard(){return !dirty||confirm('Discard the unpublished starter edits?');}
 function closeGuard(event){if(active()&&event.target.closest?.('#close-dialog')&&!discard()){event.preventDefault();event.stopImmediatePropagation();}}
 function cancelGuard(event){if(active()&&!discard())event.preventDefault();}
 function unloadGuard(event){if(active()&&dirty){event.preventDefault();event.returnValue='';}}
 dialog.addEventListener('click',closeGuard,true);dialog.addEventListener('cancel',cancelGuard);window.addEventListener('beforeunload',unloadGuard);
 dialog.addEventListener('close',()=>{dialog.removeEventListener('click',closeGuard,true);dialog.removeEventListener('cancel',cancelGuard);window.removeEventListener('beforeunload',unloadGuard);},{once:true});
 function shell(){
  root.replaceChildren();
  const message=element('p',undefined,'dialog-error');message.dataset.starterError='';message.setAttribute('role','alert');
  root.append(message);
  if(notice){const note=element('p',notice,'starter-notice');note.setAttribute('role','status');root.append(note);}
 }
 async function refresh(){
  const next=await api('/api/starters');if(!active())return false;catalogue=next;return true;
 }
 async function reload(){
  if(!discard())return;const unlock=lockFields(root);
  try{if(await refresh()){dirty=false;if(mode==='edit')mode='manage';notice='Catalogue reloaded.';render();}}
  finally{unlock();}
 }
 function navigation(){
  const toolbar=element('div',undefined,'starter-tools');
  toolbar.append(button('Browse starters',()=>{if(!discard())return;dirty=false;mode='browse';notice='';render();}));
  if(mode!=='browse'&&managementPassword)toolbar.append(button('Lock management',()=>{if(!discard())return;managementPassword='';dirty=false;notice='Management locked.';mode='manage';render();}));
  else if(mode==='browse')toolbar.append(button('Manage starters',()=>{mode='manage';notice='';render();}));
  toolbar.append(button('Reload catalogue',reload));root.append(toolbar);
 }
 function tabs(){
  const tabs=element('div',undefined,'tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Starter category');
  for(const [value,text] of [['message','Starter chat'],['email','Starter emails']]){
   const tab=button(text,()=>{kind=value;notice='';render();});tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(kind===value));tabs.append(tab);
  }
  root.append(tabs);
 }
 function render(){
  if(!active())return;shell();navigation();
  if(mode==='manage'&&!catalogue.managementEnabled){root.append(element('p','Starter management is not enabled on this server. Set STARTER_MANAGEMENT_PASSWORD in the server configuration and restart the service. Public starters remain available.'));return;}
  if(mode==='manage'&&!managementPassword){renderLogin();return;}
  tabs();
  if(mode==='manage')root.append(button('Add starter',()=>renderEditor(null),'gold'));
  else root.append(element('p',canUse()?'Copy a starter into your current account, then make it your own. Templates already added are hidden.':'Anyone can browse these shared templates. Open or create a file to use one in your account.'));
  const all=catalogue.templates.filter(template=>template.kind===kind),available=mode==='manage'?all:all.filter(template=>!canUse()||!isAdded(kind,template));
  const list=element('div');list.id='starter-list';root.append(list);
  if(mode==='browse'&&canUse())list.append(element('p',`${all.length-available.length} already-added templates hidden for this account.`,'hint'));
  if(!available.length)list.append(element('p',all.length&&mode==='browse'?'All starter templates in this category have already been added to this account.':'No published starters in this category yet.'));
  for(const template of available){
   const card=element('article',undefined,'starter');card.append(element('h3',template.title),element('p',template.message||template.subject+'\n\n'+template.body));
   const actions=element('div',undefined,'starter-tools');card.append(actions);
   if(mode==='manage'){
    actions.append(button('Edit starter',()=>renderEditor(template)),button('Remove starter',async()=>{
     if(!confirm(`Remove "${template.title}" from shared starters? Copies already added to personal files stay saved.`))return;
     busy=true;
     try{const next=await api('/api/starters/'+encodeURIComponent(template.webTemplateId),jsonRequest('DELETE',{password:managementPassword,revision:catalogue.revision}));if(active()){catalogue=next;notice='Starter removed from the shared catalogue.';render();}}
     finally{busy=false;}
    },'danger'));
    actions.firstElementChild.setAttribute('aria-label','Edit starter '+template.title);actions.lastElementChild.setAttribute('aria-label','Remove starter '+template.title);
   }else{
    const choose=button('Use this starter',()=>{if(!active()||!canUse())return;use(kind,template);});choose.disabled=!canUse();actions.append(choose);
   }
   list.append(card);
  }
 }
 function renderLogin(){
  root.append(element('p','Enter the starter-management password to publish, edit, or remove shared templates. The optional passwords on saved Lua files are separate.'));
  const form=element('form'),label=element('label','Starter-management password'),input=element('input');input.type='password';input.autocomplete='off';input.required=true;input.maxLength=1024;label.append(input);
  const submit=element('button','Unlock management','gold');submit.type='submit';form.append(label,submit);root.append(form);
  form.addEventListener('submit',action(async event=>{
   event.preventDefault();const password=input.value,unlock=lockFields(form);submit.disabled=true;
   try{await api('/api/starters/session',jsonRequest('POST',{password}));if(active()){managementPassword=password;input.value='';notice='Starter management unlocked for this page.';render();}}
   finally{unlock();submit.disabled=false;}
  }));
 }
 function renderEditor(existing){
  if(!active())return;mode='edit';dirty=false;notice='';shell();navigation();
  const draft={kind:existing?.kind||kind,title:existing?.title||'',message:existing?.message||'',subject:existing?.subject||'',body:existing?.body||''};
  const form=element('form',undefined,'starter-editor');form.id='starter-edit-form';
  const heading=element('h3',existing?'Edit shared starter':'Publish a new starter');root.append(heading,element('p','Publishing updates the shared catalogue. Copies people already added to their own accounts stay as they are.'));
  const categoryLabel=element('label','Starter category'),category=element('select');
  for(const [value,text] of [['message','Welcome chat'],['email','Welcome email']]){const option=element('option',text);option.value=value;category.append(option);}category.value=draft.kind;category.disabled=!!existing;categoryLabel.append(category);
  const nameLabel=element('label','Starter name'),name=element('input');name.value=draft.title;name.required=true;nameLabel.append(name);
  const subjectLabel=element('label','Starter subject'),subject=element('input'),subjectCount=element('output');subject.value=draft.subject;subjectLabel.append(subject,subjectCount);
  const contentLabel=element('label'),contentText=element('span'),content=element('textarea'),contentCount=element('output');content.rows=7;content.required=true;contentLabel.append(contentText,content,contentCount);
  let tokenField='content';subject.addEventListener('focus',()=>{tokenField='subject';});content.addEventListener('focus',()=>{tokenField='content';});
  const token=button('+ {name}',()=>{
   const target=tokenField==='subject'&&draft.kind==='email'?subject:content,limit=target===subject?TEXT_LIMITS.subject:draft.kind==='message'?TEXT_LIMITS.message:TEXT_LIMITS.body;
   const candidate=target.value.slice(0,target.selectionStart)+'{name}'+target.value.slice(target.selectionEnd);
   if(characterCount(candidate)>limit){error('There is not enough room for the complete {name} token.');return;}
   target.setRangeText('{name}',target.selectionStart,target.selectionEnd,'end');target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();
  },'token');
  const previewBox=element('div',undefined,'starter-preview');previewBox.setAttribute('aria-label','Starter preview');
  const actions=element('div',undefined,'starter-tools'),save=element('button',existing?'Save starter':'Publish starter','gold');save.type='submit';actions.append(save,button('Cancel editing',()=>{if(!discard())return;dirty=false;mode='manage';render();}));
  form.append(categoryLabel,nameLabel,subjectLabel,contentLabel,token,previewBox,actions);root.append(form);
  function update(){
   subjectLabel.hidden=draft.kind==='message';subject.required=draft.kind==='email';contentText.textContent=draft.kind==='message'?'Starter message':'Starter body';
   content.setAttribute('aria-label',draft.kind==='message'?'Starter message':'Starter body');
   subjectCount.textContent=`${characterCount(subject.value)} / ${TEXT_LIMITS.subject} characters`;
   contentCount.textContent=`${characterCount(content.value)} / ${draft.kind==='message'?TEXT_LIMITS.message:TEXT_LIMITS.body} characters`;
   previewBox.textContent=(draft.kind==='email'?preview(subject.value,'@NewMember')+'\n\n':'')+preview(content.value,'@NewMember');
  }
  function limitInput(field,max){
   let previous=field.value;
   field.addEventListener('input',()=>{const next=constrainTextEdit(previous,field.value,max());if(field.value!==next){const position=field.selectionStart;field.value=next;field.setSelectionRange(Math.min(position,next.length),Math.min(position,next.length));}previous=next;dirty=true;update();});
   return ()=>{previous=field.value;};
  }
  const rememberContent=limitInput(content,()=>draft.kind==='message'?TEXT_LIMITS.message:TEXT_LIMITS.body);limitInput(subject,()=>TEXT_LIMITS.subject);limitInput(name,()=>120);
  category.addEventListener('change',()=>{draft[draft.kind==='message'?'message':'body']=content.value;draft.kind=category.value;content.value=draft[draft.kind==='message'?'message':'body'];rememberContent();dirty=true;update();});
  content.value=draft.kind==='message'?draft.message:draft.body;rememberContent();update();
  form.addEventListener('submit',action(async event=>{
   event.preventDefault();const template={kind:draft.kind,title:name.value,...(existing?{webTemplateId:existing.webTemplateId}:{}),...(draft.kind==='message'?{message:normalizeNewlines(content.value)}:{subject:normalizeNewlines(subject.value),body:normalizeNewlines(content.value)})};
   const unlock=lockFields(form);save.disabled=true;
   try{const next=await api('/api/starters',jsonRequest('POST',{password:managementPassword,revision:catalogue.revision,template}));if(active()){catalogue=next;kind=draft.kind;dirty=false;mode='manage';notice=existing?'Shared starter updated.':'Starter published for everyone to use.';onStatus(notice);render();}}
   finally{unlock();save.disabled=false;}
  }));
 }
 root.append(element('p','Loading shared starters…'));
 try{if(await refresh())render();}catch(problem){if(active()){shell();error(problem.message);root.append(button('Retry loading starters',reload));}}
}
