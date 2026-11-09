/* Portão de entrada do aplicativo interno. Não migra nem altera o localStorage.
 * Proteção de dados reais será mantida pelo RLS quando a gestão migrar para o banco.
 */
(()=>{
 document.body.classList.add('staff-lock');
 const css=document.createElement('link');css.rel='stylesheet';css.href='staff-login.css';document.head.appendChild(css);
 const cfg=window.SANTRELLE_PORTAL_CONFIG||{};
 const markup=`<div class="santrelle-login" id="staffLoginLayer">
   <div class="santrelle-login-brand"><div class="login-mark">S</div><div class="login-wordmark">SANTRELLE</div><p>ARQUITETURA E INTERIORES</p><div class="login-line"></div><p class="login-phrase">Projetos, pessoas e processos em um só lugar.</p></div>
   <div class="santrelle-login-form"><div class="login-card"><span class="login-eyebrow">GESTÃO INTERNA</span><h1>Bem-vinda à Santrelle</h1><p>Acesse com seu e-mail e senha de colaborador.</p>
   <form id="staffForm"><label for="staffEmail">E-mail</label><input id="staffEmail" type="email" autocomplete="email" required>
   <label for="staffPassword">Senha</label><input id="staffPassword" type="password" autocomplete="current-password" required>
   <button type="submit" class="primary" id="staffEnter">Entrar no aplicativo</button></form>
   <div class="login-message" id="staffMessage" role="status"></div>
   <p class="login-help">Ainda não tem acesso? Solicite seu cadastro a um administrador da Santrelle.</p></div></div></div>`;
 document.body.insertAdjacentHTML('beforeend',markup);
 const E=id=>document.getElementById(id);
 const status=s=>{E('staffMessage').textContent=s};
 if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient){status('A configuração de acesso ainda não foi concluída.');return}
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 let currentUser=null;
 async function verify(){
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user){lock();return}
  const {data:staff,error:staffError}=await db.from('portal_staff').select('role').eq('user_id',user.id).maybeSingle();
  if(staffError||!staff){lock();status('Sua conta não está autorizada para o aplicativo interno.');return}
  try{
   if(typeof window.santrelleSyncStart==='function'){
    const ready=await window.santrelleSyncStart(db,user);
    if(!ready){lock();status('Sincronização não concluída. Atualize a página para escolher novamente.');return}
   }
  }catch(syncError){lock();status('Não foi possível iniciar a sincronização: '+syncError.message);return}
  currentUser=user;
  document.body.classList.remove('staff-lock');
  E('staffLoginLayer').hidden=true;
  let button=E('staffLogout');
  if(!button){button=document.createElement('button');button.id='staffLogout';button.className='staff-logout';document.body.appendChild(button)}
  button.textContent='Sair · '+user.email;
  button.hidden=false;
  button.onclick=async()=>{await db.auth.signOut();lock();location.reload()};
 }
 function lock(){currentUser=null;document.body.classList.add('staff-lock');E('staffLoginLayer').hidden=false;const b=E('staffLogout');if(b)b.hidden=true}
 E('staffForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=E('staffEnter');button.disabled=true;status('Verificando acesso...');
  try{
   const {error}=await db.auth.signInWithPassword({email:E('staffEmail').value.trim(),password:E('staffPassword').value});
   E('staffPassword').value='';
   if(error){status('E-mail ou senha inválidos.');return}
   await verify();
  }catch(err){status('Não foi possível conectar ao serviço de autenticação.')}
  finally{button.disabled=false}
 });
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')lock()});
 verify().catch(()=>status('Não foi possível verificar sua sessão.'));
})();
