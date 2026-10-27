/* Cronograma do cliente - dados exclusivos de cada projeto, sem alterar o planejamento interno. */
const CLIENT_ANALYSIS_DEFAULTS = {study:7,ante:15};
function clientValidDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function clientNextDay(date){return date?nextBusiness(offsetDay(parseISO(date),1)):'';}
function clientProjectDates(p){return p.clientTimelineDates||{};}
function clientTimeRows(p){
 const schedule=p.schedule||[],dates=clientProjectDates(p),rows=[];
 if(!schedule.length)return rows;
 let cursor=clientValidDate(schedule[0]?.start)?schedule[0].start:(clientValidDate(p.startDate)?p.startDate:'');
 let chained=true;
 function append(key,name,kind,days,stage,forcedStart,independent=false){
  const record=dates[key]||{};
  const start=clientValidDate(record.start)?record.start:(forcedStart!==undefined?forcedStart:(independent?'':(chained?cursor:'')));
  const limit=clientValidDate(start)?(days>0?addBusinessDays(start,days-1):start):'';
  const actual=clientValidDate(record.actual)?record.actual:'';
  const internalDone=!!stage?.completed;
  let status='Previsto';
  if(actual)status=kind==='approval'?'Aprovado':'Concluído';
  else if(kind==='approval')status='Aguardando aprovação';
  else if(kind==='client')status=start?'Aguardando cliente':'A definir';
  else if(internalDone)status='Concluído · sem data';
  else if(!start)status='A definir';
  rows.push({key,name,kind,days,start:start||'',limit,actual,status,independent});
  if(independent)chained=false;
  else if(kind!=='briefing'&&chained)cursor=clientNextDay(actual||limit);
  return rows[rows.length-1];
 }
 append('briefing','Briefing','briefing',0,null,'');
 let afterStudy=false;
 for(let i=0;i<schedule.length;i++){
  const step=schedule[i],norm=String(step.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isStudy=norm.includes('estudo preliminar'),isAnte=norm.includes('anteprojeto'),isExecutive=norm.includes('executivo');
  const mainDays=Math.max(1,Math.floor(Number(step.contractualParts?.main)||Number(step.days)||1));
  const secondary=Math.max(0,Math.floor(Number(step.contractualParts?.secondary)||0));
  const key='step_'+i;
  if(isStudy){
   append(key,'Estudo preliminar — R00 (primeira apresentação)','office',mainDays,step,undefined,afterStudy);
   const days=Number(p.clientAnalysisDays?.study)>0?Math.floor(Number(p.clientAnalysisDays.study)):7;
   append(key+'_analysis','Análise do cliente — R00','client',days);
   // R01, R02 e R03 nunca são encadeadas: cada uma tem sua própria
   // data inicial, definida pelo escritório depois da devolutiva.
   const revisionDays=Math.max(1,secondary||mainDays);
   for(let rev=1;rev<=3;rev++){
    const revKey=key+'_r0'+rev;
    append(revKey,'Estudo preliminar — R0'+rev,'office',revisionDays,null,undefined,true);
    append(revKey+'_analysis','Análise do cliente — R0'+rev,'client',days,null,clientNextDay(rows[rows.length-1].limit),true);
   }
   append(key+'_approval','Aprovação do estudo preliminar','approval',0,null,undefined,true);
   afterStudy=true;chained=false;cursor='';
  }else{
   append(key,step.name||'Etapa '+(i+1),'office',mainDays,step,undefined,afterStudy);
   if(isAnte){
    const days=Number(p.clientAnalysisDays?.ante)>0?Math.floor(Number(p.clientAnalysisDays.ante)):15;
    append(key+'_analysis','Análise do cliente — Anteprojeto','client',days,null,clientNextDay(rows[rows.length-1].limit),true);
    append(key+'_approval','Aprovação — Anteprojeto','approval',0,null,undefined,true);
   }else if(isExecutive&&secondary>0){
    append(key+'_compat','Compatibilização dos móveis planejados','office',secondary,null,clientNextDay(rows[rows.length-1].limit),true);
   }else if(step.revisionRequested&&secondary>0){
    append(key+'_revision','Realização de alterações — '+step.name,'office',secondary,null,undefined,true);
   }
   if(afterStudy){chained=false;cursor='';}
  }
 }
 return rows;
}
function clientTimelineStatusClass(status){
 if(status==='Aprovado'||status==='Concluído')return 'good';
 if(status.includes('cliente')||status.includes('aprovação'))return 'waiting';
 return '';
}
function clientTimelineHTML(p){
 const rows=clientTimeRows(p), study=p.clientAnalysisDays?.study||7,ante=p.clientAnalysisDays?.ante||15;
 const instructions='Briefing, levantamento e R00 seguem a data inicial do projeto. R01, R02, R03 e as etapas posteriores só recebem datas quando você informar o início desejado de cada uma. Os 7 dias úteis de análise são uma referência: atrasos do cliente não deslocam automaticamente as próximas etapas.';
 let html='<section class="panel"><div class="calendar-head"><div><h3 style="margin-bottom:6px">Cronograma para o cliente</h3><p class="muted">'+instructions+'</p></div><div class="inline"><button class="primary" type="button" onclick="generateClientTimelinePDF('+p.id+')">Gerar PDF para o cliente</button></div></div>';
 if(!rows.length)return html+'<p class="muted">Primeiro gere o cronograma do projeto para habilitar esta versão.</p></section>';
 html+='<div class="inline client-analysis-controls"><label>Análise do estudo preliminar <input type="number" min="1" max="180" value="'+study+'" onchange="clientSetAnalysisDays('+p.id+',\'study\',this.value)"> dias úteis</label><label>Análise do anteprojeto <input type="number" min="1" max="180" value="'+ante+'" onchange="clientSetAnalysisDays('+p.id+',\'ante\',this.value)"> dias úteis</label></div>';
 html+='<div class="table-scroll"><table class="client-schedule-table"><thead><tr><th>Etapa</th><th>Prazo</th><th>Data inicial</th><th>Data finalização</th><th>Realizado em</th><th>Situação</th><th>Atualizar</th></tr></thead><tbody>';
 for(const row of rows){
  const key=JSON.stringify(row.key);
  html+='<tr class="'+(row.kind==='client'?'client-analysis-row':row.kind==='approval'?'client-approval-row':'')+'"><td><strong>'+esc(row.name)+'</strong></td><td>'+((row.days&&row.kind!=='approval'&&row.kind!=='briefing')?row.days+' dias úteis':'—')+'</td><td>'+esc(formatDateBR(row.start)||'—')+'</td><td>'+esc(formatDateBR(row.limit)||'—')+'</td><td>'+esc(formatDateBR(row.actual)||'—')+'</td><td><span class="tag '+clientTimelineStatusClass(row.status)+'">'+esc(row.status)+'</span></td><td class="client-timeline-actions"><button class="secondary" type="button" onclick="clientEditTimelineDate('+p.id+','+key+',\'actual\')">Data real</button><button class="secondary" type="button" onclick="clientEditTimelineDate('+p.id+','+key+',\'start\')">Início</button></td></tr>';
 }
 html+='</tbody></table></div><p class="muted" style="font-size:12px;margin-top:12px">Datas sem agendamento aparecem como A definir. A análise do cliente não agenda automaticamente a próxima revisão ou etapa; use Início para informar cada data.</p></section>';
 return html;
}
function clientSetAnalysisDays(id,type,input){
 if(type!=='study'&&type!=='ante')return;
 const value=Number(input),p=projects.find(x=>x.id===id);
 if(!p)return;
 if(!Number.isInteger(value)||value<1||value>180){alert('Informe de 1 a 180 dias úteis.');render();return}
 if(!confirm('Atualizar o prazo de análise do cliente para '+value+' dias úteis? Somente os prazos de análise já agendados serão recalculados.')){render();return}
 p.clientAnalysisDays={...(p.clientAnalysisDays||{}),[type]:value};save();render();
}
function clientEditTimelineDate(id,key,field){
 const p=projects.find(x=>x.id===id);
 if(!p||!['actual','start'].includes(field))return;
 const item=clientTimeRows(p).find(x=>x.key===key);
 if(!item)return;
 const previous=p.clientTimelineDates?.[key]?.[field]||'';
 const label=field==='actual'?'Data real da entrega, devolutiva ou aprovação':'Data inicial combinada para '+item.name;
 const raw=prompt(label+' (DD/MM/AAAA). Deixe vazio para retirar o registro:',formatDateBR(previous));
 if(raw===null)return;
 const value=raw.trim()===''?'':parseDateBR(raw);
 if(value===null){alert('Informe uma data válida em DD/MM/AAAA.');return}
 if(field==='start'&&value&&!businessDay(value)){alert('A data inicial do prazo deve ser um dia útil. Confira os feriados.');return}
 if(value===previous)return;
 if(!confirm('Confirmar a alteração em '+item.name+'? As demais revisões e etapas com início independente não serão alteradas.'))return;
 p.clientTimelineDates=p.clientTimelineDates||{};
 p.clientTimelineDates[key]={...(p.clientTimelineDates[key]||{}),[field]:value};
 p.clientTimelineUpdatedAt=new Date().toISOString();save();render();
}
function clientPdfFileName(p){
 const name=String(p.clientRegistration?.name||p.client||p.name||'Projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,65);
 const now=new Date();return 'Cronograma_'+(name||'Projeto')+'_'+iso(now.getFullYear(),now.getMonth()+1,now.getDate())+'.pdf';
}
async function generateClientTimelinePDF(id){
 const p=projects.find(x=>x.id===id);
 if(!p)return;
 const rows=clientTimeRows(p);
 if(!rows.length){alert('Gere primeiro o cronograma do projeto.');return}
 if(!confirm('Gerar o cronograma para o cliente com as datas e situações exibidas? Confira as datas antes de enviar o arquivo.'))return;
 try{
  await loadManualScript(SANTRELLE_JSPDF,()=>!!window.jspdf?.jsPDF);
  const PDF=window.jspdf.jsPDF;
  const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const W=210,H=297,margin=17,contentW=W-2*margin;
  const taupe=[143,124,106],brown=[89,76,66],ink=[70,67,63],soft=[247,244,240],line=[220,210,198];
  let y=0,pageNo=0;
  const text=(v,x,y,size=9,color=ink,style='normal')=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color);doc.text(String(v),x,y)};
  const separator=(at)=>{doc.setDrawColor(...line);doc.line(margin,at,W-margin,at)};
  function newPage(){
   if(pageNo)doc.addPage();
   pageNo++;y=18;
   text('SANTRELLE',margin,y,21,taupe,'normal');
   text('ARQUITETURA E INTERIORES',margin,y+5.5,8,brown);
   text('CRONOGRAMA DO PROJETO',margin,y+23,16,brown,'normal');
   y+=29;separator(y);y+=8;
  }
  function header(){
   doc.setFillColor(...taupe);doc.rect(margin,y,contentW,10,'F');
   const headings=['Etapa','Prazo','Data inicial','Data finalização','Realizado em','Situação'];
   const xs=[margin+3,margin+57,margin+79,margin+107,margin+137,margin+159];
   headings.forEach((h,i)=>text(h,xs[i],y+6.4,i===0?8.5:7.2,[255,255,255],'bold'));
   y+=10;
  }
  newPage();
  const client=p.clientRegistration?.name||p.client||p.name||'Cliente';
  const clientLines=doc.splitTextToSize('CLIENTE: '+client,contentW);
  for(const ln of clientLines){text(ln,margin,y,10,ink,'bold');y+=6;}
  const today=new Date(),update=iso(today.getFullYear(),today.getMonth()+1,today.getDate());
  text('Atualização: '+formatDateBR(update)+'   |   Prazos em dias úteis',margin,y+3,8,taupe);y+=13;
  header();
  const widths=[52,22,28,30,22,22],xs=[margin,margin+52,margin+74,margin+102,margin+132,margin+154];
  for(let i=0;i<rows.length;i++){
   const r=rows[i],label=doc.splitTextToSize(r.name,widths[0]-6);
   const situation=doc.splitTextToSize(r.status,widths[5]-3);
   const height=Math.max(13,label.length*4.5+6,situation.length*4+6);
   if(y+height>H-35){newPage();header();}
   if(r.kind==='client'||r.kind==='approval'){doc.setFillColor(...soft);doc.rect(margin,y,contentW,height,'F')}
   else if(i%2){doc.setFillColor(253,252,250);doc.rect(margin,y,contentW,height,'F')}
   const vals=[label,r.days>0?r.days+' úteis':'—',formatDateBR(r.start)||'—',formatDateBR(r.limit)||'—',formatDateBR(r.actual)||'—',situation];
   for(let c=0;c<vals.length;c++){
    doc.setTextColor(...ink);doc.setFont('helvetica',c===0?'bold':'normal');doc.setFontSize(c===0?8:7.5);
    const v=Array.isArray(vals[c])?vals[c]:String(vals[c]);
    doc.text(v,xs[c]+2,y+6);
   }
   doc.setDrawColor(...line);doc.line(margin,y+height,W-margin,y+height);y+=height;
  }
  const observations=[
   'Os prazos são contados em dias úteis, sem sábados, domingos, feriados nacionais, estaduais de São Paulo, municipais de Santos e folgas do escritório cadastradas.',
   'A analise e a aprovacao do cliente nao definem automaticamente as datas das proximas revisoes ou etapas.',
   'R01, R02, R03, anteprojeto e executivo terao datas somente apos agendamento confirmado pelo escritorio.'
  ];
  y+=9;
  for(const note of observations){
   const lines=doc.splitTextToSize(note,contentW-2);
   if(y+lines.length*4.5>H-22)newPage();
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...brown);doc.text(lines,margin,y);y+=lines.length*4.5+4;
  }
  for(let n=1;n<=doc.getNumberOfPages();n++){
   doc.setPage(n);doc.setDrawColor(...line);doc.line(margin,H-17,W-margin,H-17);
   text('SANTRELLE • Arquitetura e Interiores',margin,H-11,7.5,taupe);
   text('Página '+n+' de '+doc.getNumberOfPages(),W-margin,H-11,7.5,taupe);
  }
  doc.save(clientPdfFileName(p));
 }catch(error){console.error(error);alert('Não foi possível gerar o PDF: '+error.message)}
}
