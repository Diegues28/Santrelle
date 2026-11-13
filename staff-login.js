/* Portão de entrada do aplicativo interno. Não migra nem altera o localStorage.
 * Proteção de dados reais será mantida pelo RLS quando a gestão migrar para o banco.
 */
(()=>{
 window.santrelleIsAdmin=false;
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
  const {data:pendingRecord,error:pendingError}=await db.from('santrelle_first_access')
    .select('must_change_password').eq('user_id',user.id).maybeSingle();
  if(pendingError){lock();status('Não foi possível validar a senha provisória.');return}
  if(pendingRecord?.must_change_password){
   lock();E('staffLoginLayer').hidden=true;showPasswordChange();return;
  }
  try{
   if(typeof window.santrelleSyncStart==='function'){
    const ready=await window.santrelleSyncStart(db,user);
    if(!ready){lock();status('Sincronização não concluída. Atualize a página para escolher novamente.');return}
   }
  }catch(syncError){lock();status('Não foi possível iniciar a sincronização: '+syncError.message);return}
  currentUser=user;
  window.santrelleIsAdmin=staff.role==='admin';
  document.body.classList.toggle('santrelle-admin-verified',window.santrelleIsAdmin);
  if(typeof render==='function')render();
  document.body.classList.remove('staff-lock');
  E('staffLoginLayer').hidden=true;
  let button=E('staffLogout');
  if(!button){button=document.createElement('button');button.id='staffLogout';button.className='staff-logout';document.body.appendChild(button)}
  button.textContent='Sair · '+user.email;
  button.hidden=false;
  button.onclick=async()=>{await db.auth.signOut();lock();location.reload()};
 }
 async function showPasswordChange(){
  if(document.getElementById('staffFirstPasswordLayer'))return;
  const wrap=document.createElement('div');wrap.id='staffFirstPasswordLayer';
  wrap.style.cssText='position:fixed;inset:0;z-index:20002;background:#203b3deb;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,Arial,sans-serif';
  wrap.innerHTML='<form id="staffFirstPasswordForm" style="background:#FAF8F5;width:100%;max-width:470px;padding:30px;border-radius:16px;color:#3F3832;box-shadow:0 20px 75px #0004">'+
   '<h2 style="font:26px Georgia,serif;margin:0 0 10px">Altere sua senha provisória</h2>'+
   '<p style="line-height:1.6;color:#625245">Este é seu primeiro acesso. Crie uma senha pessoal para continuar. Ela deve ter ao menos 12 caracteres, com letras e números. Não compartilhe sua senha.</p>'+
   '<label style="display:block;margin:18px 0 7px">Nova senha</label>'+
   '<input id="staffFirstNewPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required style="width:100%;padding:12px;border:1px solid #CFC3B9;border-radius:8px">'+
   '<label style="display:block;margin:18px 0 7px">Confirme a nova senha</label>'+
   '<input id="staffFirstConfirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required style="width:100%;padding:12px;border:1px solid #CFC3B9;border-radius:8px">'+
   '<p id="staffFirstPasswordMessage" role="alert" style="color:#A14E48;min-height:20px;margin:13px 0"></p>'+
   '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">'+
   '<button id="staffFirstLogout" type="button" class="secondary">Sair</button>'+
   '<button id="staffFirstSubmit" type="submit" class="primary">Salvar minha senha</button></div></form>';
  document.body.append(wrap);
  const form=wrap.querySelector('form'),message=wrap.querySelector('#staffFirstPasswordMessage');
  wrap.querySelector('#staffFirstLogout').onclick=async()=>{await db.auth.signOut();wrap.remove();lock();location.reload()};
  form.onsubmit=async(event)=>{
   event.preventDefault();
   const first=wrap.querySelector('#staffFirstNewPassword');
   const second=wrap.querySelector('#staffFirstConfirmPassword');
   const password=first.value;
   if(password!==second.value){message.textContent='As senhas digitadas não coincidem.';return}
   if(password.length<12||!/[A-Za-zÀ-ÿ]/.test(password)||!/[0-9]/.test(password)){
    message.textContent='Use pelo menos 12 caracteres, com letras e números.';return;
   }
   const button=wrap.querySelector('#staffFirstSubmit');button.disabled=true;message.textContent='Salvando senha pessoal...';
   try{
    const {data,error}=await db.functions.invoke('trocar-senha-provisoria',{body:{newPassword:password}});
    first.value='';second.value='';
    if(error||!data?.ok)throw Error(data?.error||error?.message||'Não foi possível alterar a senha.');
    wrap.remove();
    await verify();
   }catch(err){message.textContent=err.message||'Não foi possível alterar a senha.'}
   finally{button.disabled=false}
  };
  wrap.querySelector('#staffFirstNewPassword').focus();
 }
 function lock(){currentUser=null;window.santrelleIsAdmin=false;document.body.classList.remove('santrelle-admin-verified');document.body.classList.add('staff-lock');E('staffLoginLayer').hidden=false;const b=E('staffLogout');if(b)b.hidden=true}
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
