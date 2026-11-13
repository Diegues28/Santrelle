/* Gestão de e-mails e desligamento: uso restrito a administradores. */
(()=>{
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const database=()=>{
  const cfg=window.SANTRELLE_PORTAL_CONFIG||{};
  if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient)throw Error('A conexão com o Supabase não está disponível.');
  return window.supabase.createClient(cfg.url,cfg.publishableKey);
 };
 window.teamSetEmployeeEmail=function(owner){
  if(!window.santrelleIsAdmin){alert('Somente administradores podem configurar e-mails.');return}
  const key=teamMemberKey(owner);
  const existing=employees.find(e=>teamMemberKey(e.name)===key);
  const raw=prompt('Cadastrar o e-mail de acesso de '+owner+':\n\nO cadastro do e-mail não cria senha automaticamente.',String(existing?.email||''));
  if(raw===null)return;
  const email=raw.trim().toLowerCase();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){alert('Informe um endereço de e-mail válido.');return}
  if(email&&employees.some(e=>teamMemberKey(e.name)!==key&&String(e.email||'').trim().toLowerCase()===email)){
   alert('Esse e-mail já pertence a outro funcionário.');return;
  }
  const old=employees.map(e=>({...e}));
  if(existing)existing.email=email;
  else employees.push({name:owner,email});
  hiddenTeamMembers=hiddenTeamMembers.filter(k=>k!==key);
  try{save();render();alert('E-mail registrado para o funcionário. Para ele entrar, ainda será necessário ativar a conta no Supabase Auth com uma senha definida posteriormente.')}
  catch(err){employees=old;alert('Não foi possível salvar o e-mail: '+err.message)}
 };
 function askDeletion(name,targets){
  return new Promise(resolve=>{
   const overlay=document.createElement('div');
   overlay.style.cssText='position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px;background:#302720b8';
   const form=document.createElement('form');
   form.style.cssText='width:min(100%,490px);padding:25px;border-radius:14px;background:#FAF8F5;box-shadow:0 20px 60px #0003;color:#3F3832;font:14px Arial,sans-serif';
   const h=document.createElement('h2');h.textContent='Excluir funcionário · '+name;h.style.marginTop='0';form.append(h);
   const p=document.createElement('p');p.textContent='Escolha quem receberá as responsabilidades antes de remover o funcionário. Projetos, tarefas, prazos e históricos permanecem cadastrados.';p.style.lineHeight='1.6';form.append(p);
   const label=document.createElement('label');label.textContent='Transferir responsabilidades para';label.style.cssText='display:block;font-weight:600;margin-top:14px';
   const select=document.createElement('select');select.style.cssText='width:100%;padding:12px;margin:8px 0 16px;border:1px solid #DDD0C3;border-radius:7px';
   const no=document.createElement('option');no.value='';no.textContent='Não transferir (manter atribuições históricas)';select.append(no);
   for(const person of targets){const opt=document.createElement('option');opt.value=person;opt.textContent=person;select.append(opt)}
   label.append(select);form.append(label);
   const passwordLabel=document.createElement('label');passwordLabel.textContent='Senha administrativa de exclusão';passwordLabel.style.cssText='display:block;font-weight:600';
   const pwd=document.createElement('input');pwd.type='password';pwd.autocomplete='off';pwd.required=true;pwd.style.cssText='display:block;width:100%;padding:12px;margin-top:8px;border:1px solid #DDD0C3;border-radius:7px';
   passwordLabel.append(pwd);form.append(passwordLabel);
   const hint=document.createElement('p');hint.textContent='É a mesma senha usada para excluir clientes, cadastrada em Configurações gerais.';hint.style.cssText='color:#817164;font-size:12px;line-height:1.5';form.append(hint);
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:24px';
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.className='secondary';
   const confirm=document.createElement('button');confirm.type='submit';confirm.textContent='Confirmar exclusão';confirm.className='primary';
   const close=value=>{pwd.value='';overlay.remove();resolve(value)};
   cancel.onclick=()=>close(null);
   form.onsubmit=e=>{e.preventDefault();close({password:pwd.value,replacement:select.value})};
   actions.append(cancel,confirm);form.append(actions);overlay.append(form);document.body.append(overlay);select.focus();
  })
 }
 window.teamDeleteEmployeeSecure=async function(name){
  if(!window.santrelleIsAdmin){alert('Somente administradores podem excluir funcionários.');return}
  const member=employees.find(e=>teamMemberKey(e.name)===teamMemberKey(name));
  if(!member){alert('Esse nome aparece no histórico, mas não está no cadastro da Equipe. Cadastre primeiro o funcionário para organizar sua exclusão.');return}
  if(!window.santrelleSyncReadyForDestructiveAction?.()){
   alert('Aguarde o indicador Sincronizado com Supabase antes de excluir funcionários.');return;
  }
  const targets=employees.filter(e=>teamMemberKey(e.name)!==teamMemberKey(name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const choices=await askDeletion(name,targets);
  if(!choices)return;
  if(!confirm('Confirma a exclusão de '+name+'?'+(choices.replacement?'\n\nTodas as responsabilidades atribuídas a esse funcionário passarão para '+choices.replacement+'.':'\n\nAs responsabilidades continuarão com o nome histórico, sem redistribuição.')+'\n\nA operação altera o banco compartilhado e não exclui os projetos.'))return;
  try{
   const db=database();
   const {data,error}=await db.rpc('santrelle_remove_employee',{p_employee_name:name,p_replacement_name:choices.replacement,p_password:choices.password});
   choices.password='';
   if(error)throw error;
   if(!data)throw Error('Senha administrativa incorreta. A exclusão foi cancelada.');
   teamSelectedOwner=null;
   await window.santrelleSyncReloadFromCloud();
   render();
   alert('Funcionário removido do cadastro da Equipe.'+(choices.replacement?' Responsabilidades transferidas para '+choices.replacement+'.':' As atribuições históricas foram preservadas.')+'\n\nSe o funcionário tinha acesso comum associado a esse e-mail, a permissão interna foi revogada no Supabase. A conta de autenticação continua existente; acessos administradores exigem revisão separada.');
  }catch(err){choices.password='';alert('Não foi possível excluir o funcionário: '+err.message)}
 };
})();