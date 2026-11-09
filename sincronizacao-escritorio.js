/* Santrelle — sincronização compartilhada, com migração explícita e proteção contra conflitos. */
(function(){
 const KEYS=['santrelle_projects','santrelle_phases','santrelle_deliveries','santrelle_holidays','santrelle_employees','santrelle_hidden_team_members','santrelle_postobra','santrelle_portal_preview_v1'];
 let db,user,active=false,rev=0,dirty=false,writing=false,timer=null,poll=null,blocked=false,changes=0;

 let stateNode=null;
 function status(label,color){
  if(!stateNode){
   stateNode=document.createElement('div');stateNode.id='santrelleSyncStatus';
   stateNode.style.cssText='position:fixed;left:14px;bottom:13px;z-index:9998;background:#FAF8F5;border:1px solid #E2D6CB;color:#625245;border-radius:9px;padding:9px 12px;font:12px Arial,sans-serif;box-shadow:0 4px 15px #0001;max-width:300px;pointer-events:none';
   document.body.append(stateNode);
  }
  stateNode.textContent=label;stateNode.style.borderLeft='4px solid '+(color||'#8B7663');
 }
 const oldSave=save;
 const snapshot=()=>Object.fromEntries(KEYS.filter(k=>localStorage.getItem(k)!==null).map(k=>[k,JSON.parse(localStorage.getItem(k))]));
 const safeCount=()=>{try{return (JSON.parse(localStorage.getItem('santrelle_projects')||'[]')||[]).length}catch{return 0}};
 function backup(){
  const data={exportedAt:new Date().toISOString(),origin:'Santrelle - navegador',data:snapshot()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='santrelle-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
 }
 function restore(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Cópia inválida');
  const backupData=snapshot();
  try{
   KEYS.forEach(k=>{if(Object.prototype.hasOwnProperty.call(payload,k))localStorage.setItem(k,JSON.stringify(payload[k]));else localStorage.removeItem(k)});
   projects=JSON.parse(localStorage.getItem('santrelle_projects')||'[]');
   phases=JSON.parse(localStorage.getItem('santrelle_phases')||'null')||initial;
   deliveries=JSON.parse(localStorage.getItem('santrelle_deliveries')||'[]');
   extraHolidays=JSON.parse(localStorage.getItem('santrelle_holidays')||'[]');
   employees=JSON.parse(localStorage.getItem('santrelle_employees')||'[]');
   hiddenTeamMembers=JSON.parse(localStorage.getItem('santrelle_hidden_team_members')||'[]');
   postWorks=JSON.parse(localStorage.getItem('santrelle_postobra')||'[]');
   if(typeof portalPreviewData!=='undefined')portalPreviewData=JSON.parse(localStorage.getItem('santrelle_portal_preview_v1')||'{}');
   render();
  }catch(e){for(const k of KEYS){if(Object.prototype.hasOwnProperty.call(backupData,k))localStorage.setItem(k,JSON.stringify(backupData[k]));else localStorage.removeItem(k)}throw e}
 }
 function dialog(title,description,actions){
  return new Promise(resolve=>{
   let cover=document.getElementById('santrelleSyncPrompt');if(cover)cover.remove();
   cover=document.createElement('div');cover.id='santrelleSyncPrompt';
   cover.style.cssText='position:fixed;inset:0;z-index:10001;background:#3f3832bb;display:flex;align-items:center;justify-content:center;padding:20px;font:15px Arial,sans-serif';
   const box=document.createElement('section');box.style.cssText='max-width:550px;width:100%;background:#FAF8F5;border-radius:16px;padding:28px;box-shadow:0 12px 60px #0003;color:#3F3832';
   const h=document.createElement('h2');h.textContent=title;h.style.cssText='font:27px Georgia,serif;color:#625245;margin:0 0 12px';box.append(h);
   const p=document.createElement('p');p.textContent=description;p.style.cssText='line-height:1.6';box.append(p);
   const buttons=document.createElement('div');buttons.style.cssText='display:flex;flex-wrap:wrap;gap:9px;margin-top:19px';
   actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.style.cssText='padding:12px 15px;border-radius:8px;border:1px solid #8B7663;cursor:pointer;background:'+(a.primary?'#625245':'#fff')+';color:'+(a.primary?'#fff':'#625245');
    b.onclick=()=>{if(a.value==='backup'){backup();return}cover.remove();resolve(a.value)};buttons.append(b)});
   box.append(buttons);cover.append(box);document.body.append(cover);
  });
 }
 async function getRemote(){const {data,error}=await db.from('santrelle_workspace').select('payload,revision').eq('id',1).maybeSingle();if(error)throw error;return data}
 async function uploadFirst(){
  const payload=snapshot(),size=JSON.stringify(payload).length;
  if(size>4000000)throw Error('Os dados ultrapassam 4 MB. Faça o backup e revise os anexos antes da migração.');
  const {data,error}=await db.from('santrelle_workspace').insert({id:1,payload,revision:1,updated_by:user.id}).select('revision').single();
  if(error)throw error;rev=data.revision;active=true;status('Dados enviados ao Supabase ✓','#507656');startPoll();
 }
 async function flush(){
  if(!active||blocked||writing||!dirty)return;
  writing=true;status('Salvando alterações no Supabase...','#8B7663');
  try{
   const versionAtStart=changes;
   const payload=snapshot();
   if(JSON.stringify(payload).length>4000000)throw Error('Dados locais excedem 4 MB. A sincronização foi interrompida.');
   const {data,error}=await db.from('santrelle_workspace').update({payload,revision:rev+1,updated_at:new Date().toISOString(),updated_by:user.id}).eq('id',1).eq('revision',rev).select('revision');
   if(error)throw error;
   if(!data?.length){blocked=true;active=false;status('Conflito: dados não sincronizados','#A14E48');backup();alert('Outra pessoa atualizou a Santrelle ao mesmo tempo. Salvei um backup local; atualize a página para escolher a versão correta.');return}
   rev=data[0].revision;status('Sincronizado com Supabase ✓','#507656');
   dirty=changes!==versionAtStart;
   if(dirty){clearTimeout(timer);timer=setTimeout(flush,700)}
  }catch(e){blocked=true;active=false;status('Falha: dados não sincronizados','#A14E48');backup();alert('Não foi possível sincronizar com Supabase. Backup local salvo. '+e.message)}
  finally{writing=false}
 }
 function startPoll(){if(poll)clearInterval(poll);poll=setInterval(async()=>{
  if(!active||dirty||writing||blocked)return;
  try{const remote=await getRemote();if(!remote||remote.revision===rev)return;
   restore(remote.payload);rev=remote.revision;status('Atualizado pelo Supabase ✓','#507656');
  }catch(e){console.warn('Falha ao verificar atualização da Santrelle:',e)}
 },12000)}
 function markChanged(){if(!active)return;changes++;dirty=true;status('Alterações pendentes...','#B08B50');clearTimeout(timer);timer=setTimeout(flush,650)}
 save=function(){oldSave();markChanged()};
 if(typeof portalSave==='function'){
  const oldPortalSave=portalSave;
  portalSave=function(){const result=oldPortalSave();if(result!==false)markChanged();return result}
 }
 window.santrelleSyncStart=async function(client,currentUser){
  db=client;user=currentUser;active=false;blocked=false;status('Verificando banco da Santrelle...','#8B7663');
  let remote=await getRemote();
  if(!remote){
   const choice=await dialog('Primeira sincronização da Santrelle','O banco central ainda não recebeu os cadastros antigos. No computador PRINCIPAL, que possui os projetos e funcionários completos, escolha Enviar dados. Em outros computadores, escolha Voltar e acesse novamente depois.',[
    {label:'Baixar backup deste computador',value:'backup'},
    {label:'Continuar sem sincronizar por enquanto',value:'offline'},
    {label:'Enviar dados deste computador principal',value:'upload',primary:true}]);
   if(choice==='offline'){status('Modo local — não sincronizado','#A14E48');return true;}
   if(choice!=='upload')return false;
   if(!confirm('Confirma que ESTE é o computador que contém os cadastros corretos e mais completos da Santrelle? Esses dados serão usados pelos demais computadores.'))return false;
   if(safeCount()===0){alert('Não encontrei nenhum projeto neste navegador. Por segurança, faça o envio no computador principal que já contém o CIEM e os outros projetos.');status('Aguardando computador principal','#A14E48');return false}
   backup();
   await uploadFirst();return true;
  }
  const canonical=v=>JSON.stringify(v,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).sort().reduce((acc,k)=>(acc[k]=value[k],acc),{}):value);
  const local=snapshot(),different=canonical(local)!==canonical(remote.payload);
  if(different&&safeCount()>0){
   const choice=await dialog('Dados locais diferentes dos dados compartilhados','Há cadastros neste navegador que diferem do Supabase. Faça backup antes de carregar a versão central. Não serão mesclados automaticamente para evitar perda de dados.',[
    {label:'Baixar backup local',value:'backup'},
    {label:'Continuar somente neste navegador',value:'offline'},
    {label:'Carregar dados do Supabase',value:'download',primary:true}]);
   if(choice==='offline'){status('Modo local — não sincronizado','#A14E48');return true;}
   if(choice!=='download')return false;
   backup();
  }
  restore(remote.payload);rev=remote.revision;active=true;dirty=false;status('Sincronizado com Supabase ✓','#507656');startPoll();return true;
 };
 document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState!=='visible'||!active||dirty||writing||blocked)return;
  try{const remote=await getRemote();if(remote&&remote.revision!==rev){restore(remote.payload);rev=remote.revision;status('Atualizado pelo Supabase ✓','#507656')}}
  catch(e){status('Conexão instável — tentando novamente','#B08B50')}
 });
 window.addEventListener('beforeunload',e=>{if(dirty&&active){e.preventDefault();e.returnValue=''}});
})();
