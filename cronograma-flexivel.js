/* Santrelle — Cronograma flexível por devolutiva do cliente.
   R00 automática; R01/R02/R03, anteprojeto e executivo com inícios independentes.
   Os dados continuam exclusivos de cada projeto e são gravados somente ao confirmar.
*/
(function(){
"use strict";
const STUDY_REVISIONS=['R01','R02','R03'];
const FLEX_VERSION=3;
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&!Number.isNaN(new Date(x+'T12:00:00').getTime());
const fmt=x=>validDate(x)?formatDateBR(x):'A definir';
const studyAt=p=>(p.steps||[]).findIndex(s=>registrationStageLabel(s)==='Estudo preliminar');
const keyForStep=i=>'stage_'+i;
const keyForRevision=code=>'study_'+code;
const keyForOtherRevision=i=>'stage_'+i+'_revision';
const stepName=s=>registrationStageLabel(s);
const dateAfter=x=>validDate(x)?nextBusiness(offsetDay(parseISO(x),1)):'';
const safe=val=>esc(String(val??''));

function flexDates(p){
 const out={};
 for(const [k,v] of Object.entries(p.flexibleStarts||{}))if(validDate(v))out[k]=v;
 return out;
}
function flexEligible(p,key){
 const steps=p.steps||[];
 if(keyForRevision('R01')===key||keyForRevision('R02')===key||keyForRevision('R03')===key){
  const idx=studyAt(p);return idx>=0&&registrationContractParts(steps[idx]).secondary>0;
 }
 const match=/^stage_(\d+)(?:(_revision))?$/.exec(key);
 if(!match)return false;
 const index=Number(match[1]),step=steps[index];
 if(!step)return false;
 if(match[2])return registrationHasOptionalReview(step)&&registrationContractParts(step).secondary>0;
 return index>studyAt(p)&&studyAt(p)>=0;
}
function flexBuild(p,start,options){
 const previous=(p.schedule||[]).slice();
 const selected=options?{...options}:flexDates(p);
 const startDate=nextBusiness(start);
 const stageIdx=studyAt(p);
 const firstAutomatedLast=stageIdx>=0?stageIdx:0;
 // O briefing ocupa o primeiro dia útil, antes do levantamento.
 let cursor=dateAfter(startDate);
 const next=[];
 for(let i=0;i<(p.steps||[]).length;i++){
  const step=p.steps[i],parts=registrationContractParts(step),old=previous[i]||{};
  const automatic=i<=firstAutomatedLast;
  let stageStart=automatic?cursor:(validDate(selected[keyForStep(i)])?selected[keyForStep(i)]:'');
  const finalMain=validDate(stageStart)?addBusinessDays(stageStart,parts.main-1):'';
  const fullDays=registrationContractDays(step);
  const clientDeadline=validDate(stageStart)?addBusinessDays(stageStart,fullDays-1):'';
  const item={
   name:step.name,owner:step.owner||old.owner||'Não definido',
   start:stageStart,deadline:finalMain,clientDeadline,
   days:parts.main,contractualDays:fullDays,contractualParts:parts,
   clientExtraDays:0,completed:!!old.completed,history:old.history||[],
   revisionRequested:false,revisionStart:'',revisionDeadline:'',revisionCompleted:false
  };
  if(i===stageIdx){
   const revisions=STUDY_REVISIONS.map((code,j)=>{
    const key=keyForRevision(code),rs=validDate(selected[key])?selected[key]:'',
      older=(old.revisions||[]).find(r=>r.code===code)||{};
    const finish=rs&&parts.secondary?addBusinessDays(rs,parts.secondary-1):'';
    return {code,key,start:rs,deadline:finish,days:parts.secondary,
      requested:!!rs,completed:!!older.completed};
   });
   item.revisions=revisions;
   item.revisionRequested=revisions.some(r=>r.requested);
   item.revisionStart=revisions.find(r=>r.start)?.start||'';
   item.revisionDeadline=revisions.filter(r=>r.deadline).at(-1)?.deadline||'';
   item.revisionCompleted=revisions.filter(r=>r.requested).length>0&&revisions.filter(r=>r.requested).every(r=>r.completed);
  } else if(registrationHasOptionalReview(step)){
   const revKey=keyForOtherRevision(i),rs=validDate(selected[revKey])?selected[revKey]:'';
   item.revisionRequested=!!rs;
   item.revisionStart=rs;
   item.revisionDeadline=rs&&parts.secondary?addBusinessDays(rs,parts.secondary-1):'';
   item.revisionCompleted=!!old.revisionCompleted;
  }
  next.push(item);
  if(automatic)cursor=dateAfter(clientDeadline);
 }
 const dated=[];
 next.forEach(s=>{for(const key of ['deadline','clientDeadline','revisionDeadline'])if(validDate(s[key]))dated.push(s[key]);if(s.revisions)for(const r of s.revisions)if(validDate(r.deadline))dated.push(r.deadline);});
 p.startDate=startDate;p.flexibleStarts=selected;p.schedule=next;
 p.officeDate=next.map(s=>s.deadline).filter(validDate).sort().at(-1)||'';
 p.clientDate=dated.sort().at(-1)||'';
 p.deadline=p.clientDate||'A definir';
 p.phase=next.find(s=>!s.completed)?.name||next[0]?.name||'A definir';
 p.holidayCalendarVersion=SANTRELLE_HOLIDAY_CALENDAR_VERSION;
 p.scheduleVersion=FLEX_VERSION;
 return p;
}
// Substitui o cálculo contínuo anterior, sem tocar nos demais módulos.
window.buildScheduleForRegistration=function(p,start){
 return flexBuild(p,start);
};
window.getScheduleDraft=function(p){
 if(!p||!schedulePreviewState||schedulePreviewState.projectId!==p.id)return null;
 const draft=JSON.parse(JSON.stringify(p));
 draft.steps=draft.steps||JSON.parse(JSON.stringify(phases));
 return flexBuild(draft,schedulePreviewState.startDate,{...(schedulePreviewState.manualStarts||{})});
};

window.schedulePreviewSetIndependentDate=function(key,raw){
 if(!schedulePreviewState)return;
 const p=projects.find(x=>x.id===schedulePreviewState.projectId);
 if(!p||!flexEligible(p,key)){alert('Esta revisão não possui prazo cadastrado na ficha do projeto.');render();return;}
 const trimmed=String(raw||'').trim();
 const parsed=trimmed?parseDateBR(trimmed):'';
 if(parsed===null||(trimmed&&!parsed)){alert('Informe uma data válida no formato DD/MM/AAAA.');render();return;}
 if(parsed&&!businessDay(parsed)){alert('Escolha um dia útil, considerando os feriados do escritório.');render();return;}
 schedulePreviewState.manualStarts=schedulePreviewState.manualStarts||{};
 if(parsed)schedulePreviewState.manualStarts[key]=parsed;
 else delete schedulePreviewState.manualStarts[key];
 render();
};
window.createSchedule=function(id){
 const p=projects.find(x=>x.id===id);if(!p)return;
 if(!p.steps?.length&&!phases.length){alert('Cadastre as etapas antes de calcular o cronograma.');return;}
 const now=new Date(),today=iso(now.getFullYear(),now.getMonth()+1,now.getDate());
 const initial=validDate(p.startDate)?p.startDate:today;
 schedulePreviewState={projectId:id,startDate:initial,year:Number(initial.slice(0,4)),
   month:Number(initial.slice(5,7))-1,manualStarts:flexDates(p)};
 render();
};

function inputRow(key,label,date,end,days,note){
 const value=validDate(date)?formatDateBR(date):'';
 return '<div class="flex-item"><div class="flex-item-top"><strong>'+safe(label)+'</strong>'
 +'<span class="muted">'+(days>0?days+' dias úteis':'Prazo não definido')+'</span></div>'
 +'<label>Data desejada de início <input aria-label="Início de '+safe(label)+'" class="br-date-input" '
 +'type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="'+safe(value)+'" '
 +'oninput="maskDateBR(this)" onchange="schedulePreviewSetIndependentDate(\''+key+'\',this.value)"></label>'
 +'<div class="flex-item-result">Entrega prevista: <strong>'+fmt(end)+'</strong></div>'
 +(note?'<p class="muted">'+safe(note)+'</p>':'')+'</div>';
}
window.schedulePreviewSummary=function(draft){
 const idx=studyAt(draft),analysis=Number(draft.clientAnalysisDays?.study)||7;
 let html='<div class="sched-preview-summary flex-summary"><h3>Conferência das datas</h3>'
 +'<p class="muted">Somente o briefing, levantamento e R00 seguem automaticamente a data inicial. Os demais inícios dependem da devolutiva do cliente.</p>'
 +'<div class="sched-preview-stage"><div class="sched-preview-stage-title"><strong>Briefing</strong><span>1 dia útil</span></div>'
 +'<div class="sched-preview-dates"><div><span>Início</span><strong>'+fmt(draft.startDate)+'</strong></div>'
 +'<div><span>Conclusão</span><strong>'+fmt(draft.startDate)+'</strong></div></div></div>';
 (draft.schedule||[]).forEach((s,i)=>{
  const step=draft.steps?.[i]||{},parts=registrationContractParts(step);
  const isStudy=i===idx,automatic=i<=idx;
  const name=isStudy?'Estudo preliminar — R00':stepName(step);
  if(automatic){
   html+='<div class="sched-preview-stage"><div class="sched-preview-stage-title"><strong>'+safe(name)+'</strong><span>'+parts.main+' dias úteis</span></div>'
    +'<div class="sched-preview-dates"><div><span>Início</span><strong>'+fmt(s.start)+'</strong></div>'
    +'<div><span>Prazo interno</span><strong>'+fmt(s.deadline)+'</strong></div>'
    +'<div><span>Apresentação</span><strong>'+fmt(s.clientDeadline)+'</strong></div></div>'
    +(isStudy&&validDate(s.clientDeadline)?'<div class="sched-preview-optional">Retorno previsto do cliente: '
      +formatDateBR(addBusinessDays(dateAfter(s.clientDeadline),analysis-1))
      +' ('+analysis+' dias úteis). Se ele demorar mais, nenhuma etapa futura muda automaticamente.</div>':'')
    +'</div>';
  }else{
   html+=inputRow(keyForStep(i),name,s.start,s.clientDeadline,parts.main,
     registrationIsCompatibility(step)?'A compatibilização segue a execução, dentro desta etapa.':'A data fica em aberto até você agendar esta etapa.');
  }
  if(isStudy){
   for(const r of s.revisions||[]){
    html+=inputRow(r.key,'Estudo preliminar — '+r.code,r.start,r.deadline,r.days,
       r.days?'Preencha somente após o retorno do cliente. O prazo da próxima revisão não será calculado automaticamente.':'Cadastre primeiro os dias da revisão na ficha do projeto.');
   }
  }else if(registrationHasOptionalReview(step)){
   html+=inputRow(keyForOtherRevision(i),'Revisão do '+stepName(step),s.revisionStart,s.revisionDeadline,parts.secondary,
    'Opcional: informe somente quando o cliente pedir alterações.');
  }
 });
 html+='</div>';return html;
};

window.schedulePreviewHTML=function(p){
 let draft;try{draft=getScheduleDraft(p)}catch(err){return '<div class="sched-preview-backdrop"><section class="sched-preview-modal"><h3>Não foi possível calcular</h3><p>'+safe(err.message)+'</p><button onclick="closeSchedulePreview()">Fechar</button></section></div>';}
 if(!draft)return '';
 const initial=schedulePreviewState.startDate,actual=draft.startDate,moved=initial!==actual;
 const pending=(draft.schedule||[]).filter(s=>!s.start).length+
  (draft.schedule||[]).flatMap(s=>s.revisions||[]).filter(r=>!r.start).length;
 return '<div class="sched-preview-backdrop" role="presentation"><section class="sched-preview-modal" role="dialog" aria-modal="true">'
 +'<div class="sched-preview-top"><div><span class="sched-preview-kicker">CONFERÊNCIA ANTES DE SALVAR</span><h2>Prévia do cronograma flexível</h2>'
 +'<p class="muted">'+safe(p.name)+' · As datas só serão gravadas depois da sua confirmação.</p></div>'
 +'<button class="sched-preview-close" type="button" aria-label="Cancelar" onclick="closeSchedulePreview()">×</button></div>'
 +'<div class="sched-preview-inputrow"><label>Data desejada de início <input id="scheduleStartInput" class="br-date-input" '
 +'type="text" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA" '
 +'value="'+safe(formatDateBR(initial))+'" oninput="maskDateBR(this)" onchange="schedulePreviewSetDate(this.value)"></label>'
 +'<div><span class="muted">Briefing</span><strong>'+fmt(actual)+'</strong></div>'
 +'<div><span class="muted">Última entrega agendada</span><strong>'+fmt(draft.clientDate)+'</strong></div></div>'
 +(moved?'<div class="sched-preview-notice">O início foi ajustado para o próximo dia útil: '+fmt(actual)+'.</div>':'')
 +'<div class="flex-info">O cliente tem <strong>7 dias úteis</strong> para responder à R00 (prazo editável). '
 +'Se responder em 10 ou 15 dias, você registra a devolutiva real e agenda a R01 quando for conveniente. '
 +'Nenhuma revisão ou próxima fase recebe data automaticamente.</div>'
 +'<div class="sched-preview-columns">'+schedulePreviewCalendar(p,draft)+schedulePreviewSummary(draft)+'</div>'
 +'<div class="sched-preview-footer"><p class="muted">'+pending+' atividade(s) com início a definir. '
 +'Elas não serão incluídas na agenda até receberem data. As demais datas permanecem independentes.</p>'
 +'<div class="inline"><button class="secondary" onclick="closeSchedulePreview()">Voltar sem salvar</button>'
 +'<button class="primary" onclick="confirmSchedulePreview()">Confirmar datas do cronograma</button></div></div>'
 +'</section></div>';
};
window.confirmSchedulePreview=function(){
 const state=schedulePreviewState;if(!state)return;
 const input=document.getElementById('scheduleStartInput');
 if(input){
  const typed=parseDateBR(input.value);
  if(!typed){alert('Informe uma data inicial válida no formato DD/MM/AAAA.');return;}
  if(typed!==state.startDate){schedulePreviewChooseDay(typed);alert('Confira a prévia recalculada antes de confirmar.');return;}
 }
 const p=projects.find(x=>x.id===state.projectId);if(!p)return;
 const draft=getScheduleDraft(p);
 if(!draft||!draft.schedule.length){alert('Cadastre as etapas antes de confirmar.');return;}
 const filled=(draft.schedule||[]).filter(s=>s.start).length+
  draft.schedule.flatMap(s=>s.revisions||[]).filter(r=>r.start).length;
 const msg='Confirmar o cronograma de '+p.name+'?\n\nBriefing: '+fmt(draft.startDate)
 +'\nÚltima entrega agendada: '+fmt(draft.clientDate)
 +'\nAtividades agendadas: '+filled
 +'\n\nAs demais etapas permanecerão A definir. Alterações futuras não moverão as datas independentes.';
 if(!confirm(msg))return;
 for(const key of ['steps','startDate','schedule','officeDate','clientDate','deadline','phase','holidayCalendarVersion','scheduleVersion','flexibleStarts'])
   p[key]=draft[key];
 schedulePreviewState=null;save();render();
};
// Mantém os botões anteriores de revisão, mas encaminha ao novo agendamento
// para não calcular automaticamente uma data a partir da resposta do cliente.
window.toggleProjectRevision=function(id,i){
 const p=projects.find(x=>x.id===id),s=p?.steps?.[i];
 if(!s||!registrationHasOptionalReview(s))return;
 alert(registrationStageLabel(s)==='Estudo preliminar'
  ?'Na prévia, escolha a data de início da R01, R02 ou R03. Deixe em branco as revisões não solicitadas.'
  :'Na prévia, escolha o início da revisão somente quando o cliente solicitar.');
 createSchedule(id);
};
window.completeProjectRevision=function(id,i){
 const p=projects.find(x=>x.id===id),s=p?.schedule?.[i];if(!s)return;
 if(s.revisions?.length){
  const active=s.revisions.filter(r=>r.requested);
  if(!active.length){alert('Agende uma revisão antes de concluí-la.');return;}
  const answer=prompt('Qual revisão deseja concluir ou reabrir?\n'+active.map(r=>r.code+(r.completed?' (concluída)':'')).join(', '),active[0].code);
  if(answer===null)return;
  const code=answer.trim().toUpperCase(),r=active.find(x=>x.code===code);
  if(!r){alert('Escolha R01, R02 ou R03 entre as revisões agendadas.');return;}
  r.completed=!r.completed;
  s.revisionCompleted=active.every(x=>x.completed);
 }else{
  if(!s.revisionRequested){alert('Agende a revisão antes de concluí-la.');return;}
  s.revisionCompleted=!s.revisionCompleted;
 }
 save();render();
};

// Cronograma do cliente: análises têm prazo indicativo; seus finais nunca
// empurram automaticamente R01/R02/R03, anteprojeto nem executivo.
const oldTimelineDate=window.clientEditTimelineDate;
window.clientTimeRows=function(p){
 const s=p.schedule||[],dates=p.clientTimelineDates||{},rows=[];
 if(!s.length)return rows;
 const study=studyAt(p);
 function add(key,name,kind,days,start,limit,done){
  const record=dates[key]||{},overrideStart=validDate(record.start)?record.start:'';
  const locked=kind==='briefing'||kind==='office'||kind==='revision';
  // Datas dos trabalhos vêm do planejamento confirmado, não do campo local da tabela.
  const fromPlan=locked?start:(overrideStart||start);
  const actual=validDate(record.actual)?record.actual:'';
  const state=actual?(kind==='approval'?'Aprovado':kind==='client'?'Respondido':'Concluído'):
   kind==='approval'?(rows.length&&rows.at(-1).start?'Aguardando aprovação':'A definir'):
   kind==='client'?(fromPlan?'Aguardando cliente':'A definir'):
   done?'Concluído · sem data':fromPlan?'Previsto':'A definir';
  rows.push({key,name,kind,days,start:fromPlan||'',limit:limit||'',actual,status:state});
 }
 const duration=(stage)=>Math.max(1,Math.floor(Number(stage.contractualParts?.main)||Number(stage.days)||1));
 const analysis=(key,anchor,label)=>{
  const stored=Number(p.clientAnalysisDays?.[key]),days=Number.isInteger(stored)&&stored>0?stored:(key==='study'?7:15);
  const begin=dateAfter(anchor),until=begin?addBusinessDays(begin,days-1):'';
  add(label.includes('R')?label+'_analysis':'analysis_'+key,'Análise do cliente — '+label,'client',days,begin,until,false);
 };
 add('briefing','Briefing','briefing',1,p.startDate,p.startDate,false);
 for(let i=0;i<s.length;i++){
  const st=s[i],name=stepName(st),parts=registrationContractParts(st);
  const isStudy=i===study,isAnte=name==='Anteprojeto',isExecutive=name==='Projeto executivo';
  const title=isStudy?'Estudo preliminar — R00':name;
  add('step_'+i,title,'office',duration(st),st.start,st.clientDeadline||st.deadline,st.completed);
  if(isStudy){
   analysis('study',st.clientDeadline,'Estudo preliminar R00');
   for(const r of st.revisions||[]){
    const k=r.key||keyForRevision(r.code);
    add(k,'Estudo preliminar — '+r.code,'revision',r.days,r.start,r.deadline,r.completed);
    if(r.start)analysis('study',r.deadline,'Estudo preliminar '+r.code);
   }
   add('step_'+i+'_approval','Aprovação do estudo preliminar','approval',0,'','',false);
  }else if(isAnte){
   analysis('ante',st.clientDeadline,'Anteprojeto');
   if(st.revisionRequested){
    add(keyForOtherRevision(i),'Revisão do anteprojeto','revision',parts.secondary,
      st.revisionStart,st.revisionDeadline,st.revisionCompleted);
   }
   add('step_'+i+'_approval','Aprovação do anteprojeto','approval',0,'','',false);
  }else if(isExecutive&&parts.secondary>0){
   const begin=st.deadline?dateAfter(st.deadline):'';
   add('step_'+i+'_compat','Compatibilização dos móveis planejados','office',parts.secondary,
      begin,st.clientDeadline,st.completed);
  }
 }
 return rows;
};
window.clientEditTimelineDate=function(id,key,field){
 const p=projects.find(x=>x.id===id);if(!p)return;
 if(field==='start'){
  const rev=/^study_R0[1-3]$/.test(key);
  const stage=/^step_(\d+)$/.exec(key);
  const stageReview=/^stage_(\d+)_revision$/.exec(key);
  const scheduleKey=rev?key:stage?keyForStep(Number(stage[1])):stageReview?key:'';
  if(scheduleKey&&flexEligible(p,scheduleKey)){
   const previous=p.flexibleStarts?.[scheduleKey]||'';
   const raw=prompt('Data inicial desejada (DD/MM/AAAA). Deixe vazio para retirar o agendamento:',formatDateBR(previous));
   if(raw===null)return;
   const val=raw.trim()?parseDateBR(raw.trim()):'';
   if(val===null||(val&&!businessDay(val))){alert('Informe um dia útil válido no formato DD/MM/AAAA.');return;}
   if(val===previous)return;
   const count=p.schedule?.length||0;
   if(!confirm('Atualizar esta data independente? As outras etapas agendadas manterão seus próprios inícios.'))return;
   p.flexibleStarts={...flexDates(p)};
   if(val)p.flexibleStarts[scheduleKey]=val;else delete p.flexibleStarts[scheduleKey];
   if(count&&p.startDate)flexBuild(p,p.startDate);
   save();render();return;
  }
  if(key==='briefing'||stage){
   alert('O briefing, levantamento e R00 são automáticos. Altere a data inicial em Gerar cronograma.');
   createSchedule(id);return;
  }
 }
 oldTimelineDate(id,key,field);
};
// Inclusão de entregas R01/R02/R03 na agenda, cada qual na data escolhida.
// Substitui o marcador único legado da revisão do Estudo Preliminar.
const previousCalendarEntries=window.calendarEntries;
window.calendarEntries=function(){
 let entries=previousCalendarEntries();
 for(const p of projects){
  const i=studyAt(p),s=p.schedule?.[i];if(!s?.revisions)return;
  entries=entries.filter(e=>e.id!=='r'+p.id+'_'+i);
  for(const r of s.revisions){
   if(!validDate(r.deadline))continue;
   entries.push({id:'rv'+p.id+'_'+i+'_'+r.code,
     name:'Entrega '+r.code+' · Estudo preliminar · '+p.name,
     owner:'Equipe',date:r.deadline,projectId:p.id,
     completed:p.status==='Concluído'||!!r.completed,kind:'client'});
  }
 }
 return entries;
};
// As revisões continuam no cronograma do cliente e no planejamento interno.
// Não anexar um bloco avulso à página inicial do painel do projeto.
})();
