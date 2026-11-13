/* Santrelle — sincronização compartilhada, com migração explícita e proteção contra conflitos. */
(function(){
 const KEYS=['santrelle_projects','santrelle_phases','santrelle_deliveries','santrelle_holidays','santrelle_employees','santrelle_hidden_team_members','santrelle_postobra','santrelle_portal_preview_v1','santrelle_office_settings'];
 let db,user,active=false,rev=0,dirty=false,writing=false,timer=null,poll=null,blocked=false,changes=0,basePayload=null;

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
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function preserveRecovery(data,reason){
  try{
   localStorage.setItem('santrelle_local_recovery_snapshot',JSON.stringify({
    savedAt:new Date().toISOString(),reason,data
   }));
  }catch(e){console.warn('Cópia local não pôde ser armazenada',e)}
 }
 function recordKey(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  if(v.id!==undefined&&v.id!==null)return 'id:'+String(v.id);
  if(typeof v.name==='string'&&v.name)return 'name:'+v.name.toLocaleLowerCase('pt-BR');
  if(typeof v.date==='string'&&typeof v.owner==='string'&&typeof v.title==='string')return 'entry:'+v.date+'|'+v.owner+'|'+v.title;
  return null;
 }
 function mergeThree(base,local,remote){
  if(equal(local,base))return remote;
  if(equal(remote,base)||equal(local,remote))return local;
  if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)){
   const all=[...base,...remote,...local],keys=all.map(recordKey);
   if(keys.every(Boolean)&&new Set(keys).size>=Math.max(base.length,remote.length,local.length)){
    const bm=new Map(base.map(v=>[recordKey(v),v])),lm=new Map(local.map(v=>[recordKey(v),v])),rm=new Map(remote.map(v=>[recordKey(v),v]));
    const result=[];
    for(const key of [...new Set([...rm.keys(),...lm.keys(),...bm.keys()])]){
     const b=bm.get(key),l=lm.get(key),r=rm.get(key);
     if(l===undefined&&b!==undefined){if(r!==undefined&&!equal(r,b))result.push(r);continue}
     if(r===undefined&&b!==undefined){if(l!==undefined&&!equal(l,b))result.push(l);continue}
     if(l===undefined){if(r!==undefined)result.push(r);continue}
     if(r===undefined){result.push(l);continue}
     result.push(mergeThree(b,l,r));
    }
    return result;
   }
  }
  if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){
   const result={};
   for(const key of new Set([...Object.keys(base||{}),...Object.keys(remote),...Object.keys(local)])){
    const b=base?.[key],l=local[key],r=remote[key];
    if(!(key in local)){if(b===undefined&&r!==undefined)result[key]=r;else if(r!==undefined&&!equal(r,b))result[key]=r;continue}
    if(!(key in remote)){if(b===undefined||!equal(l,b))result[key]=l;continue}
    result[key]=mergeThree(b,l,r);
   }
   return result;
  }
  return local;
 }
 async function flush(){
  if(!active||blocked||writing||!dirty)return;
  writing=true;status('Salvando alterações no Supabase...','#8B7663');
  try{
   let payload=snapshot(),versionAtStart=changes,updated=false;
   const originalLocal=structuredClone(payload);
   for(let attempt=0;attempt<4;attempt++){
    if(JSON.stringify(payload).length>4000000)throw Error('Dados locais excedem 4 MB.');
    const {data,error}=await db.from('santrelle_workspace').update({
     payload,revision:rev+1,updated_at:new Date().toISOString(),updated_by:user.id
    }).eq('id',1).eq('revision',rev).select('revision');
    if(error)throw error;
    if(data?.length){
     rev=data[0].revision;basePayload=structuredClone(payload);updated=true;
     // Atualiza o navegador com eventos que foram mesclados de outros usuários.
     // Se houve uma edição local durante o envio, preserva-a sobre a versão gravada.
     const changedDuringUpload=changes!==versionAtStart;
     const latestLocal=changedDuringUpload?mergeThree(originalLocal,snapshot(),payload):payload;
     restore(latestLocal);
     dirty=changedDuringUpload;
     status(dirty?'Alterações pendentes...':'Sincronizado com Supabase ✓',dirty?'#B08B50':'#507656');
     if(dirty){clearTimeout(timer);timer=setTimeout(flush,700)}
     break;
    }
    const remote=await getRemote();
    if(!remote)throw Error('O banco compartilhado não está disponível.');
    // Em alterações simultâneas, mescla o trabalho sobre a última versão central.
    // Se a mesma propriedade foi alterada pelas duas pessoas, prevalece a alteração
    // deste computador, com cópia local para recuperação.
    preserveRecovery({local:payload,remote:remote.payload},'Mesclagem de alterações simultâneas');
    payload=mergeThree(basePayload||{},payload,remote.payload||{});
    rev=remote.revision;basePayload=structuredClone(remote.payload);
    versionAtStart=changes;
   }
   if(!updated)throw Error('Não foi possível conciliar as alterações simultâneas.');
  }catch(e){
   blocked=true;active=false;
   preserveRecovery(snapshot(),'Falha de sincronização: '+e.message);
   status('Sincronização pendente — recarregue para reconectar','#A14E48');
   console.error('Falha de sincronização da Santrelle:',e);
  }finally{writing=false}
 }
 function startPoll(){if(poll)clearInterval(poll);poll=setInterval(async()=>{
  if(!active||dirty||writing||blocked)return;
  try{const remote=await getRemote();if(!remote||remote.revision===rev)return;
   restore(remote.payload);rev=remote.revision;basePayload=structuredClone(remote.payload);status('Atualizado pelo Supabase ✓','#507656');
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
  // O Supabase é a fonte única dos dados. Nenhum computador precisa confirmar
  // migração ou escolher entre versões quando entra no aplicativo.
  const remote=await getRemote();
  if(!remote){
   status('Banco central indisponível — acesso bloqueado','#A14E48');
   throw Error('O banco compartilhado da Santrelle não foi encontrado. Nenhuma versão local foi enviada; peça ao administrador para verificar o Supabase.');
  }
  const canonical=v=>JSON.stringify(v,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).sort().reduce((acc,k)=>(acc[k]=value[k],acc),{}):value);
  const local=snapshot();
  if(Object.keys(local).length&&canonical(local)!==canonical(remote.payload)){
   // Preserva dados divergentes sem interromper a entrada nem substituir a nuvem.
   // Guarda apenas uma versão anterior por navegador; não faz download automático.
   try{
    const saved=JSON.parse(localStorage.getItem('santrelle_local_recovery_snapshot')||'null');
    if(!saved||canonical(saved.data)!==canonical(local)){
     localStorage.setItem('santrelle_local_recovery_snapshot',JSON.stringify({
      savedAt:new Date().toISOString(),reason:'Dados antigos encontrados antes da sincronização automática',data:local
     }));
    }
   }catch(e){console.warn('Cópia local de recuperação não disponível',e)}
  }
  restore(remote.payload);
  rev=remote.revision;basePayload=structuredClone(remote.payload);
  active=true;dirty=false;blocked=false;
  status('Sincronizado com Supabase ✓','#507656');
  startPoll();
  return true;
 };
 document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState!=='visible'||!active||dirty||writing||blocked)return;
  try{const remote=await getRemote();if(remote&&remote.revision!==rev){restore(remote.payload);rev=remote.revision;basePayload=structuredClone(remote.payload);status('Atualizado pelo Supabase ✓','#507656')}}
  catch(e){status('Conexão instável — tentando novamente','#B08B50')}
 });
 window.santrelleSyncReadyForDestructiveAction=()=>!!(active&&!dirty&&!writing&&!blocked);
 window.santrelleSyncReloadFromCloud=async()=>{
  if(dirty||writing||blocked)throw Error('Há alterações locais pendentes. Aguarde a sincronização antes de atualizar.');
  const remote=await getRemote();if(!remote)throw Error('Banco compartilhado indisponível.');
  restore(remote.payload);rev=remote.revision;basePayload=structuredClone(remote.payload);active=true;dirty=false;status('Sincronizado com Supabase ✓','#507656');return true;
 };
 window.addEventListener('beforeunload',e=>{if(dirty&&active){e.preventDefault();e.returnValue=''}});
})();
