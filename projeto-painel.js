/* Santrelle: navegação e PDF dos detalhes do projeto.
   Não altera a estrutura ou a persistência dos dados existentes. */
let projectDashboardView="overview";
let projectDocumentCache=null;
let projectDocumentToken=0;

function projectDashboardReset(){
 projectDashboardView="overview";
 projectDocumentToken++;
 projectDashboardReleasePDF();
}
function projectDashboardReleasePDF(){
 if(projectDocumentCache?.url)URL.revokeObjectURL(projectDocumentCache.url);
 projectDocumentCache=null;
}
function projectDashboardTitle(){
 return ({
  overview:"Detalhes do projeto",ficha:"Ficha cadastral",
  manual:"Manual do cliente",cliente:"Cronograma do cliente",
  interno:"Planejamento interno do escritório"
 })[projectDashboardView]||"Detalhes do projeto";
}
function projectDashboardNavigate(view){
 if(!selected||!["overview","ficha","manual","cliente","interno"].includes(view))return;
 projectDocumentToken++;
 projectDashboardReleasePDF();
 projectDashboardView=view;
 render();
 if(typeof window.scrollTo==="function")window.scrollTo({top:0,behavior:"instant"});
}
function projectDashboardShortDate(raw){
 return /^\d{4}-\d{2}-\d{2}$/.test(String(raw||""))?formatDateBR(raw):"A definir";
}
function projectDashboardStatus(project){
 const label=String(project.status||"Em andamento");
 return '<span class="tag '+(label==="Concluído"?"good":label==="Atrasado"?"late":"active")+'">'+esc(label)+'</span>';
}
function projectDashboardLink(title,action,kind){
 return '<button type="button" class="project-hub-link'+(kind?" "+kind:"")+'" onclick="'+action+'"><span>'+esc(title)+'</span><span class="hub-arrow" aria-hidden="true">›</span></button>';
}
function projectDashboardOverview(project){
 const info=project.clientRegistration||{};
 const customer=String(info.name||project.client||"Cliente não informado").trim();
 const spouse=String(info.spouseName||"").trim();
 const address=String(info.constructionAddress||info.residentialAddress||"Endereço ainda não cadastrado").trim();
 const office=projectDashboardShortDate(project.officeDate);
 const client=projectDashboardShortDate(project.clientDate||project.deadline);
 const pid=JSON.stringify(project.id);
 const work=pwByProject(project.id);
 const archive=project.status==="Concluído";
 const postAction=work?'pwOpen('+JSON.stringify(work.id)+')':'pwStart('+pid+')';
 return '<div class="project-hub">'
 +'<div class="project-hub-top"><button type="button" class="secondary" onclick="go(\''+(archive?'concluidos':'projetos')+'\')">← Voltar aos projetos</button>'+projectDashboardStatus(project)+'</div>'
 +'<div class="project-hub-shell"><div class="project-hub-grid">'
 +'<section class="project-hub-identity" aria-label="Informações principais do projeto">'
 +'<span class="project-hub-eyebrow">Cliente'+(spouse?' e cônjuge':'')+'</span>'
 +'<strong class="project-hub-client">'+esc(customer)+(spouse?'<span style="font-weight:400;color:#8B7663"> e </span>'+esc(spouse):'')+'</strong>'
 +'<span class="project-hub-eyebrow">Endereço da obra</span><div class="project-hub-address">'+esc(address)+'</div>'
 +'<div class="project-hub-deadlines"><div class="project-hub-deadline"><span>Prazo do escritório</span><strong>'+esc(office)+'</strong></div>'
 +'<div class="project-hub-deadline"><span>Prazo do cliente</span><strong>'+esc(client)+'</strong></div></div></section>'
 +'<nav class="project-hub-nav" aria-label="Documentos do projeto">'
 +projectDashboardLink("Ficha cadastral","projectDashboardNavigate('ficha')","project-hub-link-strong")
 +projectDashboardLink("Manual do cliente","projectDashboardNavigate('manual')")
 +projectDashboardLink("Cronograma do cliente","projectDashboardNavigate('cliente')")
 +'</nav><nav class="project-hub-actions" aria-label="Gestão do projeto"><div class="project-hub-actions-inner">'
 +projectDashboardLink("Área do cliente","portalOpen("+pid+")")
 +projectDashboardLink("Pós-obra",postAction)
 +projectDashboardLink(archive?"Reabrir projeto":"Arquivar projeto",(archive?"reopenProject":"archiveProject")+"("+pid+")","project-hub-link-danger")
 +'</div></nav></div>'
 +'<div class="project-hub-footer"><p>Os documentos ficam em telas próprias. O cronograma do cliente pode ser atualizado conforme as devolutivas; as subetapas e os prazos de trabalho são controlados separadamente.</p>'
 +'<button type="button" class="secondary" onclick="projectDashboardNavigate(\'interno\')">Planejamento interno do escritório ›</button></div>'
 +'</div></div>';
}
function projectDashboardSubHeader(project,title,hint){
 return '<div class="project-detail-subhead"><div><button class="secondary" type="button" onclick="projectDashboardNavigate(\'overview\')">← Voltar ao painel do projeto</button>'
 +'<h2 style="margin-top:14px">'+esc(title)+'</h2><p class="muted">'+esc(project.clientRegistration?.name||project.client||project.name||"")+(hint?' · '+esc(hint):'')+'</p></div></div>';
}
function projectDashboardDocumentView(project,kind){
 const title=kind==="ficha"?"Ficha cadastral":"Manual do cliente";
 const pid=JSON.stringify(project.id);
 const date=project.manualCoverDate||iso(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());
 const isManual=kind==="manual";
 const content=projectDashboardSubHeader(project,title,isManual?"Documento de 16 páginas":"Dados da ficha cadastrada")
 +'<section class="project-document-panel">'
 +'<div class="project-document-actions">'
 +(isManual?'<label>Data da capa<input class="br-date-input" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="'+esc(formatDateBR(date))+'" oninput="maskDateBR(this)" onchange="projectDashboardSetManualDate('+pid+',this)"></label>':'')
 +(!isManual?'<button class="secondary" type="button" onclick="editRegistration('+pid+')">Editar ficha cadastral</button>':'')
 +'<button class="secondary" type="button" onclick="projectDashboardRefreshPDF()">Atualizar visualização</button>'
 +'<span id="projectDocumentActions"></span></div>'
 +'<p class="project-document-help">'+(isManual?'O manual utiliza os dados cadastrados e o texto padrão do escritório. Os prazos estão no cronograma separado.':'Visualização gerada diretamente da ficha preenchida para este projeto. Para alterar os dados, use Editar ficha cadastral.')+'</p>'
 +'<div class="project-document-status" id="projectDocumentStatus">Preparando visualização do PDF...</div>'
 +'<div id="projectDocumentFrameContainer"><div class="project-document-loading">Preparando documento...</div></div></section>';
 return content;
}
function projectDashboardRender(project){
 if(!project){el.innerHTML='<section class="panel">Projeto não encontrado.</section>';return}
 let markup="";
 switch(projectDashboardView){
  case "ficha":
  case "manual":
   markup=projectDashboardDocumentView(project,projectDashboardView);
   break;
  case "cliente":
   markup=projectDashboardSubHeader(project,"Cronograma do cliente","Acompanhamento e devolutivas")
    +clientTimelineHTML(project);
   if(!(project.schedule||[]).length){
    markup+='<div class="panel"><button type="button" class="secondary" onclick="projectDashboardNavigate(\'interno\')">Ir ao planejamento interno para gerar o cronograma</button></div>';
   }
   break;
  case "interno":
   markup=projectDashboardSubHeader(project,"Planejamento interno do escritório","Etapas, subetapas e prazos")
    +projectInternalPlanningHTML(project);
   break;
  default:
   markup=projectDashboardOverview(project);
   break;
 }
 el.innerHTML=markup;
 if(projectDashboardView==="ficha"||projectDashboardView==="manual")projectDashboardLoadPDF(project,projectDashboardView);
}
function projectDashboardSetManualDate(projectId,input){
 const value=parseDateBR(input.value);
 if(!value){alert("Informe uma data válida no formato DD/MM/AAAA.");return}
 const project=projects.find(p=>String(p.id)===String(projectId));
 if(!project)return;
 project.manualCoverDate=value;
 save();
 projectDashboardRefreshPDF();
}
function projectDashboardRefreshPDF(){
 projectDocumentToken++;
 projectDashboardReleasePDF();
 if(selected)render();
}
function projectDashboardPDFField(doc,ctx,label,value){
 const val=String(value??"").trim();
 if(!val)return;
 const W=ctx.contentW;
 const max=W-56;
 doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(106,89,77);
 const labelLines=doc.splitTextToSize(label,49);
 doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(61,57,54);
 const lines=doc.splitTextToSize(val,max);
 const height=Math.max(labelLines.length,lines.length)*5.3+4;
 ctx.ensure(height+2);
 doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(106,89,77);
 doc.text(labelLines,ctx.margin,ctx.y+4.5);
 doc.setFont("helvetica","normal");doc.setTextColor(61,57,54);
 doc.text(lines,ctx.margin+56,ctx.y+4.5);
 ctx.y+=height;
 doc.setDrawColor(233,225,219);doc.line(ctx.margin,ctx.y,210-ctx.margin,ctx.y);ctx.y+=3;
}
function projectDashboardBuildFichaPDF(project,PDF){
 const doc=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
 doc.setProperties({title:"Ficha cadastral - "+(project.clientRegistration?.name||project.client||"Cliente"),author:"Santrelle Arquitetura e Interiores"});
 const info=project.clientRegistration||{},condo=project.condominium||{};
 const ctx={margin:20,contentW:170,y:44};
 function page(){
  if(doc.getNumberOfPages()!==1||ctx.y>44)doc.addPage();
  doc.setFillColor(250,248,245);doc.rect(0,0,210,297,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.setTextColor(98,82,69);
  doc.text("SANTRELLE",20,24);
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text("ARQUITETURA E INTERIORES",20,31);
  doc.setDrawColor(211,200,191);doc.line(20,37,190,37);
  ctx.y=47;
 }
 ctx.ensure=function(height){if(ctx.y+height>267)page()};
 function section(label){
  ctx.ensure(20);
  ctx.y+=7;doc.setFont("helvetica","bold");doc.setFontSize(12);
  doc.setTextColor(98,82,69);doc.text(label.toUpperCase(),20,ctx.y);
  doc.setDrawColor(211,200,191);doc.line(20,ctx.y+3,190,ctx.y+3);
  ctx.y+=12;
 }
 function field(label,value){projectDashboardPDFField(doc,ctx,label,value)}
 page();
 doc.setFont("times","normal");doc.setFontSize(19);doc.setTextColor(98,82,69);
 doc.text("FICHA CADASTRAL DO CLIENTE",20,ctx.y+6);ctx.y+=16;
 section("Dados do cliente");
 field("Nome",info.name||project.client);
 field("Cônjuge",info.spouseName);
 field("Estado civil",info.maritalStatus);
 field("Profissão",info.profession);
 field("Nascimento",projectDashboardShortDate(info.birthDate)==="A definir"?"":projectDashboardShortDate(info.birthDate));
 field("CPF",info.cpf);field("RG",info.rg);
 field("Telefone",info.phone);field("E-mail",info.email);
 field("Endereço residencial",info.residentialAddress);
 field("Endereço da obra",info.constructionAddress);
 field("Como conheceu",info.source);
 const children=(info.children||[]).map(v=>String(v||"").trim()).filter(Boolean);
 if(children.length){section("Filhos");children.forEach((child,i)=>field("Filho(a) "+(i+1),child))}
 const condoFields=[
  ["Síndico / administração",condo.managerName],["Contato administração",condo.managerContact],
  ["Zelador",condo.conciergeName],["Contato zelador",condo.conciergeContact],
  ["Normas do condomínio",condo.hasRules],["Observações",condo.rulesNotes]
 ];
 if(condoFields.some(x=>String(x[1]||"").trim())){
  section("Informações do condomínio");condoFields.forEach(x=>field(x[0],x[1]));
 }
 if((project.steps||[]).length){
  section("Prazos contratuais");
  field("Início previsto",projectDashboardShortDate(project.startDate));
  for(const step of project.steps){
   const parts=registrationContractParts(step);
   field(registrationStageLabel(step),parts.main+" dias úteis"
    +(registrationHasSecondary(step)&&parts.secondary>0?" | "+registrationSecondaryLabel(step)+": "+parts.secondary+" dias úteis":""));
  }
 }
 const n=doc.getNumberOfPages();
 for(let i=1;i<=n;i++){
  doc.setPage(i);doc.setDrawColor(211,200,191);doc.line(20,282,190,282);
  doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(128,111,99);
  doc.text("SANTRELLE · ARQUITETURA E INTERIORES",20,287);
  doc.text("Página "+i+" de "+n,190,287,{align:"right"});
 }
 return doc;
}
async function projectDashboardBuildManualPDF(project,PDF){
 if(!Array.isArray(SANTRELLE_MANUAL_PAGES)||SANTRELLE_MANUAL_PAGES.length!==16)
  throw new Error("Não foi possível encontrar as 16 páginas do manual. Atualize o aplicativo.");
 const doc=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
 doc.setProperties({title:"Manual do Cliente - Santrelle Arquitetura",author:"Santrelle Arquitetura e Interiores"});
 for(let i=0;i<SANTRELLE_MANUAL_PAGES.length;i++){
  if(i)doc.addPage();
  const item=SANTRELLE_MANUAL_PAGES[i];
  if(i===0)manualPdfCover(doc,project);
  else {manualPdfDecorate(doc,i+1,item.title);manualPdfBody(doc,item.blocks)}
 }
 return doc;
}
async function projectDashboardLoadPDF(project,kind){
 const pId=String(project.id),token=projectDocumentToken;
 const cached=projectDocumentCache;
 if(cached&&cached.projectId===pId&&cached.kind===kind){
  projectDashboardShowPDF(cached);return;
 }
 const status=document.getElementById("projectDocumentStatus");
 if(status)status.textContent="Gerando visualização do PDF...";
 try{
  if(typeof manualEnsurePdfLibrary!=="function")throw new Error("A biblioteca de PDF não foi carregada. Atualize a página.");
  const PDF=await manualEnsurePdfLibrary();
  if(token!==projectDocumentToken||!selected||String(selected.id)!==pId||projectDashboardView!==kind)return;
  const doc=kind==="ficha"?projectDashboardBuildFichaPDF(project,PDF):await projectDashboardBuildManualPDF(project,PDF);
  const blob=doc.output("blob");
  const url=URL.createObjectURL(blob);
  if(token!==projectDocumentToken||projectDashboardView!==kind){URL.revokeObjectURL(url);return}
  projectDashboardReleasePDF();
  projectDocumentCache={
   projectId:pId,kind,url,
   filename:kind==="ficha"?"Ficha_Cadastral_"+manualNameForFile(project.clientRegistration?.name||project.client||"Cliente")+".pdf"
    :"Manual_do_Cliente_"+manualNameForFile(project.clientRegistration?.name||project.client||"Cliente")+".pdf"
  };
  projectDashboardShowPDF(projectDocumentCache);
 }catch(error){
  console.error("Erro ao visualizar documento do projeto:",error);
  const status=document.getElementById("projectDocumentStatus");
  if(status)status.textContent="Não foi possível gerar o PDF: "+(error.message||"Erro inesperado.")+". Tente atualizar a visualização.";
 }
}
function projectDashboardShowPDF(data){
 if(!data||projectDashboardView!==data.kind||!selected||String(selected.id)!==data.projectId)return;
 const status=document.getElementById("projectDocumentStatus"),view=document.getElementById("projectDocumentFrameContainer");
 const actions=document.getElementById("projectDocumentActions");
 if(status)status.textContent="PDF pronto. Você pode visualizar, abrir em outra aba ou baixar.";
 if(actions)actions.innerHTML='<a class="secondary" style="display:inline-block;text-decoration:none;padding:10px 13px;border-radius:8px" href="'+esc(data.url)+'" target="_blank" rel="noopener noreferrer">Abrir PDF ↗</a> '
  +'<a class="primary" style="display:inline-block;text-decoration:none;padding:10px 13px;border-radius:8px" href="'+esc(data.url)+'" download="'+esc(data.filename)+'">Baixar PDF</a>';
 if(view)view.innerHTML='<iframe class="project-document-frame" title="Visualização do PDF - '+(data.kind==="ficha"?"Ficha cadastral":"Manual do cliente")+'" src="'+esc(data.url)+'"></iframe>';
}
