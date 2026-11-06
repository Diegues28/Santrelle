/* Portal de leitura da Santrelle: nenhuma operação privilegiada no navegador. */
(()=>{
 const cfg=window.SANTRELLE_PORTAL_CONFIG||{};
 const el=id=>document.getElementById(id);
 const message=(value)=>{el('loginMessage').textContent=value};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ready=!!(cfg.url&&cfg.publishableKey&&window.supabase?.createClient);
 if(!ready){message('O acesso online está em configuração. Tente novamente mais tarde.');el('loginButton').disabled=true;return}
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 const show=active=>{el('signin').classList.toggle('hidden',active);el('client').classList.toggle('hidden',!active);el('logout').classList.toggle('hidden',!active)};
 const result=async query=>{const {data,error}=await query;if(error)throw error;return data||[]};
 const date=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Sao_Paulo'});
 async function showProjects(){
  el('projects').textContent='Carregando projetos...';
  try{
   const projects=await result(db.from('portal_projects').select('id,title,client_label,current_stage').order('created_at',{ascending:false}));
   if(!projects.length){el('projects').innerHTML='<p class="empty">Seu acesso foi criado. A equipe ainda precisa vincular o projeto à sua conta.</p>';return}
   el('projects').innerHTML='';
   for(const p of projects){
    const wrap=document.createElement('article');wrap.className='panel block';
    wrap.innerHTML='<span class="eyebrow">'+escape(p.current_stage||'Projeto em andamento')+'</span><h2>'+escape(p.title)+'</h2><p>'+escape(p.client_label)+'</p><div class="projects-detail">Carregando documentos...</div>';
    el('projects').appendChild(wrap);
    const target=wrap.querySelector('.projects-detail');
    const [stages,meetings]=await Promise.all([
     result(db.from('portal_stages').select('id,label,position').eq('project_id',p.id).order('position')),
     result(db.from('portal_meetings').select('subject,starts_at,location').eq('project_id',p.id).gte('starts_at',new Date().toISOString()).order('starts_at'))
    ]);
    target.innerHTML='';
    if(meetings.length){const section=document.createElement('section');section.className='block';section.innerHTML='<h3>Próximas reuniões</h3>'+meetings.map(m=>'<div class="doc"><span>'+escape(m.subject)+' — '+escape(date(m.starts_at))+(m.location?' · '+escape(m.location):'')+'</span></div>').join('');target.appendChild(section)}
    let count=0;
    for(const stage of stages){
     const folders=await result(db.from('portal_folders').select('id,label,position').eq('stage_id',stage.id).order('position'));
     if(!folders.length)continue;
     const section=document.createElement('section');section.className='block stage';section.innerHTML='<h3>'+escape(stage.label)+'</h3>';
     for(const folder of folders){
      const docs=await result(db.from('portal_documents').select('title,storage_path').eq('folder_id',folder.id).order('created_at',{ascending:false}));
      if(!docs.length)continue;
      const box=document.createElement('div');box.innerHTML='<p class="eyebrow">'+escape(folder.label)+'</p>';
      for(const doc of docs){
       const row=document.createElement('div');row.className='doc';
       const text=document.createElement('span');text.textContent=doc.title;row.appendChild(text);
       const link=document.createElement('button');link.className='secondary';link.textContent='Baixar';
       link.addEventListener('click',async()=>{
        link.disabled=true;try{
         const {data,error}=await db.storage.from('santrelle-clientes').createSignedUrl(doc.storage_path,60);
         if(error)throw error;
         window.open(data.signedUrl,'_blank','noopener,noreferrer');
        }catch(err){alert('Não foi possível abrir este arquivo. Tente novamente.')}
        finally{link.disabled=false}
       });
       row.appendChild(link);box.appendChild(row);count++;
      }
      section.appendChild(box);
     }
     if(section.children.length>1)target.appendChild(section);
    }
    if(!count)target.insertAdjacentHTML('beforeend','<p class="empty">Ainda não há documentos liberados para consulta.</p>');
   }
  }catch(err){el('projects').textContent='Não foi possível carregar seus projetos. Tente sair e entrar novamente.';console.error('Portal:',err.message)}
 }
 async function current(){
  const {data:{user}}=await db.auth.getUser();show(!!user);if(user)await showProjects();
 }
 el('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();el('loginButton').disabled=true;message('Entrando...');
  const {error}=await db.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});
  el('loginButton').disabled=false;el('password').value='';
  if(error){message('E-mail ou senha inválidos, ou conta ainda não confirmada.');return}
  message('');await current();
 });
 el('changePassword').addEventListener('click',()=>{show(false);el('recoveryForm').classList.remove('hidden');message('Escolha uma senha nova com pelo menos 8 caracteres.')});
 el('recoveryForm').addEventListener('submit',async event=>{
  event.preventDefault();const {error}=await db.auth.updateUser({password:el('newPassword').value});
  message(error?'Não foi possível atualizar a senha.':'Senha atualizada. Faça login novamente.');
  if(!error){el('recoveryForm').classList.add('hidden');await db.auth.signOut()}
 });
 el('logout').addEventListener('click',async()=>{await db.auth.signOut();show(false)});
 db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')show(false);if(event==='PASSWORD_RECOVERY'){show(false);el('recoveryForm').classList.remove('hidden')}});
 current().catch(()=>message('Não foi possível verificar sua sessão.'));
})();
