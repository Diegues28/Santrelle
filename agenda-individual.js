/* Agenda do painel por colaborador, com preferências por conta e eventos pessoais em tabela separada. */
(()=>{
 const state={db:null,user:null,role:'colaborador',selfName:'',visibleOwners:[],events:[],googleEvents:[],googleStatus:'',loaded:false,poll:null,syncPoll:null,syncBusy:false};
 const normalize=s=>String(s||'').trim().toLocaleLowerCase('pt-BR');
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'');
 const isAdmin=()=>state.role==='admin';
 const colleagues=()=>Array.from(new Set(employees.map(e=>e.name).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
 function myName(){
  const emp=employees.find(e=>normalize(e.email)===normalize(state.user?.email));
  return emp?.name||'';
 }
 function allowed(name){return !!name&&(isAdmin()?(!state.visibleOwners.includes('__none__')&&(state.visibleOwners.length===0||state.visibleOwners.some(n=>normalize(n)===normalize(name)))):normalize(name)===normalize(state.selfName))}
 function ownEvents(){
  return state.events.filter(e=>e.user_id===state.user?.id);
 }
 function calendarEventEntries(){
  return state.events.filter(e=>{
   if(e.user_id===state.user?.id)return true;
   if(!isAdmin()||e.private)return false;
   return allowed(e.staff_name);
  }).map(e=>({
   id:'evt'+e.id,kind:'appointment',name:e.title+(e.event_time?' · '+String(e.event_time).slice(0,5):''),
   owner:e.user_id===state.user?.id?(state.selfName||'Minha agenda'):(e.staff_name||'Equipe'),
   date:e.event_date,completed:false,private:e.private,userId:e.user_id,
   eventId:e.id,category:e.category
  }));
 }
 function googleEntries(){
  return state.googleEvents.filter(e=>{
    if(e.is_deleted)return false;
    if(isAdmin())return !state.visibleOwners.includes('__none__')&&
     (state.visibleOwners.length===0||e.assigned_owner&&allowed(e.assigned_owner));
    return !!state.selfName&&normalize(e.assigned_owner)===normalize(state.selfName);
  }).map(e=>({
    id:'google'+e.google_id,kind:'google',name:'Google: '+e.title+(e.event_time?' · '+String(e.event_time).slice(0,5):''),
    owner:e.assigned_owner||'Agenda central',date:e.event_date,completed:false,
    googleId:e.google_id,googleLocation:e.location||'',googleDescription:e.description||''
  }));
 }
 async function loadGoogleEvents(){
  if(!state.db||!state.user)return;
  const {data,error}=await state.db.from('santrelle_google_events')
   .select('google_id,title,event_date,event_time,end_date,end_time,location,description,assigned_owner,is_deleted')
   .gte('event_date','2025-01-01').order('event_date',{ascending:true}).limit(2000);
  if(error){console.warn('Não foi possível consultar eventos do Google',error.message);return}
  state.googleEvents=data||[];
 }
 window.santrelleGoogleEventOpen=async function(id){
  const e=state.googleEvents.find(x=>x.google_id===id);if(!e)return;
  const detail=e.title+'\\n'+e.event_date+(e.event_time?' às '+String(e.event_time).slice(0,5):'')+
   (e.location?'\\nLocal: '+e.location:'')+(e.description?'\\n'+e.description:'');
  if(!isAdmin()){alert(detail);return}
  const choices=colleagues();
  const selected=prompt(detail+'\\n\\nPara atribuir esta reunião a alguém, escreva o nome exato do funcionário.\\n'+
   'Funcionários: '+choices.join(', ')+'\\nDeixe vazio para a agenda geral.',e.assigned_owner||'');
  if(selected===null)return;
  const name=selected.trim();
  if(name&&!choices.some(x=>normalize(x)===normalize(name))){alert('Selecione um nome cadastrado na Equipe.');return}
  const {data,error}=await state.db.rpc('santrelle_google_set_event_owner',{p_google_id:id,p_owner:name});
  if(error||!data){alert('Não foi possível atribuir o compromisso: '+(error?.message||'Evento não encontrado'));return}
  await loadGoogleEvents();render();
 };
 window.santrelleGoogleSyncNow=async function(silent=false){
  if(!state.db||!state.user||state.syncBusy)return;
  state.syncBusy=true;
  try{
   const {data,error}=await state.db.functions.invoke('google-calendar-sync',{body:{}});
   if(error||data?.error)throw Error(data?.error||error?.message||'Falha de comunicação');
   if(data?.busy)return;
   if(!data?.connected){state.googleStatus='Google Agenda ainda não conectado';return}
   state.googleStatus='Última atualização: '+new Date().toLocaleString('pt-BR')+
    ' · '+(data.imported||0)+' eventos atualizados · '+(data.pushed||0)+' enviados';
   await loadGoogleEvents();
   await reloadEvents();
   if(typeof render==='function')render();
   if(!silent)alert('Google Agenda sincronizado com a Santrelle!\\n'+
    (data.imported||0)+' eventos importados/atualizados e '+(data.pushed||0)+' eventos enviados.');
  }catch(err){
   state.googleStatus='Sincronização do Google pendente: '+(err.message||String(err));
   console.warn(state.googleStatus);
   if(!silent)alert(state.googleStatus);
  }finally{state.syncBusy=false}
 };
 window.santrelleGoogleSyncStatus=()=>state.googleStatus||'Sincronização periódica com o Google enquanto o aplicativo estiver aberto.';
 function clientMeetings(){
  const result=[];
  if(typeof portalPreviewData==='undefined')return result;
  for(const p of projects){
   if(p.status==='Concluído')continue;
   const config=portalPreviewData[String(p.id)];
   if(!Array.isArray(config?.meetings))continue;
   for(const meeting of config.meetings){
    if(!validDate(meeting.date))continue;
    const owner=String(meeting.owner||'');
    if(!owner&&!isAdmin())continue;
    if(owner&&!allowed(owner))continue;
    if(!owner&&isAdmin()&&state.visibleOwners.includes('__none__'))continue;
    result.push({id:'meet'+p.id+'_'+meeting.id,kind:'meeting',name:'Reunião: '+(meeting.subject||'Cliente')+' · '+p.name+
     (meeting.time?' · '+meeting.time:''),owner:owner||'Sem responsável',date:meeting.date,
     projectId:p.id,meetingId:meeting.id,completed:false});
   }
  }
  return result;
 }
 window.santrelleCalendarOpenMeeting=function(projectId,meetingId){
  const c=portalPreviewData?.[String(projectId)];
  const m=c?.meetings?.find(x=>String(x.id)===String(meetingId));
  if(!m)return;
  alert('Reunião: '+m.subject+'\\nData: '+m.date+(m.time?' às '+m.time:'')+
   (m.place?'\\nLocal: '+m.place:'')+(m.owner?'\\nResponsável: '+m.owner:''));
 };
 // Entries already assigned to an owner; a synthetic owner "Equipe" is not an individual's assignment.
 function scoped(entries){
  if(!state.user)return [];
  const office=entries.filter(e=>{
   if(allowed(e.owner))return true;
   if(!isAdmin())return false;
   if(state.visibleOwners.includes('__none__'))return false;
   if(state.visibleOwners.length===0)return true;
   const project=projects.find(p=>String(p.id)===String(e.projectId));
   return project?projectAssignedOwners(project).some(name=>allowed(name)):false;
  });
  return office.concat(clientMeetings(),calendarEventEntries(),googleEntries());
 }
 window.santrelleCalendarVisibleEntries=scoped;
 window.santrelleCalendarScopeLabel=()=>isAdmin()?'Agendas da equipe selecionadas':state.selfName?'Minha agenda · '+state.selfName:'Minha agenda · e-mail não vinculado à Equipe';
 window.santrelleCalendarIsAdmin=isAdmin;
 window.santrelleCalendarOwnName=()=>state.selfName;
 window.santrelleCalendarHasStaffMapping=()=>!!state.selfName;
 window.santrelleCalendarOwnerControls=function(){
  if(!isAdmin())return '';
  const choices=colleagues();
  return '<div class="cal-team-select"><strong style="display:block;margin-bottom:8px">Agendas visíveis (administrador)</strong>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap">'+
    choices.map(n=>'<label style="display:flex;gap:5px;align-items:center;font-size:13px"><input type="checkbox" '+((state.visibleOwners.length===0||state.visibleOwners.some(x=>normalize(x)===normalize(n)))&&!state.visibleOwners.includes('__none__')?'checked':'')+' onchange="santrelleCalendarToggleOwner('+JSON.stringify(n).replace(/"/g,'&quot;')+',this.checked)">'+escape(n)+'</label>').join('')+
    '</div><p class="muted" style="font-size:12px;margin:6px 0 0">Desmarque uma agenda para ocultá-la apenas do seu painel. Os dados originais não são alterados.</p></div>';
 };
 window.santrelleCalendarToggleOwner=async function(name,checked){
  if(!isAdmin())return;
  const options=colleagues();
  const current=state.visibleOwners.length?new Set(state.visibleOwners.filter(x=>x!=='__none__')):new Set(options);
  if(checked)current.add(name);else current.delete(name);
  state.visibleOwners=current.size?[...current]:['__none__'];
  const {error}=await state.db.from('santrelle_calendar_preferences').upsert({user_id:state.user.id,visible_owner_names:state.visibleOwners,updated_at:new Date().toISOString()});
  if(error)alert('Não foi possível salvar a seleção de agendas: '+error.message);
  render();
 };
 window.santrelleCalendarNewEvent=async function(){
  if(!state.user){alert('Faça login para cadastrar compromissos.');return}
  const title=prompt('Nome do compromisso ou reunião:');
  if(!title?.trim())return;
  const date=prompt('Data (AAAA-MM-DD):',new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}));
  if(date===null)return;
  if(!validDate(date)){alert('Data inválida. Use AAAA-MM-DD.');return}
  const time=prompt('Horário (HH:MM, opcional):','');
  if(time===null)return;
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){alert('Horário inválido.');return}
  const kind=prompt('Tipo: reunião, compromisso ou pessoal','compromisso');
  if(kind===null)return;
  const category=normalize(kind)==='reunião'||normalize(kind)==='reuniao'?'reuniao':normalize(kind)==='pessoal'?'pessoal':'compromisso';
  const personal=category==='pessoal'||!confirm('Este compromisso poderá ser visto por administradores?\nOK = compromisso da equipe\nCancelar = privado, apenas meu');
  const {error}=await state.db.from('santrelle_calendar_events').insert({
   user_id:state.user.id,title:title.trim(),event_date:date,
   event_time:time||null,category,private:personal
  });
  if(error){alert('Não foi possível adicionar o compromisso: '+error.message);return}
  await reloadEvents();render();
  if(!personal)window.santrelleGoogleSyncNow(true);
 };
 window.santrelleCalendarOpenEvent=async function(id){
  const ev=state.events.find(x=>x.id===id);if(!ev)return;
  const mine=ev.user_id===state.user?.id;
  if(!mine){alert((ev.title||'Compromisso')+'\n'+ev.event_date+(ev.event_time?' às '+ev.event_time.slice(0,5):''));return}
  if(!confirm('Compromisso: '+ev.title+'\nData: '+ev.event_date+'\n\nDeseja excluir este compromisso da agenda?'))return;
  const {error}=await state.db.from('santrelle_calendar_events').delete().eq('id',id).eq('user_id',state.user.id);
  if(error)alert('Não foi possível excluir: '+error.message);
  else{await reloadEvents();render()}
 };
 async function reloadEvents(){
  if(!state.db||!state.user)return;
  const {data,error}=await state.db.from('santrelle_calendar_events')
   .select('id,user_id,title,event_date,event_time,category,private')
   .gte('event_date','2024-01-01').order('event_date',{ascending:true}).limit(1000);
  if(error){console.warn('Falha ao carregar agenda individual',error.message);return}
  const personal=(data||[]).filter(e=>e.user_id===state.user.id)
   .map(e=>({...e,staff_name:state.selfName||'Minha agenda'}));
  if(!isAdmin()){state.events=personal;return}
  const {data:teamData,error:teamError}=await state.db.rpc('santrelle_calendar_team_events');
  if(teamError){console.warn('Falha ao carregar compromissos compartilhados',teamError.message);state.events=personal;return}
  const merged=new Map();
  for(const ev of teamData||[])merged.set(ev.id,{...ev,private:false});
  for(const ev of personal)merged.set(ev.id,ev);
  state.events=[...merged.values()];
 }
 window.santrelleCalendarAfterLogin=async(db,user,role)=>{
  state.db=db;state.user=user;state.role=role;state.selfName=myName();
  const {data:pref}=await db.from('santrelle_calendar_preferences').select('visible_owner_names').eq('user_id',user.id).maybeSingle();
  state.visibleOwners=pref?.visible_owner_names||[];
  await reloadEvents();
  await loadGoogleEvents();
  state.loaded=true;
  window.santrelleGoogleSyncNow(true);
  if(state.poll)clearInterval(state.poll);
  state.poll=setInterval(async()=>{
   if(document.visibilityState==='hidden'||!state.user||!state.db)return;
   const previous=JSON.stringify(state.events)+JSON.stringify(state.googleEvents);
   await reloadEvents();
   await loadGoogleEvents();
   if(JSON.stringify(state.events)+JSON.stringify(state.googleEvents)!==previous&&typeof render==='function')render();
  },30000);
  if(state.syncPoll)clearInterval(state.syncPoll);
  state.syncPoll=setInterval(()=>{
   if(document.visibilityState!=='hidden')window.santrelleGoogleSyncNow(true);
  },90000);
 };
 window.santrelleCalendarAfterLogout=()=>{if(state.poll){clearInterval(state.poll);state.poll=null}if(state.syncPoll){clearInterval(state.syncPoll);state.syncPoll=null}state.googleEvents=[];state.googleStatus='';state.db=null;state.user=null;state.events=[];state.loaded=false;state.selfName='';state.visibleOwners=[]};
})();