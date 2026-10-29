/* Santrelle • Prévia da Área do Cliente
 * AVISO: versão local de design, sem autenticação, upload ou publicação de arquivos.
 * Nunca exibir prazos, cronograma interno, responsáveis ou subetapas no portal.
 * A verdadeira área compartilhada depende de backend seguro, autorização e armazenamento privado.
 */
const PORTAL_PREVIEW_STORAGE = 'santrelle_portal_preview_v1';
const PORTAL_STAGE_TEMPLATES = [
 {id:'estudo',name:'Estudo preliminar'},
 {id:'ante',name:'Anteprojeto'},
 {id:'executivo',name:'Executivo'},
 {id:'obra',name:'Obra'},
 {id:'posobra',name:'Pós-obra'}
];
/* Revisões do estudo são opcionais e precisam de liberação individual.
   Pedidos fica no Anteprojeto; Notas fiscais fica no Pós-obra, ambos
   facilmente reorganizáveis no painel interno. */
const PORTAL_FOLDER_TEMPLATES = [
 {id:'estudo-plantas',name:'Plantas e apresentações',icon:'presentation',stageId:'estudo'},
 {id:'estudo-revisao-1',name:'Revisão 1',icon:'folder',stageId:'estudo',revision:true,revisionReleased:false},
 {id:'estudo-revisao-2',name:'Revisão 2',icon:'folder',stageId:'estudo',revision:true,revisionReleased:false},
 {id:'estudo-revisao-3',name:'Revisão 3',icon:'folder',stageId:'estudo',revision:true,revisionReleased:false},
 {id:'ante-planilha',name:'Planilha',icon:'calculator',stageId:'ante'},
 {id:'ante-orcamentos',name:'Orçamentos',icon:'calculator',stageId:'ante'},
 {id:'ante-apresentacao',name:'Apresentação',icon:'presentation',stageId:'ante'},
 {id:'ante-pedido',name:'Pedido',icon:'clipboard',stageId:'ante'},
 {id:'executivo-projetos',name:'Projetos',icon:'folder',stageId:'executivo'},
 {id:'obra-relatorio',name:'Relatório',icon:'clipboard',stageId:'obra'},
 {id:'obra-cronograma',name:'Cronograma',icon:'calculator',stageId:'obra'},
 {id:'posobra-relatorio',name:'Relatório',icon:'clipboard',stageId:'posobra'},
 {id:'posobra-notas',name:'Notas fiscais',icon:'folder',stageId:'posobra'}
];
let portalPreviewData={};
try{
 const raw=JSON.parse(localStorage.getItem(PORTAL_PREVIEW_STORAGE)||'{}');
 if(raw && typeof raw==='object' && !Array.isArray(raw))portalPreviewData=raw;
}catch(err){console.warn('Preferências do portal não carregadas:',err)}
let portalProjectId=null;
let portalView='manager';
let portalFolderId=null;
let portalEditingMeeting=null;
let portalEditingDocument=null;
function portalId(){return String(Date.now())+'-'+Math.random().toString(36).slice(2,9)}
function portalProject(id){return projects.find(p=>String(p.id)===String(id))||null}
function portalPrefs(id){
 const key=String(id);
 if(!portalPreviewData[key]||typeof portalPreviewData[key]!=='object'){
  portalPreviewData[key]={
   schemaVersion:2,stage:'',
   stages:PORTAL_STAGE_TEMPLATES.map(x=>({...x,released:false})),
   folders:PORTAL_FOLDER_TEMPLATES.map(x=>({...x})),
   meetings:[],documents:[]
  };
  portalSave()
 }
 const p=portalPreviewData[key];
 if(!Array.isArray(p.meetings))p.meetings=[];
 if(!Array.isArray(p.documents))p.documents=[];
 if(typeof p.stage!=='string')p.stage='';
 /* Migra a prévia anterior sem perder títulos ou configurações. Nenhuma etapa
    antiga é aberta automaticamente ao cliente. */
 if(p.schemaVersion!==2||!Array.isArray(p.stages)||!p.folders?.every(f=>f.stageId)){
  const oldFolders=Array.isArray(p.folders)?p.folders:[];
  const moves={apresentacoes:'estudo-plantas',orcamentos:'ante-orcamentos',
   relatorios:'obra-relatorio',documentos:'antigo-documentos'};
  const nextFolders=PORTAL_FOLDER_TEMPLATES.map(x=>({...x}));
  for(const old of oldFolders){
   const targetId=moves[String(old.id)]||String(old.id);
   const existing=nextFolders.find(x=>x.id===targetId);
   if(existing){
    if(old.icon)existing.icon=old.icon;
   }else{
    nextFolders.push({...old,id:targetId,stageId:old.stageId||'posobra',
     icon:old.icon||'folder',revision:false});
   }
  }
  for(const doc of p.documents){
   if(doc.folderId in moves)doc.folderId=moves[doc.folderId];
   if(!nextFolders.some(x=>String(x.id)===String(doc.folderId))){
    nextFolders.push({id:String(doc.folderId),name:'Pasta recuperada',icon:'folder',stageId:'posobra'});
   }
  }
  p.stages=PORTAL_STAGE_TEMPLATES.map(x=>({...x,released:false}));
  p.folders=nextFolders;
  p.schemaVersion=2;
  portalSave()
 }
 return p
}

/* Porta de acesso da prévia: documento, pasta e etapa precisam estar liberados.
   As verificações serão replicadas nas regras do servidor antes do portal real. */
function portalStageFor(cfg,id){return cfg.stages.find(s=>String(s.id)===String(id))}
function portalFolderFor(cfg,id){return cfg.folders.find(f=>String(f.id)===String(id))}
function portalIsFolderReleased(cfg,folder){
 if(!folder)return false;
 const stage=portalStageFor(cfg,folder.stageId);
 return stage?.released===true && (!folder.revision || folder.revisionReleased===true)
}
function portalIsDocumentReleased(cfg,doc){
 if(doc?.visible!==true)return false;
 return portalIsFolderReleased(cfg,portalFolderFor(cfg,doc.folderId))
}
function portalReleasedDocumentCount(cfg){
 return cfg.documents.filter(d=>portalIsDocumentReleased(cfg,d)).length
}
function portalStageToggle(stageId,released){
 const cfg=portalPrefs(portalProjectId);
 const stage=portalStageFor(cfg,stageId);if(!stage)return;
 if(stage.released===released)return;
 if(released){
  if(!confirm('Liberar a etapa "'+stage.name+'" para o cliente? As pastas desta etapa ficarão disponíveis na prévia, exceto revisões ainda não liberadas.'))return
 }else if(!confirm('Ocultar a etapa "'+stage.name+'" do cliente? As pastas e os documentos dela deixarão de aparecer na prévia, sem serem excluídos.'))return;
 stage.released=!!released;
 portalFolderId=null;
 portalSave();render()
}
function portalRevisionToggle(folderId,released){
 const cfg=portalPrefs(portalProjectId),folder=portalFolderFor(cfg,folderId);
 if(!folder?.revision)return;
 if(folder.revisionReleased===released)return;
 if(released&&!confirm('Liberar a pasta "'+folder.name+'"? Ela aparecerá ao cliente somente enquanto Estudo preliminar estiver liberado.')){render();return}
 folder.revisionReleased=!!released;
 portalFolderId=null;
 portalSave();render()
}
function portalFolderMove(id,stageId){
 const cfg=portalPrefs(portalProjectId),f=portalFolderFor(cfg,id);
 if(!f||!portalStageFor(cfg,stageId)||f.revision)return;
 if(f.stageId===stageId)return;
 if(!confirm('Mover a pasta "'+f.name+'" para a etapa "'+portalStageFor(cfg,stageId).name+'"? Ela só aparecerá quando a nova etapa estiver liberada.')){render();return}
 f.stageId=stageId;portalFolderId=null;
 portalSave();render()
}
function portalStageOptions(cfg,current){
 return cfg.stages.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===current?' selected':'')+'>'+esc(s.name)+'</option>').join('')
}
function portalSave(){
 try{localStorage.setItem(PORTAL_PREVIEW_STORAGE,JSON.stringify(portalPreviewData));return true}
 catch(err){alert('Não foi possível salvar as alterações da prévia neste navegador: '+err.message);return false}
}
function portalToday(){
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
function portalIsFuture(meeting){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(meeting?.date||'')||!/^\d{2}:\d{2}$/.test(meeting?.time||''))return false;
 const when=new Date(meeting.date+'T'+meeting.time+':00');
 return !Number.isNaN(when.getTime()) && when.getTime()>=Date.now()
}
function portalUpcoming(settings){
 return settings.meetings.filter(m=>m.visible===true&&portalIsFuture(m))
 .sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time))
}
function portalDate(value){
 return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'—'
}
function portalSafeAction(value){return esc(JSON.stringify(String(value)))}
function portalFolderIcon(id){
 const known={presentation:'▣',calculator:'▤',clipboard:'▧',folder:'▱'};
 return known[id]||'▱'
}
function portalSetPage(){
 page='portal';selected=null;teamSelectedOwner=null;
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='portal'))
}
function portalOpen(id){
 if(!portalProject(id))return;
 portalProjectId=String(id);portalView='manager';portalFolderId=null;
 portalEditingMeeting=null;portalEditingDocument=null;
 portalSetPage();render();
 if(typeof window!=='undefined'&&typeof window.scrollTo==='function')window.scrollTo(0,0)
}
function portalOpenPreview(id){
 if(!portalProject(id))return;
 portalProjectId=String(id);portalView='preview';portalFolderId=null;
 portalSetPage();render();
 if(typeof window!=='undefined'&&typeof window.scrollTo==='function')window.scrollTo(0,0)
}
function portalGoManager(){
 portalView='manager';portalFolderId=null;
 document.body.classList.remove('portal-is-preview');
 render()
}
function portalBack(){
 portalProjectId=null;portalView='manager';portalFolderId=null;
 portalEditingMeeting=null;portalEditingDocument=null;
 document.body.classList.remove('portal-is-preview');
 render()
}
function portalProjectShortcut(project){
 const cfg=portalPreviewData[String(project.id)];
 const count=(cfg?.documents||[]).filter(x=>x.visible).length;
 return '<div class="client-portal-shortcut"><div><strong>Área do Cliente</strong><p>Organize as pastas, as próximas reuniões e a etapa exibida. '+count+' documento'+(count===1?'':'s')+' de demonstração '+(count===1?'visível':'visíveis')+'.</p></div>'
 +'<div class="client-portal-shortcut-actions"><button class="secondary" type="button" onclick="portalOpen('+portalSafeAction(project.id)+')">Configurar portal</button>'
 +'<button class="primary" type="button" onclick="portalOpenPreview('+portalSafeAction(project.id)+')">Prévia do cliente</button></div></div>'
}
function portalProjectList(){
 const sorted=projects.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
 const card=p=>{const cfg=portalPrefs(p.id),meetings=portalUpcoming(cfg).length,docs=portalReleasedDocumentCount(cfg);
  return '<div class="client-portal-project"><div class="client-portal-project-text"><strong>'+esc(p.name||'Projeto sem nome')+'</strong><span>'+esc(p.client||p.clientRegistration?.name||'Cliente')+'</span></div>'
   +'<div class="client-portal-project-meta">'+docs+' documento'+(docs===1?'':'s')+' · '+meetings+' reunião'+(meetings===1?'':'ões')+' agendada'+(meetings===1?'':'s')+'</div>'
   +'<div class="client-portal-project-actions"><button class="secondary" onclick="portalOpen('+portalSafeAction(p.id)+')">Configurar</button>'
   +'<button class="primary" onclick="portalOpenPreview('+portalSafeAction(p.id)+')">Ver como cliente</button></div></div>'};
 return '<div class="client-portal-admin"><section class="panel"><div class="client-portal-head"><div><span class="client-portal-eyebrow">SANTRELLE · ACESSO INTERNO</span><h2>Área do Cliente</h2><p class="muted">Defina como cada cliente encontrará os documentos e as reuniões do projeto. Os prazos internos não são compartilhados.</p></div><span class="client-portal-demo-pill">Protótipo local</span></div>'
 +'<div class="client-portal-alert"><strong>Prévia para aprovação das telas</strong><p>Os dados desta seção ficam somente neste navegador. Ainda não existe login do cliente, upload seguro de documentos ou compartilhamento online. Use nomes fictícios ou demonstrativos até ativarmos a proteção.</p></div></section>'
 +'<section class="panel"><h3>Escolha um projeto</h3>'+(sorted.length?'<div class="client-portal-projects">'+sorted.map(card).join('')+'</div>':'<div class="client-portal-empty">Nenhum projeto cadastrado. Cadastre um projeto para configurar a prévia da Área do Cliente.</div>')+'</section></div>'
}
function portalFolderOptions(settings,current){
 return settings.stages.map(stage=>{
  const items=settings.folders.filter(f=>f.stageId===stage.id);
  if(!items.length)return '';
  return '<optgroup label="'+esc(stage.name)+'">'+items.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===current?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</optgroup>'
 }).join('')
}
function portalStageSave(){
 const cfg=portalPrefs(portalProjectId),raw=String(document.getElementById('portalStageName')?.value||'').trim();
 if(raw.length>80){alert('O nome da etapa deve ter até 80 caracteres.');return}
 cfg.stage=raw;portalSave();render()
}
function portalMeetingSubmit(event){
 event?.preventDefault?.();
 const cfg=portalPrefs(portalProjectId),value=id=>String(document.getElementById(id)?.value||'').trim();
 const subject=value('portalMeetingSubject'),date=value('portalMeetingDate'),time=value('portalMeetingTime'),place=value('portalMeetingPlace');
 const visible=document.getElementById('portalMeetingVisible')?.checked===true;
 if(!subject||!date||!time){alert('Preencha o assunto, a data e o horário da reunião.');return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||Number.isNaN(new Date(date+'T'+time+':00').getTime())){alert('Informe uma data e horário válidos.');return}
 const old=cfg.meetings.find(m=>String(m.id)===String(portalEditingMeeting));
 if(!old&&new Date(date+'T'+time+':00').getTime()<Date.now()){
  alert('Cadastre uma reunião futura. Reuniões passadas não aparecem na Área do Cliente.');return
 }
 if(old){Object.assign(old,{subject,date,time,place,visible})}
 else cfg.meetings.push({id:portalId(),subject,date,time,place,visible,createdAt:new Date().toISOString()});
 portalEditingMeeting=null;portalSave();render()
}
function portalMeetingEdit(id){
 const cfg=portalPrefs(portalProjectId),m=cfg.meetings.find(x=>String(x.id)===String(id));if(!m)return;
 portalEditingMeeting=m.id;render();
 document.getElementById('portalMeetingSubject').value=m.subject||'';
 document.getElementById('portalMeetingDate').value=m.date||'';
 document.getElementById('portalMeetingTime').value=m.time||'';
 document.getElementById('portalMeetingPlace').value=m.place||'';
 document.getElementById('portalMeetingVisible').checked=m.visible===true;
 document.getElementById('portalMeetingSubject')?.focus()
}
function portalMeetingCancel(){portalEditingMeeting=null;render()}
function portalMeetingToggle(id,visible){
 const cfg=portalPrefs(portalProjectId),m=cfg.meetings.find(x=>String(x.id)===String(id));if(!m)return;
 m.visible=!!visible;portalSave();render()
}
function portalMeetingDelete(id){
 const cfg=portalPrefs(portalProjectId),m=cfg.meetings.find(x=>String(x.id)===String(id));if(!m)return;
 if(!confirm('Excluir a reunião "'+m.subject+'"?'))return;
 cfg.meetings=cfg.meetings.filter(x=>String(x.id)!==String(id));portalSave();render()
}
function portalFolderSubmit(event){
 event?.preventDefault?.();
 const cfg=portalPrefs(portalProjectId),input=document.getElementById('portalNewFolder');
 const name=String(input?.value||'').trim(),stageId=document.getElementById('portalNewFolderStage')?.value;
 if(!portalStageFor(cfg,stageId)){alert('Escolha uma etapa para essa pasta.');return}
 if(!name){alert('Informe o nome da pasta.');return}
 if(cfg.folders.some(x=>x.stageId===stageId&&x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){alert('Já existe uma pasta com esse nome nesta etapa.');return}
 cfg.folders.push({id:portalId(),name,icon:'folder',stageId});portalSave();render()
}
function portalFolderRename(id){
 const cfg=portalPrefs(portalProjectId),folder=cfg.folders.find(x=>String(x.id)===String(id));if(!folder)return;
 const name=prompt('Nome da pasta:',folder.name);if(name===null)return;
 const trimmed=name.trim();if(!trimmed)return;
 if(trimmed.length>60){alert('O nome da pasta deve ter até 60 caracteres.');return}
 if(cfg.folders.some(x=>x.id!==folder.id&&x.stageId===folder.stageId&&x.name.toLocaleLowerCase('pt-BR')===trimmed.toLocaleLowerCase('pt-BR'))){alert('Já existe uma pasta com esse nome nesta etapa.');return}
 folder.name=trimmed;portalSave();render()
}
function portalFolderDelete(id){
 const cfg=portalPrefs(portalProjectId),folder=cfg.folders.find(x=>String(x.id)===String(id));if(!folder)return;
 if(cfg.documents.some(d=>String(d.folderId)===String(folder.id))){alert('Mova ou exclua primeiro os documentos desta pasta.');return}
 if(!confirm('Excluir a pasta "'+folder.name+'"?'))return;
 cfg.folders=cfg.folders.filter(x=>String(x.id)!==String(id));portalSave();render()
}

/* Seletor de arquivos da prévia: leitura apenas de metadados (nome e tamanho).
   Nunca armazena o arquivo nem o torna acessível pela internet. */
function portalFormatBytes(bytes){
 const n=Number(bytes)||0;
 return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(n/1024))+' KB'
}
function portalFileSelected(input){
 const name=document.getElementById('portalDocSelectedFile');
 const file=input?.files?.[0];
 if(!name)return;
 if(!file){
  name.textContent='Nenhum arquivo selecionado.';
  name.classList.remove('client-portal-file-selected');
  return
 }
 name.textContent=file.name+' · '+portalFormatBytes(file.size)+' — prévia, não enviado';
 name.classList.add('client-portal-file-selected');
 const title=document.getElementById('portalDocTitle');
 if(title&&!title.value.trim()){
  const fname=String(file.name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
  title.value=fname.slice(0,160)
 }
 const type=document.getElementById('portalDocType'),ext=String(file.name||'').split('.').pop().toLowerCase();
 if(type){
  type.value=['pdf'].includes(ext)?'PDF':['ppt','pptx','key'].includes(ext)?'Apresentação':['xls','xlsx','csv','numbers'].includes(ext)?'Planilha':['jpg','jpeg','png','webp','heic','gif'].includes(ext)?'Imagem':'Outro'
 }
}
function portalDocumentSubmit(event){
 event?.preventDefault?.();
 const cfg=portalPrefs(portalProjectId),field=id=>String(document.getElementById(id)?.value||'').trim();
 const title=field('portalDocTitle'),folderId=field('portalDocFolder'),type=field('portalDocType'),visible=document.getElementById('portalDocVisible')?.checked===true;
 const chosenFile=document.getElementById('portalDocFile')?.files?.[0];
 if(!title||!cfg.folders.some(f=>f.id===folderId)){alert('Informe o nome do documento e selecione uma pasta válida.');return}
 if(!['PDF','Apresentação','Planilha','Imagem','Outro'].includes(type)){alert('Selecione um tipo de documento.');return}
 if(chosenFile&&!confirm('O arquivo "'+chosenFile.name+'" NÃO será enviado ou armazenado nesta prévia. Deseja cadastrar somente o título como exemplo?'))return;
 const record=cfg.documents.find(d=>String(d.id)===String(portalEditingDocument));
 if(record)Object.assign(record,{title,folderId,type,visible});
 else cfg.documents.push({id:portalId(),title,folderId,type,visible,demo:true,addedAt:new Date().toISOString()});
 portalEditingDocument=null;portalSave();render()
}
function portalDocumentEdit(id){
 const cfg=portalPrefs(portalProjectId),doc=cfg.documents.find(d=>String(d.id)===String(id));if(!doc)return;
 portalEditingDocument=doc.id;render();
 document.getElementById('portalDocTitle').value=doc.title;
 document.getElementById('portalDocFolder').value=doc.folderId;
 document.getElementById('portalDocType').value=doc.type;
 document.getElementById('portalDocVisible').checked=doc.visible===true;
 document.getElementById('portalDocTitle')?.focus()
}
function portalDocumentCancel(){portalEditingDocument=null;render()}
function portalDocumentToggle(id,visible){
 const cfg=portalPrefs(portalProjectId),doc=cfg.documents.find(x=>String(x.id)===String(id));if(!doc)return;
 doc.visible=!!visible;portalSave();render()
}
function portalDocumentDelete(id){
 const cfg=portalPrefs(portalProjectId),doc=cfg.documents.find(x=>String(x.id)===String(id));if(!doc)return;
 if(!confirm('Excluir "'+doc.title+'" da prévia?'))return;
 cfg.documents=cfg.documents.filter(x=>String(x.id)!==String(id));portalSave();render()
}
function portalSeedExampleDocuments(){
 const cfg=portalPrefs(portalProjectId),samples=[
  ['estudo-plantas','Planta e apresentação inicial','Apresentação'],
  ['ante-planilha','Planilha do anteprojeto','Planilha'],
  ['ante-orcamentos','Orçamento de iluminação','PDF'],
  ['executivo-projetos','Projeto executivo','PDF'],
  ['obra-relatorio','Relatório de acompanhamento','PDF'],
  ['posobra-notas','Nota fiscal de referência','PDF']
 ];
 let count=0;
 for(const [folderId,title,type] of samples){
  const folder=cfg.folders.find(x=>x.id===folderId);
  if(!folder||cfg.documents.some(d=>d.demoExample===title))continue;
  cfg.documents.push({id:portalId(),title,type,folderId,visible:true,demo:true,demoExample:title,addedAt:new Date().toISOString()});
  count++
 }
 portalSave();render();
 if(!count)alert('Os documentos de exemplo já foram adicionados ou suas pastas originais foram removidas.')
}
function portalManagerMeetings(cfg){
 const meetings=cfg.meetings.slice().sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
 const rows=meetings.map(m=>{
  const upcoming=portalIsFuture(m),shown=upcoming&&m.visible===true;
  return '<div class="client-portal-meeting-row"><div class="client-portal-meeting-date"><strong>'+esc(portalDate(m.date))+'</strong><span>'+esc(m.time||'')+'</span></div>'
   +'<div class="client-portal-meeting-description"><strong>'+esc(m.subject||'Reunião')+'</strong><span>'+esc(m.place||'Local a definir')+'</span></div>'
   +'<span class="client-portal-meeting-status '+(shown?'client-portal-state-visible':'')+'">'+(shown?'Visível ao cliente':upcoming?'Oculta':'Passada')+'</span>'
   +'<div class="client-portal-row-actions"><label><input type="checkbox" '+(m.visible?'checked ':'')+'onchange="portalMeetingToggle('+portalSafeAction(m.id)+',this.checked)"> Mostrar</label>'
   +'<button class="secondary" onclick="portalMeetingEdit('+portalSafeAction(m.id)+')">Editar</button><button class="secondary" onclick="portalMeetingDelete('+portalSafeAction(m.id)+')">Excluir</button></div></div>'
 }).join('');
 const edit=cfg.meetings.find(x=>String(x.id)===String(portalEditingMeeting));
 return '<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Próximas reuniões</h3><p class="muted">Reuniões futuras com data, horário e assunto. As passadas desaparecem automaticamente da prévia do cliente.</p></div></div>'
  +'<form class="client-portal-form" onsubmit="portalMeetingSubmit(event)"><div class="client-portal-meeting-form">'
  +'<label>Assunto *<input id="portalMeetingSubject" required maxlength="120" placeholder="Ex.: Apresentação do anteprojeto"></label>'
  +'<label>Data *<input id="portalMeetingDate" required type="date" min="'+portalToday()+'"></label>'
  +'<label>Horário *<input id="portalMeetingTime" required type="time"></label>'
  +'<label>Local ou acesso à reunião<input id="portalMeetingPlace" maxlength="240" placeholder="Ex.: Escritório / videoconferência"></label></div>'
  +'<div class="client-portal-form-bottom"><label class="client-portal-check"><input type="checkbox" id="portalMeetingVisible" checked> Mostrar ao cliente</label>'
  +'<div><button class="primary" type="submit">'+(edit?'Salvar reunião':'Adicionar reunião')+'</button>'
  +(edit?'<button class="secondary" type="button" onclick="portalMeetingCancel()">Cancelar</button>':'')+'</div></div></form>'
  +'<div class="client-portal-meeting-rows">'+(rows||'<p class="client-portal-empty-small">Nenhuma reunião cadastrada.</p>')+'</div></section>'
}

function portalManagerStages(cfg){
 const sections=cfg.stages.map(s=>{
  const folders=cfg.folders.filter(f=>f.stageId===s.id);
  const releasedCount=folders.filter(f=>portalIsFolderReleased(cfg,f)).length;
  const count=cfg.documents.filter(d=>portalIsDocumentReleased(cfg,d)&&folders.some(f=>f.id===d.folderId)).length;
  const cards=folders.map(folder=>{
   const n=cfg.documents.filter(x=>String(x.folderId)===String(folder.id)).length;
   const revisionControl=folder.revision?
    '<label class="client-portal-check client-portal-release-revision"><input type="checkbox" '+(folder.revisionReleased?'checked ':'')+
    'onchange="portalRevisionToggle('+portalSafeAction(folder.id)+',this.checked)"> Liberar revisão</label>'
    :'<span class="client-portal-folder-kind">'+(s.released?'Pasta da etapa':'Aguardando etapa')+'</span>';
   const move=folder.revision?'':'<select class="client-portal-move-folder" aria-label="Etapa da pasta '+esc(folder.name)+'" onchange="portalFolderMove('+portalSafeAction(folder.id)+',this.value)" title="Mover para outra etapa">'+portalStageOptions(cfg,s.id)+'</select>';
   return '<div class="client-portal-folder-admin '+(portalIsFolderReleased(cfg,folder)?'client-portal-folder-available':'')+'"><div class="client-portal-folder-symbol">'+portalFolderIcon(folder.icon)+'</div>'
    +'<div class="client-portal-folder-data"><strong>'+esc(folder.name)+'</strong><span>'+n+' documento'+(n===1?'':'s')+' · '+(portalIsFolderReleased(cfg,folder)?'Liberada':'Não liberada')+'</span></div>'
    +'<div class="client-portal-folder-actions">'+revisionControl+move
    +'<button class="secondary" onclick="portalFolderRename('+portalSafeAction(folder.id)+')">Renomear</button>'
    +'<button class="secondary" onclick="portalFolderDelete('+portalSafeAction(folder.id)+')">Excluir</button></div></div>'
  }).join('');
  return '<div class="client-portal-stage-admin '+(s.released?'client-portal-stage-admin-released':'')+'">'
   +'<div class="client-portal-stage-admin-heading"><div class="client-portal-stage-order">'+String(cfg.stages.indexOf(s)+1).padStart(2,'0')+'</div>'
   +'<div class="client-portal-stage-admin-name"><strong>'+esc(s.name)+'</strong><span>'+folders.length+' pasta'+(folders.length===1?'':'s')+' · '+count+' '+(count===1?'documento visível':'documentos visíveis')+'</span></div>'
   +'<span class="client-portal-stage-state '+(s.released?'client-portal-stage-state-released':'')+'">'+(s.released?'Liberada para o cliente':'Bloqueada')+'</span>'
   +'<button class="'+(s.released?'secondary':'primary')+'" type="button" onclick="portalStageToggle('+portalSafeAction(s.id)+','+(!s.released)+')">'+(s.released?'Ocultar etapa':'Liberar etapa')+'</button></div>'
   +'<div class="client-portal-stage-folders">'+cards+'</div>'
   +(s.id==='estudo'?'<p class="client-portal-stage-note">Até 3 revisões: cada revisão é liberada separadamente, somente se for utilizada. Liberar o Estudo preliminar não libera automaticamente as revisões.</p>':'')
   +(!s.released?'<p class="client-portal-stage-note">Nenhuma pasta desta etapa aparece para o cliente até você clicar em <strong>Liberar etapa</strong>.</p>':'')
   +'</div>';
 }).join('');
 return '<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Liberação das etapas e pastas</h3>'
  +'<p class="muted">As pastas ficam organizadas por etapa. Clique em “Liberar etapa” quando quiser disponibilizar os documentos ao cliente. Uma etapa anterior pode continuar acessível.</p></div></div>'
  +'<div class="client-portal-stage-admin-list">'+sections+'</div>'
  +'<form class="client-portal-new-folder client-portal-new-folder-stage" onsubmit="portalFolderSubmit(event)"><input id="portalNewFolder" required maxlength="60" placeholder="Nova pasta (opcional)">'
  +'<select id="portalNewFolderStage" aria-label="Etapa da nova pasta">'+portalStageOptions(cfg,cfg.stages[0]?.id)+'</select>'
  +'<button class="secondary" type="submit">+ Criar pasta</button></form>'
  +'</section>'
}
function portalManagerDocs(cfg){
 const editing=cfg.documents.find(d=>String(d.id)===String(portalEditingDocument));
 const docs=cfg.documents.map(doc=>{
  const folder=portalFolderFor(cfg,doc.folderId);
  const stage=folder&&portalStageFor(cfg,folder.stageId);
  const actual=portalIsDocumentReleased(cfg,doc);
  const state=actual?'Liberado':!doc.visible?'Oculto pelo escritório':!stage?.released?'Etapa bloqueada':folder?.revision&&!folder.revisionReleased?'Revisão não liberada':'Pasta indisponível';
  const statusClass=actual?'client-portal-status-released':'client-portal-status-hidden';
  return '<div class="client-portal-doc-row"><div class="client-portal-doc-icon">▤</div><div class="client-portal-doc-details"><strong>'+esc(doc.title)+'</strong>'
   +'<span>'+esc(stage?.name||'Etapa indisponível')+' › '+esc(folder?.name||'Pasta não encontrada')+' · '+esc(doc.type||'Documento')+' · Exemplo</span></div>'
   +'<span class="client-portal-document-status '+statusClass+'">'+state+'</span>'
   +'<label class="client-portal-check"><input type="checkbox" '+(doc.visible?'checked ':'')+'onchange="portalDocumentToggle('+portalSafeAction(doc.id)+',this.checked)"> Publicar</label>'
   +'<div class="client-portal-doc-actions"><button class="secondary" onclick="portalDocumentEdit('+portalSafeAction(doc.id)+')">Editar</button>'
   +'<button class="secondary" onclick="portalDocumentDelete('+portalSafeAction(doc.id)+')">Excluir</button></div></div>'
 }).join('');
 return '<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Documentos por etapa</h3>'
  +'<p class="muted">Cadastre títulos de exemplo, escolha uma pasta e marque “Publicar”. Mesmo publicado, o documento só aparecerá após liberar a etapa e, se for revisão, a pasta da revisão.</p></div>'
  +'<button type="button" class="secondary" onclick="portalSeedExampleDocuments()">Inserir exemplos</button></div>'
  +'<form class="client-portal-form" onsubmit="portalDocumentSubmit(event)"><div class="client-portal-document-form">'
  +'<label>Nome do documento *<input id="portalDocTitle" required maxlength="160" placeholder="Ex.: Plantas — revisão 1"></label>'
  +'<label>Etapa e pasta *<select id="portalDocFolder" required>'+portalFolderOptions(cfg,editing?.folderId||cfg.folders[0]?.id)+'</select></label>'
  +'<label>Tipo<select id="portalDocType">'+['PDF','Apresentação','Planilha','Imagem','Outro'].map(t=>'<option'+(t===(editing?.type||'PDF')?' selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'
  +'<div class="client-portal-file-upload"><label for="portalDocFile" class="client-portal-file-label">Arquivo do computador ou celular (prévia)</label>'
  +'<label class="client-portal-file-select" for="portalDocFile"><span class="client-portal-file-icon">＋</span><span><strong>Selecionar arquivo</strong><small>PDF, apresentação, planilha, imagem ou documento do seu dispositivo</small></span></label>'
  +'<input id="portalDocFile" class="client-portal-file-input" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic,.gif,.key,.numbers" onchange="portalFileSelected(this)">'
  +'<div id="portalDocSelectedFile" class="client-portal-file-selected-info">Nenhum arquivo selecionado.</div>'
  +'<p class="client-portal-file-warning">Por enquanto, o seletor demonstra a experiência de escolher um arquivo. O documento não será enviado nem armazenado. O envio real será ativado depois da configuração de autenticação e do Storage privado.</p></div>'
  +'<div class="client-portal-form-bottom"><label class="client-portal-check"><input id="portalDocVisible" type="checkbox" '+(editing?.visible===false?'':'checked')+'> Publicar quando etapa liberada</label>'
  +'<div><button class="primary" type="submit" '+(!cfg.folders.length?'disabled':'')+'>'+(editing?'Salvar documento':'Adicionar documento de exemplo')+'</button>'
  +(editing?'<button class="secondary" type="button" onclick="portalDocumentCancel()">Cancelar</button>':'')+'</div></div></form>'
  +'<div class="client-portal-doc-list">'+(docs||'<div class="client-portal-empty-small">Nenhum documento cadastrado. Use “Inserir exemplos” para visualizar a organização das etapas.</div>')+'</div>'
  +'</section>'
}
function portalManagerProject(project,cfg){
 const visible=portalReleasedDocumentCount(cfg),upcoming=portalUpcoming(cfg).length;
 const releases=cfg.stages.filter(s=>s.released).length;
 return '<div class="client-portal-admin"><section class="panel"><div class="client-portal-header-actions"><button class="secondary" onclick="openProject('+portalSafeAction(project.id)+')">← Painel do projeto</button><button class="secondary" onclick="portalBack()">Todos os projetos</button><button class="primary" onclick="portalOpenPreview('+portalSafeAction(project.id)+')">Ver como cliente ↗</button></div>'
  +'<div class="client-portal-head"><div><span class="client-portal-eyebrow">GERENCIAMENTO INTERNO · PRÉVIA</span><h2>'+esc(project.name||'Projeto')+'</h2>'
  +'<p class="muted">'+esc(project.clientRegistration?.name||project.client||'Cliente')+' · Libere as etapas no momento adequado, mantendo documentos e prazos internos protegidos.</p></div>'
  +'<div class="client-portal-meta-count"><strong>'+releases+'/'+cfg.stages.length+'</strong><span>Etapas liberadas</span><strong>'+visible+'</strong><span>Documentos visíveis</span>'
  +'<strong>'+upcoming+'</strong><span>Reuniões futuras</span></div></div>'
  +'<div class="client-portal-alert"><strong>Esta ainda é uma prévia local, sem autenticação</strong><p>Não coloque arquivos privados ou dados sensíveis reais aqui. O login e o armazenamento seguro serão desenvolvidos depois da aprovação das telas.</p></div></section>'
  +'<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Nome da etapa atual</h3>'
  +'<p class="muted">Este campo controla somente o nome exibido no portal. É independente da liberação das pastas e nunca mostra prazos ou datas de produção.</p></div></div>'
  +'<div class="client-portal-stage-form"><input id="portalStageName" maxlength="80" value="'+esc(cfg.stage)+'" placeholder="Ex.: Anteprojeto">'
  +'<button class="primary" onclick="portalStageSave()">Salvar etapa</button></div>'
  +'<p class="client-portal-helper">Você escolhe manualmente quando atualizar o nome da etapa.</p></section>'
  +portalManagerMeetings(cfg)+portalManagerStages(cfg)+portalManagerDocs(cfg)+'</div>'
}
function portalPreviewMeetings(cfg){
 const meetings=portalUpcoming(cfg);
 if(!meetings.length)return '<div class="client-portal-client-empty"><div class="client-portal-empty-icon">▦</div><p>Não há reuniões agendadas no momento.</p><span>Quando uma reunião for marcada e liberada pelo escritório, ela aparecerá aqui.</span></div>';
 return meetings.map(m=>{
  const date=new Date(m.date+'T12:00:00');
  const day=String(date.getDate()).padStart(2,'0');
  const month=date.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
  return '<div class="client-portal-client-meeting"><div class="client-portal-client-date"><strong>'+day+'</strong><span>'+esc(month)+'</span></div><div class="client-portal-client-meeting-info"><strong>'+esc(m.subject||'Reunião')+'</strong><span>◷ '+esc(m.time)+' · '+esc(m.place||'Local a confirmar')+'</span></div></div>'
 }).join('')
}
function portalPreviewFolders(cfg){
 /* Apenas etapas liberadas participam da biblioteca. A pasta e a publicação
    individual continuam sujeitas ao respectivo controle de acesso. */
 const unlockedStages=cfg.stages.filter(stage=>stage.released===true);
 if(portalFolderId){
  const folder=portalFolderFor(cfg,portalFolderId);
  if(!portalIsFolderReleased(cfg,folder)){
   portalFolderId=null;return portalPreviewFolders(cfg);
  }
  const stage=portalStageFor(cfg,folder.stageId);
  const docs=cfg.documents.filter(doc=>String(doc.folderId)===String(folder.id)&&portalIsDocumentReleased(cfg,doc));
  const cards=docs.map(d=>'<div class="client-portal-client-document"><span class="client-portal-client-document-icon">▤</span>'
   +'<div><strong>'+esc(d.title)+'</strong><span>'+esc(d.type||'Documento')+' · Prévia sem arquivo anexado</span></div>'
   +'<span class="client-portal-client-doc-label">Exemplo</span></div>').join('');
  return '<button class="client-portal-back-folder" onclick="portalFolderId=null;render()">← Voltar às etapas e pastas</button>'
   +'<div class="client-portal-folder-breadcrumb">'+esc(stage?.name||'Etapa')+'</div>'
   +'<div class="client-portal-client-folder-title"><span>'+portalFolderIcon(folder.icon)+'</span><h3>'+esc(folder.name)+'</h3></div>'
   +(cards||'<div class="client-portal-client-empty"><p>Nenhum documento disponível nesta pasta.</p></div>')
 }
 if(!unlockedStages.length){
  return '<div class="client-portal-client-empty client-portal-library-locked"><div class="client-portal-empty-icon">▱</div>'
   +'<p>Seus documentos aparecerão aqui em breve.</p>'
   +'<span>Assim que o escritório liberar uma etapa, as pastas correspondentes estarão disponíveis para consulta.</span></div>'
 }
 return '<div class="client-portal-client-stage-library">'+unlockedStages.map(stage=>{
  const folders=cfg.folders.filter(folder=>folder.stageId===stage.id&&portalIsFolderReleased(cfg,folder));
  const list=folders.length?'<div class="client-portal-client-folders">'+folders.map(f=>{
   const count=cfg.documents.filter(doc=>String(doc.folderId)===String(f.id)&&portalIsDocumentReleased(cfg,doc)).length;
   return '<button class="client-portal-client-folder" onclick="portalFolderId='+portalSafeAction(f.id)+';render()">'
    +'<span class="client-portal-client-folder-icon">'+portalFolderIcon(f.icon)+'</span>'
    +'<strong>'+esc(f.name)+'</strong><span>'+count+' documento'+(count===1?'':'s')+'</span>'
    +'<span class="client-portal-client-folder-arrow">→</span></button>'
  }).join('')+'</div>':'<div class="client-portal-client-empty"><p>As pastas desta etapa ainda estão sendo preparadas.</p></div>';
  return '<section class="client-portal-released-stage"><div class="client-portal-released-stage-heading">'
   +'<span class="client-portal-released-stage-icon">✓</span>'
   +'<div><span>ETAPA LIBERADA</span><h3>'+esc(stage.name)+'</h3></div></div>'
   +list+'</section>';
 }).join('')+'</div>'
}
function portalPreviewProject(project,cfg){
 const name=String(project.clientRegistration?.name||project.client||'Cliente').trim();
 const greeting=name.split(/\s+/)[0]||'Cliente';
 return '<div class="client-portal-preview-bar"><span>◉ Modo de prévia · O cliente ainda não tem acesso real</span><button onclick="portalGoManager()">← Voltar ao escritório</button></div>'
  +'<div class="client-portal-client"><header class="client-portal-client-header"><div><div class="client-portal-client-brand">SANTRELLE</div><span>ARQUITETURA E INTERIORES</span></div><div class="client-portal-client-header-side">ÁREA DO CLIENTE <span>PRÉVIA</span></div></header>'
  +'<section class="client-portal-client-hero"><div class="client-portal-eyebrow">O SEU ESPAÇO EXCLUSIVO</div><h1>Olá, '+esc(greeting)+'!</h1><p>Seja bem-vindo ao espaço dedicado ao seu projeto. Aqui você poderá consultar os documentos disponibilizados pelo escritório.</p>'
  +'<div class="client-portal-client-hero-project"><span>SEU PROJETO</span><strong>'+esc(project.name||'Projeto')+'</strong></div></section>'
  +'<div class="client-portal-client-top-grid"><section class="client-portal-client-stage"><span class="client-portal-client-section-eyebrow">ETAPA DO PROJETO</span>'
  +'<div class="client-portal-client-stage-name">'+(cfg.stage?esc(cfg.stage):'Aguardando atualização')+'</div>'
  +'<p>Acompanhe aqui o nome da etapa compartilhada pelo escritório.</p></section>'
  +'<section class="client-portal-client-meetings"><div class="client-portal-client-section-heading"><span>PRÓXIMAS REUNIÕES</span><span>▦</span></div>'
  +portalPreviewMeetings(cfg)+'</section></div>'
  +'<section class="client-portal-client-library"><div class="client-portal-client-library-title"><div><span class="client-portal-client-section-eyebrow">BIBLIOTECA DO PROJETO</span>'
  +'<h2>Seus documentos</h2><p>As pastas são disponibilizadas conforme a liberação de cada etapa do seu projeto.</p></div><span class="client-portal-library-glyph">▱</span></div>'
  +portalPreviewFolders(cfg)+'</section>'
  +'<footer class="client-portal-client-footer"><strong>SANTRELLE</strong><span>Arquitetura e Interiores</span><span>Prévia do portal · Arquivos não disponíveis para download nesta versão</span></footer></div>'
}
function renderClientPortalManager(){
 const project=portalProject(portalProjectId);
 if(portalView==='preview'&&project){
  document.body.classList.add('portal-is-preview');
  el.innerHTML=portalPreviewProject(project,portalPrefs(project.id));
  return;
 }
 document.body.classList.remove('portal-is-preview');
 el.innerHTML=project?portalManagerProject(project,portalPrefs(project.id)):portalProjectList()
}
