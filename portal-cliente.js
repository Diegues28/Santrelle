/* Santrelle • Prévia da Área do Cliente
 * AVISO: versão local de design, sem autenticação, upload ou publicação de arquivos.
 * Nunca exibir prazos, cronograma interno, responsáveis ou subetapas no portal.
 * A verdadeira área compartilhada depende de backend seguro, autorização e armazenamento privado.
 */
const PORTAL_PREVIEW_STORAGE = 'santrelle_portal_preview_v1';
const PORTAL_FOLDER_TEMPLATES = [
 {id:'apresentacoes',name:'Apresentações',icon:'presentation'},
 {id:'orcamentos',name:'Orçamentos',icon:'calculator'},
 {id:'relatorios',name:'Relatórios',icon:'clipboard'},
 {id:'documentos',name:'Outros documentos',icon:'folder'}
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
  portalPreviewData[key]={stage:'',folders:PORTAL_FOLDER_TEMPLATES.map(x=>({...x})),meetings:[],documents:[]};
  portalSave()
 }
 const p=portalPreviewData[key];
 if(!Array.isArray(p.folders))p.folders=PORTAL_FOLDER_TEMPLATES.map(x=>({...x}));
 if(!Array.isArray(p.meetings))p.meetings=[];
 if(!Array.isArray(p.documents))p.documents=[];
 if(typeof p.stage!=='string')p.stage='';
 return p
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
 const card=p=>{const cfg=portalPreviewData[String(p.id)],meetings=cfg?.meetings?.filter(m=>m.visible&&portalIsFuture(m)).length||0,docs=cfg?.documents?.filter(d=>d.visible).length||0;
  return '<div class="client-portal-project"><div class="client-portal-project-text"><strong>'+esc(p.name||'Projeto sem nome')+'</strong><span>'+esc(p.client||p.clientRegistration?.name||'Cliente')+'</span></div>'
   +'<div class="client-portal-project-meta">'+docs+' documento'+(docs===1?'':'s')+' · '+meetings+' reunião'+(meetings===1?'':'ões')+' agendada'+(meetings===1?'':'s')+'</div>'
   +'<div class="client-portal-project-actions"><button class="secondary" onclick="portalOpen('+portalSafeAction(p.id)+')">Configurar</button>'
   +'<button class="primary" onclick="portalOpenPreview('+portalSafeAction(p.id)+')">Ver como cliente</button></div></div>'};
 return '<div class="client-portal-admin"><section class="panel"><div class="client-portal-head"><div><span class="client-portal-eyebrow">SANTRELLE · ACESSO INTERNO</span><h2>Área do Cliente</h2><p class="muted">Defina como cada cliente encontrará os documentos e as reuniões do projeto. Os prazos internos não são compartilhados.</p></div><span class="client-portal-demo-pill">Protótipo local</span></div>'
 +'<div class="client-portal-alert"><strong>Prévia para aprovação das telas</strong><p>Os dados desta seção ficam somente neste navegador. Ainda não existe login do cliente, upload seguro de documentos ou compartilhamento online. Use nomes fictícios ou demonstrativos até ativarmos a proteção.</p></div></section>'
 +'<section class="panel"><h3>Escolha um projeto</h3>'+(sorted.length?'<div class="client-portal-projects">'+sorted.map(card).join('')+'</div>':'<div class="client-portal-empty">Nenhum projeto cadastrado. Cadastre um projeto para configurar a prévia da Área do Cliente.</div>')+'</section></div>'
}
function portalFolderOptions(settings,current){
 return settings.folders.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===current?' selected':'')+'>'+esc(f.name)+'</option>').join('')
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
 const name=String(input?.value||'').trim();
 if(!name){alert('Informe o nome da pasta.');return}
 if(cfg.folders.some(x=>x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){alert('Já existe uma pasta com esse nome.');return}
 cfg.folders.push({id:portalId(),name,icon:'folder'});portalSave();render()
}
function portalFolderRename(id){
 const cfg=portalPrefs(portalProjectId),folder=cfg.folders.find(x=>String(x.id)===String(id));if(!folder)return;
 const name=prompt('Nome da pasta:',folder.name);if(name===null)return;
 const trimmed=name.trim();if(!trimmed)return;
 if(trimmed.length>60){alert('O nome da pasta deve ter até 60 caracteres.');return}
 if(cfg.folders.some(x=>x.id!==folder.id&&x.name.toLocaleLowerCase('pt-BR')===trimmed.toLocaleLowerCase('pt-BR'))){alert('Já existe uma pasta com esse nome.');return}
 folder.name=trimmed;portalSave();render()
}
function portalFolderDelete(id){
 const cfg=portalPrefs(portalProjectId),folder=cfg.folders.find(x=>String(x.id)===String(id));if(!folder)return;
 if(cfg.documents.some(d=>String(d.folderId)===String(folder.id))){alert('Mova ou exclua primeiro os documentos desta pasta.');return}
 if(!confirm('Excluir a pasta "'+folder.name+'"?'))return;
 cfg.folders=cfg.folders.filter(x=>String(x.id)!==String(id));portalSave();render()
}
function portalDocumentSubmit(event){
 event?.preventDefault?.();
 const cfg=portalPrefs(portalProjectId),field=id=>String(document.getElementById(id)?.value||'').trim();
 const title=field('portalDocTitle'),folderId=field('portalDocFolder'),type=field('portalDocType'),visible=document.getElementById('portalDocVisible')?.checked===true;
 if(!title||!cfg.folders.some(f=>f.id===folderId)){alert('Informe o nome do documento e selecione uma pasta válida.');return}
 if(!['PDF','Apresentação','Planilha','Imagem','Outro'].includes(type)){alert('Selecione um tipo de documento.');return}
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
  ['apresentacoes','Apresentação de conceito','Apresentação'],
  ['orcamentos','Orçamento de iluminação','PDF'],
  ['relatorios','Relatório de acompanhamento','PDF']
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
function portalManagerDocs(cfg){
 const folderNames=Object.fromEntries(cfg.folders.map(f=>[f.id,f.name]));
 const folderCards=cfg.folders.map(f=>{
  const count=cfg.documents.filter(x=>x.folderId===f.id).length;
  return '<div class="client-portal-folder-admin"><div class="client-portal-folder-symbol">'+portalFolderIcon(f.icon)+'</div><div><strong>'+esc(f.name)+'</strong><span>'+count+' documento'+(count===1?'':'s')+' cadastrado'+(count===1?'':'s')+'</span></div>'
   +'<div class="client-portal-folder-actions"><button class="secondary" onclick="portalFolderRename('+portalSafeAction(f.id)+')">Renomear</button><button class="secondary" onclick="portalFolderDelete('+portalSafeAction(f.id)+')">Excluir</button></div></div>'
 }).join('');
 const docs=cfg.documents.map(doc=>{
  return '<div class="client-portal-doc-row"><div class="client-portal-doc-icon">▤</div><div class="client-portal-doc-details"><strong>'+esc(doc.title)+'</strong><span>'+esc(folderNames[doc.folderId]||'Pasta não encontrada')+' · '+esc(doc.type||'Documento')+' · Apenas ficha de demonstração</span></div>'
   +'<label class="client-portal-check"><input type="checkbox" '+(doc.visible?'checked ':'')+'onchange="portalDocumentToggle('+portalSafeAction(doc.id)+',this.checked)"> Visível</label>'
   +'<div class="client-portal-doc-actions"><button class="secondary" onclick="portalDocumentEdit('+portalSafeAction(doc.id)+')">Editar</button><button class="secondary" onclick="portalDocumentDelete('+portalSafeAction(doc.id)+')">Excluir</button></div></div>'
 }).join('');
 const editing=cfg.documents.find(d=>String(d.id)===String(portalEditingDocument));
 return '<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Pastas dos documentos</h3><p class="muted">Organize as categorias que aparecem ao cliente. Você pode renomear ou adicionar pastas.</p></div></div>'
  +'<div class="client-portal-folder-admin-grid">'+(folderCards||'<p class="muted">Nenhuma pasta cadastrada.</p>')+'</div>'
  +'<form class="client-portal-new-folder" onsubmit="portalFolderSubmit(event)"><input id="portalNewFolder" required maxlength="60" placeholder="Nome da nova pasta"><button class="secondary" type="submit">+ Criar pasta</button></form></section>'
  +'<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Documentos disponíveis</h3><p class="muted">Cadastre títulos fictícios para testar a disposição dos documentos e a chave de visibilidade. Ainda não é possível enviar, abrir nem baixar arquivos reais nesta prévia.</p></div>'
  +'<button type="button" class="secondary" onclick="portalSeedExampleDocuments()">Inserir 3 exemplos</button></div>'
  +'<form class="client-portal-form" onsubmit="portalDocumentSubmit(event)"><div class="client-portal-document-form"><label>Nome do documento *<input id="portalDocTitle" required maxlength="160" placeholder="Ex.: Apresentação final do anteprojeto"></label>'
  +'<label>Pasta *<select id="portalDocFolder" required>'+portalFolderOptions(cfg,editing?.folderId||cfg.folders[0]?.id)+'</select></label>'
  +'<label>Tipo<select id="portalDocType">'+['PDF','Apresentação','Planilha','Imagem','Outro'].map(t=>'<option'+(t===(editing?.type||'PDF')?' selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'
  +'<div class="client-portal-form-bottom"><label class="client-portal-check"><input id="portalDocVisible" type="checkbox" '+(editing?.visible===false?'':'checked')+'> Visível para o cliente</label>'
  +'<div><button class="primary" type="submit" '+(!cfg.folders.length?'disabled':'')+'>'+(editing?'Salvar documento':'Adicionar documento de exemplo')+'</button>'
  +(editing?'<button class="secondary" type="button" onclick="portalDocumentCancel()">Cancelar</button>':'')+'</div></div></form>'
  +'<div class="client-portal-doc-list">'+(docs||'<div class="client-portal-empty-small">Nenhum documento cadastrado. Use “Inserir 3 exemplos” para visualizar uma simulação completa.</div>')+'</div>'
  +'</section>'
}
function portalManagerProject(project,cfg){
 const visible=cfg.documents.filter(x=>x.visible).length,upcoming=portalUpcoming(cfg).length;
 return '<div class="client-portal-admin"><section class="panel"><div class="client-portal-header-actions"><button class="secondary" onclick="portalBack()">← Todos os projetos</button><button class="primary" onclick="portalOpenPreview('+portalSafeAction(project.id)+')">Ver como cliente ↗</button></div>'
  +'<div class="client-portal-head"><div><span class="client-portal-eyebrow">GERENCIAMENTO INTERNO · PRÉVIA</span><h2>'+esc(project.name||'Projeto')+'</h2><p class="muted">'+esc(project.clientRegistration?.name||project.client||'Cliente')+' · Organize somente o que o cliente poderá visualizar.</p></div>'
  +'<div class="client-portal-meta-count"><strong>'+visible+'</strong><span>Documentos visíveis</span><strong>'+upcoming+'</strong><span>Reuniões futuras</span></div></div>'
  +'<div class="client-portal-alert"><strong>Esta ainda é uma prévia local, sem autenticação</strong><p>Não coloque arquivos privados ou dados sensíveis reais aqui. O login e o armazenamento seguro serão desenvolvidos depois da aprovação das telas.</p></div></section>'
  +'<section class="panel client-portal-admin-section"><div class="client-portal-section-heading"><div><h3>Etapa exibida ao cliente</h3><p class="muted">Apenas o nome. Nenhum prazo, cronograma ou status interno será mostrado. A atualização é manual.</p></div></div>'
  +'<div class="client-portal-stage-form"><input id="portalStageName" maxlength="80" value="'+esc(cfg.stage)+'" placeholder="Ex.: Anteprojeto"><button class="primary" onclick="portalStageSave()">Salvar etapa</button></div>'
  +'<p class="client-portal-helper">Deixe o campo vazio e salve caso não queira mostrar uma etapa no portal.</p></section>'
  +portalManagerMeetings(cfg)+portalManagerDocs(cfg)+'</div>'
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
 if(portalFolderId){
  const folder=cfg.folders.find(f=>String(f.id)===String(portalFolderId));
  if(!folder){portalFolderId=null;return portalPreviewFolders(cfg)}
  const docs=cfg.documents.filter(d=>d.visible===true&&String(d.folderId)===String(folder.id));
  const cards=docs.map(d=>'<div class="client-portal-client-document"><span class="client-portal-client-document-icon">▤</span><div><strong>'+esc(d.title)+'</strong><span>'+esc(d.type||'Documento')+' · Prévia sem arquivo anexado</span></div><span class="client-portal-client-doc-label">Exemplo</span></div>').join('');
  return '<button class="client-portal-back-folder" onclick="portalFolderId=null;render()">← Voltar às pastas</button>'
   +'<div class="client-portal-client-folder-title"><span>'+portalFolderIcon(folder.icon)+'</span><h3>'+esc(folder.name)+'</h3></div>'
   +(cards||'<div class="client-portal-client-empty"><p>Nenhum documento disponível nesta pasta.</p></div>')
 }
 return '<div class="client-portal-client-folders">'+cfg.folders.map(f=>{
  const count=cfg.documents.filter(x=>x.visible===true&&String(x.folderId)===String(f.id)).length;
  return '<button class="client-portal-client-folder" onclick="portalFolderId='+portalSafeAction(f.id)+';render()"><span class="client-portal-client-folder-icon">'+portalFolderIcon(f.icon)+'</span>'
   +'<strong>'+esc(f.name)+'</strong><span>'+count+' documento'+(count===1?'':'s')+'</span><span class="client-portal-client-folder-arrow">→</span></button>'
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
  +'<h2>Seus documentos</h2><p>Selecione uma pasta para consultar os arquivos disponibilizados pelo escritório.</p></div><span class="client-portal-library-glyph">▱</span></div>'
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
