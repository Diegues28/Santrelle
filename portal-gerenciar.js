/* Painel online. Todas as permissões reais são verificadas pelo Supabase RLS. */
(()=>{
 const conf=window.SANTRELLE_PORTAL_CONFIG||{},E=id=>document.getElementById(id);
 const note=s=>{E('managerMessage').textContent=s};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!conf.url||!conf.publishableKey||!window.supabase?.createClient){E('loginMessage').textContent='Serviço em configuração.';return}
 const db=window.supabase.createClient(conf.url,conf.publishableKey);
 let currentProject=null,projects=[],stages=[],folders=[];
 async function get(q){const {data,error}=await q;if(error)throw error;return data||[]}
 async function write(q){const {data,error}=await q;if(error)throw error;return data}
 const projectId=()=>currentProject?.id;
 const selectHTML=(entries,placeholder='Selecione')=>'<option value="">'+placeholder+'</option>'+entries.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.label)+'</option>').join('');
 function showPanel(ok){E('login').classList.toggle('hidden',ok);E('manager').classList.toggle('hidden',!ok);E('logout').classList.toggle('hidden',!ok)}
 async function checkStaff(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){showPanel(false);return}
  const rows=await get(db.from('portal_staff').select('user_id').eq('user_id',user.id));
  if(!rows.length){showPanel(false);E('loginMessage').textContent='Esta conta ainda não foi autorizada como integrante da equipe Santrelle.';return}
  showPanel(true);await reloadProjects();
 }
 async function reloadProjects(){
  projects=await get(db.from('portal_projects').select('id,title,client_label,current_stage').order('created_at',{ascending:false}));
  E('projectList').innerHTML=projects.length?projects.map(p=>'<div class="item"><span><strong>'+escape(p.title)+'</strong> · '+escape(p.client_label)+'</span><button class="secondary" data-project="'+p.id+'">Gerenciar</button></div>').join(''):'<p class="muted">Nenhum projeto online ainda.</p>';
  E('projectList').querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.project));
 }
 async function openProject(id){
  currentProject=projects.find(p=>p.id===id);if(!currentProject)return;
  E('projectEditor').classList.remove('hidden');E('projectName').textContent=currentProject.title;
  await refreshProject();E('projectEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function refreshProject(){
  const pid=projectId();if(!pid)return;
  const [members,stageRows,meetings]=await Promise.all([
   get(db.from('portal_project_members').select('user_id').eq('project_id',pid)),
   get(db.from('portal_stages').select('id,label,position,released').eq('project_id',pid).order('position')),
   get(db.from('portal_meetings').select('id,subject,starts_at,location,released').eq('project_id',pid).order('starts_at'))
  ]);
  stages=stageRows;
  const profiles=members.length?await get(db.from('portal_profiles').select('user_id,email').in('user_id',members.map(m=>m.user_id))):[];
  E('memberList').innerHTML=profiles.map(p=>'<div class="item">'+escape(p.email)+'</div>').join('')||'<p class="muted">Nenhum cliente vinculado.</p>';
  E('stageList').innerHTML=stages.map(s=>toggleRow('portal_stages',s,'Etapa')).join('');
  E('folderStage').innerHTML=selectHTML(stages);
  folders=[];
  for(const stage of stages){
   const rows=await get(db.from('portal_folders').select('id,stage_id,label,position,released').eq('stage_id',stage.id).order('position'));
   folders.push(...rows);
  }
  E('folderList').innerHTML=folders.map(f=>toggleRow('portal_folders',f,stages.find(s=>s.id===f.stage_id)?.label||'Pasta')).join('');
  E('docFolder').innerHTML=selectHTML(folders);
  E('meetingList').innerHTML=meetings.map(m=>toggleRow('portal_meetings',{...m,label:m.subject+' · '+new Date(m.starts_at).toLocaleString('pt-BR')},'Reunião')).join('');
  const docs=[];
  for(const f of folders)docs.push(...await get(db.from('portal_documents').select('id,folder_id,title,released').eq('folder_id',f.id)));
  E('docList').innerHTML=docs.map(d=>toggleRow('portal_documents',{...d,label:d.title},folders.find(f=>f.id===d.folder_id)?.label||'Documento')).join('');
  E('projectEditor').querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggle(b));
 }
 function toggleRow(table,row,type){
  return '<div class="item"><span><span class="pill">'+escape(type)+'</span> '+escape(row.label)+' <span class="pill">'+(row.released?'Liberado':'Oculto')+'</span></span><button class="secondary" data-toggle="'+table+'" data-id="'+row.id+'" data-release="'+(!row.released)+'">'+(row.released?'Ocultar':'Liberar')+'</button></div>';
 }
 async function toggle(button){
  const table=button.dataset.toggle,release=button.dataset.release==='true';
  if(!['portal_stages','portal_folders','portal_documents','portal_meetings'].includes(table))return;
  if(release&&!confirm('Confirma a liberação deste item para os clientes vinculados?'))return;
  try{await write(db.from(table).update({released:release}).eq('id',button.dataset.id));await refreshProject();note('Permissão atualizada.')}
  catch(err){note('Erro ao alterar permissão: '+err.message)}
 }
 function submit(id,fn){E(id).addEventListener('submit',async ev=>{
  ev.preventDefault();const b=ev.submitter;if(b)b.disabled=true;
  try{await fn();ev.target.reset();await refreshProject();note('Alterações salvas com sucesso.')}
  catch(err){note('Não foi possível salvar: '+err.message)}finally{if(b)b.disabled=false}
 })}
 E('loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();E('loginMessage').textContent='Verificando acesso...';
  const {error}=await db.auth.signInWithPassword({email:E('email').value.trim(),password:E('password').value});
  E('password').value='';if(error){E('loginMessage').textContent='E-mail ou senha inválidos.';return}
  await checkStaff().catch(err=>E('loginMessage').textContent=err.message);
 });
 E('logout').onclick=async()=>{await db.auth.signOut();currentProject=null;showPanel(false)};
 submit('newProject',async()=>{
  await write(db.from('portal_projects').insert({title:E('title').value.trim(),client_label:E('clientLabel').value.trim()}));
  await reloadProjects();
 });
 submit('addMember',async()=>{
  const email=E('memberEmail').value.trim().toLowerCase();
  const users=await get(db.from('portal_profiles').select('user_id').ilike('email',email));
  if(!users.length)throw new Error('E-mail não cadastrado. Peça ao cliente para criar a conta e confirmar o e-mail.');
  await write(db.from('portal_project_members').upsert({project_id:projectId(),user_id:users[0].user_id}));
 });
 submit('newStage',async()=>{await write(db.from('portal_stages').insert({project_id:projectId(),label:E('stageName').value.trim(),position:stages.length,released:false}))});
 submit('newFolder',async()=>{if(!E('folderStage').value)throw Error('Selecione uma etapa.');await write(db.from('portal_folders').insert({stage_id:E('folderStage').value,label:E('folderName').value.trim(),position:folders.length,released:false}))});
 submit('newMeeting',async()=>{
  await write(db.from('portal_meetings').insert({project_id:projectId(),subject:E('meetingSubject').value.trim(),starts_at:new Date(E('meetingDate').value).toISOString(),location:E('meetingPlace').value.trim(),released:false}));
 });
 submit('newDocument',async()=>{
  const file=E('docFile').files[0],folderId=E('docFolder').value;
  if(!file||!folderId)throw Error('Selecione o arquivo e uma pasta.');
  if(file.size>20*1024*1024)throw Error('Arquivo acima do limite de 20 MB deste formulário.');
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Use arquivos PDF, JPG ou PNG.');
  const clean=file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=projectId()+'/'+crypto.randomUUID()+'-'+clean;
  const {error}=await db.storage.from('santrelle-clientes').upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;
  try{await write(db.from('portal_documents').insert({folder_id:folderId,title:E('docTitle').value.trim(),storage_path:path,released:false}))}
  catch(err){await db.storage.from('santrelle-clientes').remove([path]);throw err}
 });
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showPanel(false)});
 checkStaff().catch(err=>E('loginMessage').textContent='Erro de conexão: '+err.message);
})();
