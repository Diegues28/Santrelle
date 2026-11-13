/* Ações do cliente na prévia interna da Santrelle.
   A senha de exclusão nunca é armazenada ou comparada no navegador. */
(()=>{
 const E=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const client=()=>{
  const cfg=window.SANTRELLE_PORTAL_CONFIG||{};
  if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient)throw Error('Autenticação do Supabase indisponível.');
  return window.supabase.createClient(cfg.url,cfg.publishableKey);
 };
 function passwordDialog(title,fields){
  return new Promise(resolve=>{
   const cover=document.createElement('div');
   cover.style.cssText='position:fixed;inset:0;z-index:12000;background:#312a26aa;display:flex;align-items:center;justify-content:center;padding:16px';
   const form=document.createElement('form');
   form.style.cssText='background:#FAF8F5;color:#3F3832;max-width:440px;width:100%;border-radius:13px;padding:25px;box-shadow:0 10px 30px #0003;font:14px Arial';
   const h=document.createElement('h2');h.textContent=title;form.append(h);
   const inputs={};
   for(const f of fields){
    const label=document.createElement('label');label.textContent=f.label;label.style.cssText='display:block;margin-top:15px';
    const input=document.createElement('input');input.type='password';input.required=true;input.autocomplete='off';input.style.cssText='width:100%;margin-top:6px;padding:12px;border:1px solid #CFBEB0;border-radius:7px';
    input.minLength=f.min||1;label.append(input);form.append(label);inputs[f.key]=input;
   }
   const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:12px;justify-content:flex-end;margin-top:22px';
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.className='secondary';
   const submit=document.createElement('button');submit.type='submit';submit.textContent='Confirmar';submit.className='primary';
   const finish=v=>{cover.remove();resolve(v)};
   cancel.onclick=()=>finish(null);
   form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value]));for(const v of Object.values(inputs))v.value='';finish(data)};
   buttons.append(cancel,submit);form.append(buttons);cover.append(form);document.body.append(cover);Object.values(inputs)[0].focus();
  });
 }
 window.portalClientActionsHTML=function(p){
  const done=p.status==='Concluído',hasWork=!!pwByProject(p.id);
  return '<section class="panel client-portal-admin-section"><h3>Conclusão e pós-obra</h3>'+
    '<p class="muted">Finalize o projeto e mantenha sua ficha, prazos e histórico. O pós-obra será aberto com o mesmo cadastro do cliente, sem duplicação.</p>'+
    '<button class="primary" onclick="portalConcludeClientProject('+JSON.stringify(String(p.id)).replace(/"/g,'&quot;')+')">'+
    (done?(hasWork?'Abrir acompanhamento de pós-obra':'Iniciar pós-obra do projeto concluído'):'Concluir projeto e encaminhar para Pós-obra')+'</button>'+
    (done?'<p class="muted">Projeto concluído e preservado em Projetos concluídos.</p>':'')+
    '</section>'+
    '<section class="panel client-portal-admin-section" style="border-color:#E5C9C2">'+
    '<h3>Excluir cliente</h3><p class="muted">Ação restrita ao administrador. A exclusão do cadastro e do histórico interno depende da senha de exclusão e de uma confirmação adicional. Para finalizar normalmente, use a opção de pós-obra acima.</p>'+
    '<div class="inline"><button class="secondary" onclick="portalConfigureDeletionPassword()">Cadastrar / trocar senha de exclusão</button>'+
    '<button class="secondary" style="color:#963F35;border-color:#DAB0A8" onclick="portalDeleteClientProject('+JSON.stringify(String(p.id)).replace(/"/g,'&quot;')+')">Excluir cliente definitivamente</button></div>'+
    '</section>';
 };
 window.portalConcludeClientProject=function(id){
  const p=projects.find(x=>String(x.id)===String(id));if(!p)return;
  const existing=pwByProject(p.id);
  if(p.status!=='Concluído'){
   if(!confirm('Concluir o projeto de '+(p.clientRegistration?.name||p.client||p.name)+' e encaminhar para Pós-obra?\n\nO cadastro, o cronograma e os documentos da prévia serão preservados.'))return;
   changeProjectStatus(p,'Concluído','Concluído pela Área do Cliente e encaminhado ao Pós-obra');
  }else if(!existing&&!confirm('Iniciar acompanhamento de Pós-obra para este projeto concluído?'))return;
  let w=existing;
  if(!w){w={id:pwId(),projectId:p.id,createdAt:pwNow(),closedAt:null,items:[]};postWorks.push(w)}
  const config=portalPrefs(p.id);
  config.stage='Pós-obra';
  save();
  portalSave();
  pwOpen(w.id);
 };
 window.portalConfigureDeletionPassword=async function(){
  try{
   const db=client();
   const {data:configured,error}=await db.rpc('santrelle_deletion_password_configured');
   if(error)throw error;
   const fields=configured?[{key:'old',label:'Senha atual'},{key:'new',label:'Nova senha de exclusão',min:10},{key:'confirm',label:'Confirmar nova senha',min:10}]:
    [{key:'new',label:'Cadastrar senha de exclusão (mínimo 10 caracteres)',min:10},{key:'confirm',label:'Confirmar senha',min:10}];
   const values=await passwordDialog(configured?'Trocar senha de exclusão':'Cadastrar senha de exclusão',fields);
   if(!values)return;
   if(values.new!==values.confirm)throw Error('A confirmação da nova senha não confere.');
   const {data,error:saveError}=await db.rpc('santrelle_set_deletion_password',{p_new_password:values.new,p_current_password:values.old||null});
   if(saveError||!data)throw saveError||Error('Senha não cadastrada.');
   alert('Senha administrativa cadastrada com segurança no Supabase.');
  }catch(err){alert('Não foi possível configurar a senha: '+err.message)}
 };
 window.portalDeleteClientProject=async function(id){
  const p=projects.find(x=>String(x.id)===String(id));if(!p)return;
  if(!window.santrelleSyncReadyForDestructiveAction?.()){
   alert('Para excluir, primeiro é necessário estar com o Supabase sincronizado e sem alterações pendentes. Confira o indicador e tente novamente.');return;
  }
  const name=String(p.clientRegistration?.name||p.client||p.name||'Cliente').trim();
  const confirmation=prompt('ATENÇÃO: esta ação exclui o projeto de '+name+' e seus registros internos de Pós-obra e entregas.\n\nPara continuar, digite EXCLUIR:');
  if(confirmation!=='EXCLUIR')return;
  const values=await passwordDialog('Senha administrativa para excluir '+name,[{key:'password',label:'Senha de exclusão'}]);
  if(!values)return;
  try{
   const db=client();
   const {data,error}=await db.rpc('santrelle_delete_workspace_project',{p_project_id:String(p.id),p_password:values.password});
   values.password='';
   if(error)throw error;
   if(data!==true)throw Error('Senha incorreta. Nenhuma informação foi excluída.');
   if(!window.santrelleSyncReloadFromCloud)throw Error('Exclusão concluída no Supabase. Reabra a página e carregue os dados da nuvem.');
   portalProjectId=null;portalView='manager';portalFolderId=null;selected=null;page='portal';
   await window.santrelleSyncReloadFromCloud();
   render();
   alert('Cadastro excluído do banco compartilhado. Uma cópia de recuperação administrativa foi preservada.');
  }catch(err){alert('A exclusão não foi aplicada neste navegador: '+err.message)}
 };
})();