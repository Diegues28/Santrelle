/* Gerador integrado do Manual do Cliente Santrelle.
   O PDF é criado no navegador com textos padrão e dados do projeto,
   sem upload e sem dependências de servidores de terceiros. */
let santrelleManualPdfLoading=null;

function manualSafeText(value){
 return String(value??"").replace(/[\u2010-\u2015]/g,"-")
  .replace(/\u2026/g,"...").replace(/\u00a0/g," ")
  .replace(/[\u200b-\u200d]/g,"").replace(/\s+/g," ").trim();
}
function manualNameForFile(value){
 return String(value||"Cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60)||"Cliente";
}
async function manualEnsurePdfLibrary(){
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 if(santrelleManualPdfLoading)return santrelleManualPdfLoading;
 santrelleManualPdfLoading=new Promise((resolve,reject)=>{
  let ended=false;
  const existing=document.querySelector('script[data-santrelle-pdf-bundle="true"]');
  if(existing)existing.remove();
  const script=document.createElement("script");
  script.dataset.santrellePdfBundle="true";
  script.src="vendor/jspdf.umd.min.js";
  let timer;
  function finish(error){
   if(ended)return;
   ended=true;clearTimeout(timer);
   if(error){script.remove();reject(error)}
   else resolve(window.jspdf.jsPDF);
  }
  script.onload=()=>window.jspdf?.jsPDF?finish():finish(new Error("O gerador de PDF local não foi inicializado corretamente. Atualize a página."));
  script.onerror=()=>finish(new Error("Não foi possível abrir o gerador de PDF do Santrelle. Verifique a conexão e atualize a página."));
  timer=setTimeout(()=>finish(new Error("O carregamento do gerador de PDF demorou demais. Atualize a página e tente novamente.")),15000);
  document.head.appendChild(script);
 }).finally(()=>{santrelleManualPdfLoading=null});
 return santrelleManualPdfLoading;
}
function manualPdfLine(doc,value,x,y,maxWidth,fontSize=10,lineHeight=5.3){
 doc.setFontSize(fontSize);
 const lines=doc.splitTextToSize(manualSafeText(value),maxWidth);
 for(const line of lines){doc.text(line,x,y);y+=lineHeight}
 return y;
}

/* Os prazos apresentados no manual saem exclusivamente da ficha deste projeto.
   Não usamos quantidades fixas do modelo original nem somamos revisões opcionais
   à duração principal. */
function manualClientNames(project){
 const client=String(project?.clientRegistration?.name||project?.client||project?.name||"CLIENTE").trim()||"CLIENTE";
 const spouse=String(project?.clientRegistration?.spouseName||"").trim();
 return spouse&&spouse.toLocaleLowerCase("pt-BR")!==client.toLocaleLowerCase("pt-BR")
  ?[client,spouse]:[client];
}
function manualPdfStageContract(project,pageIndex){
 const mapping={3:"levantamento",4:"estudo preliminar",5:"anteprojeto",6:"projeto executivo",7:"planejamento de obra",8:"acompanhamento de obra",9:"producao de ambientes"};
 const target=mapping[pageIndex];
 if(!target)return null;
 const normal=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const step=(project?.steps||[]).find(item=>{
  const label=typeof registrationStageLabel==="function"?registrationStageLabel(item):item.name;
  return normal(label).includes(target);
 });
 if(!step)return null;
 const parts=typeof registrationContractParts==="function"?registrationContractParts(step):
  (step.contractualParts||{main:Math.max(1,Number(step.contractualDays)||1),secondary:0});
 const main=Math.max(1,Math.floor(Number(parts.main)||1));
 const secondary=Math.max(0,Math.floor(Number(parts.secondary)||0));
 const compatibility=pageIndex===6;
 return {name:String(typeof registrationStageLabel==="function"?registrationStageLabel(step):step.name||"Etapa"),
  main,secondary,compatibility,
  secondaryName:compatibility?"Compatibilização com móveis planejados":pageIndex===4?"Revisão do estudo preliminar":"Revisão do anteprojeto"};
}
function manualPdfStageDuration(doc,contract){
 if(!contract)return;
 doc.setDrawColor(205,190,176);doc.setLineWidth(.26);doc.line(24,258,186,258);
 doc.setFont("times","normal");doc.setTextColor(109,90,76);doc.setFontSize(12.2);
 doc.text("PRAZO: "+contract.main+" "+(contract.main===1?"DIA ÚTIL":"DIAS ÚTEIS"),186,266,{align:"right"});
 if(contract.secondary>0){
  doc.setFont("helvetica","normal");doc.setFontSize(7.3);doc.setTextColor(136,119,108);
  const second=contract.secondaryName+" — "+contract.secondary+" "+(contract.secondary===1?"dia útil":"dias úteis")
    +(contract.compatibility?" (adicional)":" (se solicitada)");
  doc.text(doc.splitTextToSize(second,158).slice(0,2),186,272,{align:"right",lineHeightFactor:1.07});
 }
}
function manualPdfContractRows(project){
 const rows=[];
 for(const ix of [3,4,5,6,7,8,9]){
  const contract=manualPdfStageContract(project,ix);
  if(contract)rows.push(contract);
 }
 return rows;
}
function manualPdfContractTable(doc,project,startY){
 const rows=manualPdfContractRows(project);
 let y=startY+2;
 if(!rows.length){
  doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(116,99,87);
  doc.text("Os prazos contratuais serão apresentados após o cadastro das etapas.",24,y+5);
  return y+12;
 }
 doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(112,92,79);
 doc.text("PRAZOS CONTRATUAIS DESTE PROJETO",24,y+5);
 y+=11;
 rows.forEach((row)=>{
  doc.setFont("helvetica","normal");doc.setFontSize(9.3);doc.setTextColor(83,72,63);
  doc.text(manualSafeText(row.name),24,y);
  doc.setFont("helvetica","bold");doc.setTextColor(98,78,65);
  doc.text(row.main+" "+(row.main===1?"dia útil":"dias úteis"),186,y,{align:"right"});
  y+=6.5;
  if(row.secondary>0){
   doc.setFont("helvetica","normal");doc.setFontSize(7.8);doc.setTextColor(134,116,104);
   const secondaryText=row.secondaryName+" ("+(row.compatibility?"complementar":"opcional")+")";
   doc.text(doc.splitTextToSize(secondaryText,123).slice(0,2),30,y);
   doc.text(row.secondary+" "+(row.secondary===1?"dia útil":"dias úteis"),186,y,{align:"right"});
   y+=6.5;
  }
  doc.setDrawColor(231,223,217);doc.setLineWidth(.15);doc.line(24,y,186,y);
  y+=4.0;
 });
 return y+2;
}

function manualPdfDecorate(doc,pageNo,title){
 const W=210,H=297;
 doc.setFillColor(250,248,245);doc.rect(0,0,W,H,"F");
 doc.setDrawColor(213,202,191);doc.setLineWidth(.22);doc.rect(14,14,182,269);
 doc.setTextColor(128,111,99);doc.setFont("helvetica","normal");doc.setFontSize(9);
 doc.text("SANTRELLE",24,26);doc.setFontSize(6.9);
 doc.text("ARQUITETURA E INTERIORES",24,31);
 doc.setDrawColor(208,195,183);doc.line(24,38,186,38);
 doc.setTextColor(142,123,112);doc.setFontSize(8);
 doc.text(String(pageNo).padStart(2,"0")+" / 16",186,26,{align:"right"});
 doc.setFont("times","normal");doc.setTextColor(98,81,71);doc.setFontSize(18);
 const titleLines=doc.splitTextToSize(manualSafeText(title),158).slice(0,3);
 doc.text(titleLines,24,53,{lineHeightFactor:1.14});
 doc.setDrawColor(210,199,190);doc.line(24,70,186,70);
 doc.setFont("helvetica","normal");doc.setFontSize(7.2);doc.setTextColor(143,123,110);
 doc.text("SANTRELLE  |  MANUAL DO CLIENTE",24,286);
 doc.text(String(pageNo),186,286,{align:"right"});
 return 82;
}
function manualPdfCover(doc,project){
 doc.setFillColor(249,247,244);doc.rect(0,0,210,297,"F");
 doc.setDrawColor(196,180,166);doc.setLineWidth(.35);doc.rect(16,16,178,264);
 doc.setFillColor(243,238,232);doc.triangle(53,63,165,129,53,194,"F");
 doc.setFont("times","normal");doc.setTextColor(220,211,204);doc.setFontSize(174);
 doc.text("S",114,244);
 doc.setTextColor(126,109,97);doc.setFont("helvetica","normal");doc.setFontSize(8.3);
 doc.text("SANTRELLE ARQUITETURA E INTERIORES",179,26,{align:"right"});
 doc.setFont("times","normal");doc.setTextColor(112,93,81);doc.setFontSize(33);
 doc.text("MANUAL",27,103);doc.text("DO CLIENTE",27,116);
 doc.setDrawColor(186,169,154);doc.line(27,196,91,196);
 const names=manualClientNames(project).map(n=>manualSafeText(n).toLocaleUpperCase("pt-BR"));
 doc.setFontSize(18.4);doc.setTextColor(119,102,90);
 const lines=[];
 names.forEach((name,index)=>{
  if(index)lines.push("E");
  lines.push(...doc.splitTextToSize(name,132));
 });
 // Reserva a região da data, inclusive quando os nomes forem longos.
 const visible=lines.slice(0,6),start=Math.max(207,240-visible.length*8.3);
 let y=start;for(const line of visible){doc.text(line,27,y);y+=8.3}
 const raw=project.manualCoverDate||project.registrationCreatedAt||"";
 let date="";
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
  date=new Date(raw+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
 }
 if(!date)date=new Date().toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
 doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(135,117,105);
 doc.text(manualSafeText(date),27,264);
}
function manualPdfStages(doc){
 const stages=[
  ["01","REUNIÃO DE ALINHAMENTO / BRIEFING"],
  ["02","LEVANTAMENTO DE INFORMAÇÕES"],
  ["03","ESTUDO PRELIMINAR"],
  ["04","ANTEPROJETO E INVESTIMENTOS"],
  ["05","PROJETO EXECUTIVO"],
  ["06","PLANEJAMENTO DE OBRA"],
  ["07","ACOMPANHAMENTO DE OBRA"],
  ["08","PRODUÇÃO DE AMBIENTES"],
  ["09","PÓS-CONCLUSÃO"]
 ];
 const margin=24,gap=5,w=(162-2*gap)/3,h=32;
 for(let i=0;i<stages.length;i++){
  const col=i%3,row=Math.floor(i/3),x=margin+col*(w+gap),y=129+row*39;
  doc.setFillColor(239,233,227);doc.setDrawColor(211,199,188);
  doc.roundedRect(x,y,w,h,1.8,1.8,"FD");
  doc.setFont("times","normal");doc.setTextColor(120,101,88);doc.setFontSize(17);
  doc.text(stages[i][0],x+5,y+11);
  doc.setFont("helvetica","normal");doc.setFontSize(7.9);doc.setTextColor(101,85,74);
  const lines=doc.splitTextToSize(stages[i][1],w-9).slice(0,3);
  doc.text(lines,x+5,y+18,{lineHeightFactor:1.18});
 }
}
function manualPdfBody(doc,blocks,project,pageIndex){
 const areaW=162,top=82,bottom=manualPdfStageContract(project,pageIndex)?252:260;
 let size=10.1,plan=null;
 while(size>=8.0){
  const lineHeight=size*.54;
  const list=blocks.map(b=>{
   if(b.type==="stages")return {kind:"stages",height:148};
   if(b.type==="contractTable")return {kind:"contractTable",height:15+manualPdfContractRows(project).reduce((n,r)=>n+(r.secondary>0?17:11),0)};
   const section=b.type==="section",fontSize=section?size+1.2:size;
   doc.setFont(section?"helvetica":"helvetica",section?"bold":"normal");
   doc.setFontSize(fontSize);
   const lines=doc.splitTextToSize(manualSafeText(b.text),areaW-(section?3:0));
   return {kind:section?"section":"paragraph",lines,fontSize,lineHeight:section?lineHeight*1.04:lineHeight,
     height:lines.length*(section?lineHeight*1.04:lineHeight)+(section?5.4:6.2)};
  });
  const total=list.reduce((sum,b)=>sum+b.height,0);
  if(total<=bottom-top||size<=8.05){plan=list;break}
  // Evita que arredondamentos decimais pulem o mínimo de 8 pt e deixem o plano indefinido.
  size=Math.max(8,size-.3);
 }
 let y=top;
 for(const block of plan){
  if(block.kind==="stages"){manualPdfStages(doc);y+=block.height;continue}
  if(block.kind==="contractTable"){y=manualPdfContractTable(doc,project,y);continue}
  if(block.kind==="section"){
   y+=1.5;
   doc.setFont("helvetica","bold");doc.setTextColor(125,102,88);
   doc.setFontSize(block.fontSize);
   for(const line of block.lines){doc.text(line,24,y);y+=block.lineHeight}
   doc.setDrawColor(211,201,192);doc.line(24,y,186,y);y+=3.9;
  }else{
   doc.setFont("helvetica","normal");doc.setTextColor(75,71,68);
   doc.setFontSize(block.fontSize);
   for(const line of block.lines){doc.text(line,24,y);y+=block.lineHeight}
   y+=6.2;
  }
 }
 if(y>265)console.warn("Página do manual com conteúdo próximo do limite:",y);
}
async function manualGenerateFromBuiltIn(id){
 const project=projects.find(p=>String(p.id)===String(id));
 if(!project){alert("Projeto não encontrado.");return}
 if(manualProcessing)return;
 if(!Array.isArray(SANTRELLE_MANUAL_PAGES)||SANTRELLE_MANUAL_PAGES.length!==16){
  alert("O conteúdo do manual não foi carregado. Atualize a página e tente novamente.");return;
 }
 manualProcessing=true;
 const button=document.getElementById("manualGenerateButton");
 if(button){button.disabled=true;button.textContent="Gerando PDF..."}
 manualStatus("Preparando o manual. Não é necessário anexar nenhum arquivo...");
 try{
  const PDF=await manualEnsurePdfLibrary();
  const template=typeof manualTemplateManagerInfo==="function"?manualTemplateManagerInfo():null;
  if(template){
   const file=await manualTemplateGet();
   if(!file)throw new Error("O PDF padrão não está disponível. Envie novamente em Etapas e modelos.");
   const original=await manualBuildFromTemplate(project,file);
   const individual=manualClientNames(project).join("_");
   original.save("Manual_do_Cliente_"+manualNameForFile(individual)+".pdf");
   manualStatus("Manual gerado usando o PDF padrão do escritório e os dados deste projeto.");
   return;
  }
  const doc=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  doc.setProperties({title:"Manual do Cliente - Santrelle Arquitetura",author:"Santrelle Arquitetura e Interiores",subject:"Manual do Cliente"});
  for(let i=0;i<SANTRELLE_MANUAL_PAGES.length;i++){
   if(i)doc.addPage();
   const page=SANTRELLE_MANUAL_PAGES[i];
   manualStatus("Montando o manual: página "+(i+1)+" de 16...");
   if(i===0)manualPdfCover(doc,project);
   else{
    manualPdfDecorate(doc,i+1,page.title);
    const blocks=i===11?[...page.blocks,{type:"contractTable"}]:page.blocks;
    manualPdfBody(doc,blocks,project,i);
    manualPdfStageDuration(doc,manualPdfStageContract(project,i));
   }
  }
  const name=project.clientRegistration?.name||project.client||project.name||"Cliente";
  doc.save("Manual_do_Cliente_"+manualNameForFile(name)+".pdf");
  manualStatus("Manual gerado com sucesso! O PDF foi enviado para os downloads do navegador.");
 }catch(error){
  console.error("Falha ao gerar manual integrado:",error);
  const message=error?.message||"Erro inesperado.";
  manualStatus("Não foi possível gerar o PDF: "+message,true);
  alert("Não foi possível gerar o manual.\n\n"+message);
 }finally{
  manualProcessing=false;
  if(button&&button.isConnected){button.disabled=false;button.textContent="Gerar manual PDF"}
 }
}
