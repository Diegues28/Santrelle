/* Santrelle - manual individual a partir do modelo PDF do escritorio.
 * O PDF original fica apenas no IndexedDB do navegador; nunca eh enviado ao GitHub.
 */
const SANTRELLE_MANUAL_DB="santrelle_manual_template_v1";
const SANTRELLE_PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const SANTRELLE_PDFWORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const SANTRELLE_JSPDF="vendor/jspdf.umd.min.js";
let manualProcessing=false;

function manualDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB)return reject(new Error("Este navegador nao permite armazenamento de arquivos."));
    const request=indexedDB.open(SANTRELLE_MANUAL_DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore("files");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function manualTemplateGet(){
  const db=await manualDb();
  return new Promise((resolve,reject)=>{
    let t=db.transaction("files","readonly"),q=t.objectStore("files").get("modelo");
    q.onsuccess=()=>{const value=q.result||null;db.close();resolve(value)};
    q.onerror=()=>{db.close();reject(q.error)};
  });
}
async function manualTemplatePut(blob){
  const db=await manualDb();
  return new Promise((resolve,reject)=>{
    let t=db.transaction("files","readwrite");
    t.objectStore("files").put(blob,"modelo");
    t.oncomplete=()=>{db.close();resolve()};
    t.onerror=()=>{db.close();reject(t.error)};
  });
}

/* Modelo PDF opcional do escritório, salvo apenas neste navegador.
   Até existir Supabase com acesso protegido, não deve conter dados de clientes. */
const SANTRELLE_MANUAL_MODEL_INFO_KEY="santrelle_manual_model_info";
function manualTemplateManagerInfo(){
 try{return JSON.parse(localStorage.getItem(SANTRELLE_MANUAL_MODEL_INFO_KEY)||"null")}
 catch(err){return null}
}
function manualTemplateManagerHTML(){
 const meta=manualTemplateManagerInfo();
 const date=meta?.savedAt?new Date(meta.savedAt).toLocaleDateString("pt-BR"):"";
 const status=meta
  ?"PDF padrão salvo neste navegador: "+String(meta.name||"Modelo do escritório")+(date?" · cadastrado em "+date:"")
  :"Nenhum PDF padrão cadastrado. O sistema utiliza o manual integrado de 16 páginas.";
 return '<section class="panel" id="manualTemplateManagerPanel" style="margin-top:22px">'
  +'<div class="inline" style="justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0 0 5px">Manual do Cliente — PDF padrão</h3>'
  +'<p class="muted" style="margin:0">Adicione o manual original de 16 páginas para preservar a identidade visual do escritório. O PDF será a base dos manuais individuais.</p></div></div>'
  +'<p class="muted" style="margin:12px 0 15px">O arquivo fica somente neste navegador, não é enviado ao GitHub nem compartilhado entre computadores. Os nomes e prazos de cada cliente serão inseridos ao gerar o manual.</p>'
  +'<div class="inline" style="gap:10px;align-items:center;flex-wrap:wrap"><label class="secondary" for="manualTemplateInput" style="display:inline-block;padding:10px 14px;border-radius:8px;cursor:pointer">Selecionar PDF padrão</label>'
  +'<input type="file" id="manualTemplateInput" accept=".pdf,application/pdf" onchange="manualTemplateManagerImport(this)" style="position:absolute;max-width:1px;max-height:1px;opacity:0;overflow:hidden">'
  +(meta?'<button type="button" class="secondary" onclick="manualTemplateManagerRemove()">Remover modelo cadastrado</button>':'')
  +'</div><p id="manualTemplateManagerStatus" class="muted" role="status" style="margin:12px 0 0">'+esc(status)+'</p></section>';
}
async function manualTemplateManagerImport(input){
 const file=input?.files?.[0];
 if(input)input.value="";
 if(!file)return;
 const status=document.getElementById("manualTemplateManagerStatus");
 const message=(t,bad=false)=>{if(status){status.textContent=t;status.style.color=bad?"#9D493D":"#625245"}};
 if(!/\.pdf$/i.test(file.name)||file.size<50||file.size>20000000){
  message("Escolha um arquivo PDF válido de até 20 MB.",true);return;
 }
 try{
  message("Verificando e salvando o modelo PDF...");
  const bytes=new Uint8Array(await file.arrayBuffer());
  const signature=new TextDecoder("ascii").decode(bytes.slice(0,5));
  if(signature!=="%PDF-")throw new Error("O arquivo selecionado não parece ser um PDF válido.");
  // Conferência preliminar sem depender de bibliotecas externas.
  const ascii=new TextDecoder("latin1").decode(bytes);
  const occurrences=(ascii.match(/\/Type\s*\/Page\b/g)||[]).length;
  if(occurrences>0&&occurrences!==16)
   throw new Error("Esse PDF parece ter "+occurrences+" páginas. O modelo deve ter 16 páginas.");
  await manualTemplatePut(new Blob([bytes],{type:"application/pdf"}));
  localStorage.setItem(SANTRELLE_MANUAL_MODEL_INFO_KEY,JSON.stringify({
   name:file.name,size:file.size,savedAt:new Date().toISOString()
  }));
  if(typeof models==="function"&&page==="modelos")models();
  message("PDF padrão salvo. Ao abrir o Manual do Cliente, ele será usado com os nomes e prazos do projeto.");
 }catch(err){
  console.error("Falha ao cadastrar PDF padrão:",err);
  message("Não foi possível cadastrar o PDF: "+(err.message||"Erro desconhecido"),true);
 }
}
async function manualTemplateManagerRemove(){
 if(!confirm("Remover o PDF padrão salvo neste navegador? O manual integrado continuará disponível. Nenhum projeto será excluído."))return;
 try{
  const db=await manualDb();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("files","readwrite");
   tx.objectStore("files").delete("modelo");
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
  localStorage.removeItem(SANTRELLE_MANUAL_MODEL_INFO_KEY);
  if(typeof models==="function"&&page==="modelos")models();
 }catch(err){alert("Não foi possível remover o modelo: "+err.message)}
}

function manualStatus(message,isError){
 const area=document.getElementById("manualTemplateStatus");
 if(area){area.textContent=message;area.style.color=isError?"#95584B":"#806E5E"}
}
async function refreshManualTemplateStatus(){
 manualStatus("O manual de 16 páginas está integrado ao Santrelle. Clique em Gerar manual PDF; não é necessário importar nenhum modelo.");
}
async function loadManualScript(url,test){
 if(test())return;
 const previous=document.querySelector('script[data-manual-url="'+url+'"]');
 if(previous)previous.remove(); // evita aguardar por um script que já falhou
 await new Promise((ok,bad)=>{
  const script=document.createElement("script");script.src=url;script.async=true;script.dataset.manualUrl=url;
  let done=false;
  const timeout=setTimeout(()=>finish(new Error("A biblioteca de PDF não respondeu. Verifique a conexão.")),15000);
  function finish(error){
   if(done)return;done=true;clearTimeout(timeout);
   if(error){script.remove();bad(error)}
   else ok();
  }
  script.onload=()=>test()?finish():finish(new Error("Biblioteca PDF carregou, mas não foi inicializada."));
  script.onerror=()=>finish(new Error("Não foi possível carregar a biblioteca PDF. Verifique a conexão."));
  document.head.appendChild(script);
 });
}
async function loadManualLibraries(){
 let worker=SANTRELLE_PDFWORKER;
 if(!window.pdfjsLib){
  try{await loadManualScript(SANTRELLE_PDFJS,()=>!!window.pdfjsLib)}
  catch(primaryError){
   worker="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
   await loadManualScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",()=>!!window.pdfjsLib);
  }
 }
 await loadManualScript(SANTRELLE_JSPDF,()=>!!window.jspdf?.jsPDF);
 window.pdfjsLib.GlobalWorkerOptions.workerSrc=worker;
}
function manualDatePt(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return "";
  return new Date(value+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}).toLocaleUpperCase("pt-BR");
}
function manualShortDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return "A definir";
  return value.split("-").reverse().join("/");
}
function manualContractParts(step){
 if(!step)return {main:0,secondary:0};
 if(step.contractualParts&&Number(step.contractualParts.main)>0)return {main:Math.max(1,Math.floor(Number(step.contractualParts.main))),secondary:Math.max(0,Math.floor(Number(step.contractualParts.secondary)||0))};
 let subs=step.subs||[],total=Number(step.contractualDays)>0?Math.floor(Number(step.contractualDays)):subs.reduce((sum,sub)=>sum+Math.max(0,Number(sub.days)||0),0)+Math.max(0,Number(step.clientExtraDays)||0);
 total=Math.max(1,total);
 if(/levantamento/i.test(step.name||""))return {main:total,secondary:0};
 let last=Number(subs[subs.length-1]?.days)||0,secondary=Math.min(Math.max(0,Math.floor(last)),Math.max(0,total-1));
 return {main:total-secondary,secondary};
}
function manualDays(step){
 if(!step)return null;
 let parts=manualContractParts(step);
 let mandatory=/executivo/i.test(step.name||"");
 let total=parts.main+(mandatory?parts.secondary:0);
 return {office:parts.main,extra:mandatory?parts.secondary:0,total,contractual:total,optionalRevision:mandatory?0:parts.secondary};
}
function manualStep(project,word){
  return (project.steps||[]).find(x=>(x.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(word));
}
function manualCoverName(project){
 const names=typeof manualClientNames==="function"?manualClientNames(project)
  :[String(project?.clientRegistration?.name||project?.client||"CLIENTE")];
 const lines=[];
 for(let i=0;i<names.length;i++){
  if(i)lines.push("E");
  const upper=String(names[i]||"CLIENTE").trim().toLocaleUpperCase("pt-BR");
  const words=upper.split(/\s+/);let line="";
  for(const word of words){
   if((line+" "+word).trim().length>21&&line){lines.push(line);line=word}
   else line=(line+" "+word).trim();
  }
  if(line)lines.push(line);
 }
 return lines;
}
function manualPatchNumbers(ctx,page,project){
 const details=typeof manualPdfStageContract==="function"
  ?manualPdfStageContract(project,page-1):null;
 const dur=details?"PRAZO: "+details.main+" "+(details.main===1?"DIA ÚTIL":"DIAS ÚTEIS")
  :"PRAZO: CONFORME CRONOGRAMA";
 if(page===5){
  ctx.fillStyle="rgb(239,235,232)";ctx.fillRect(69,578,479,57);
  ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";ctx.font='13px Georgia,"Times New Roman",serif';
  ctx.fillText("Quando houver solicitação de alterações, os prazos",75,592,462);
  ctx.fillText("de reapresentação serão informados no cronograma",75,610,462);
  ctx.fillText("atualizado, conforme as condições contratuais.",75,628,462);
  ctx.fillStyle="rgb(239,235,232)";ctx.fillRect(275,744,273,37);
  ctx.fillStyle="#88786E";ctx.font='15px Georgia,"Times New Roman",serif';
  ctx.fillText(dur,287,768,258);
 }
 if(page===6){
  ctx.fillStyle="rgb(205,198,195)";ctx.fillRect(39,780,260,34);
  ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";ctx.font='12px Georgia,"Times New Roman",serif';
  ctx.fillText(dur,44,803,245);
 }
 if(page===7){
  ctx.fillStyle="rgb(206,197,195)";ctx.fillRect(392,620,162,103);
  ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";ctx.font='15px Georgia,"Times New Roman",serif';
  ctx.fillText("PRAZOS",409,650,138);
  ctx.font='12px Georgia,"Times New Roman",serif';
  ctx.fillText(details?details.main+" DIAS ÚTEIS":"A DEFINIR",409,678,138);
  if(details?.secondary>0){
   ctx.font='10px Georgia,"Times New Roman",serif';
   ctx.fillText("COMPATIBILIZAÇÃO:",409,694,138);
   ctx.fillText(details.secondary+" DIAS ÚTEIS ADICIONAIS",409,709,138);
  }
 }
 if(page===10){
  ctx.fillStyle="rgb(207,198,195)";ctx.fillRect(346,778,218,33);
  ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";ctx.font='14px Georgia,"Times New Roman",serif';
  ctx.fillText(dur,352,800,203);
 }
}
function manualDrawCover(ctx,project){
  ctx.fillStyle="rgb(239,235,232)";
  ctx.fillRect(48,644,223,127);
  let lines=manualCoverName(project);
  let size=lines.length>3?23:30;
  let height=lines.length>3?26:34;
  ctx.font=size+'px Georgia,"Times New Roman",serif';
  while(lines.some(line=>ctx.measureText(line).width>250)&&size>18){size-=1;ctx.font=size+'px Georgia,"Times New Roman",serif'}
  ctx.fillStyle="#8B7B72";ctx.textBaseline="alphabetic";
  lines.slice(0,4).forEach((line,i)=>ctx.fillText(line,52,677+i*height,250));
  let d=project.manualCoverDate||project.registrationCreatedAt;
  if(!d){const now=new Date();d=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-")}
  ctx.fillStyle="#8B7663";ctx.font='12px Georgia,"Times New Roman",serif';
  ctx.fillText(manualDatePt(d),52,793,300);
}
function manualDrawSummary(ctx,project){
 // Mantém o grafismo do PDF original e insere os prazos na região textual.
 ctx.fillStyle="rgba(243,238,233,0.95)";ctx.fillRect(208,471,348,334);
 ctx.strokeStyle="#C4B5A8";ctx.lineWidth=0.8;ctx.beginPath();
 ctx.moveTo(225,487);ctx.lineTo(225,785);ctx.stroke();
 ctx.fillStyle="#8B7663";ctx.font='23px Georgia,"Times New Roman",serif';
 ctx.textBaseline="alphabetic";ctx.fillText("PRAZOS DO PROJETO",244,518,300);
 const rows=typeof manualPdfContractRows==="function"?manualPdfContractRows(project):[];
 let y=552;
 if(!rows.length){
  ctx.fillStyle="#705C50";ctx.font='13px Arial,sans-serif';
  ctx.fillText("Prazos a definir na ficha cadastral.",244,y,285);
 }else{
  for(const row of rows.slice(0,7)){
   ctx.fillStyle="#705C50";ctx.font='bold 14px Arial,sans-serif';
   ctx.fillText(String(row.name).toLocaleUpperCase("pt-BR"),244,y,274);
   y+=15;ctx.fillStyle="#55483F";ctx.font='13px Arial,sans-serif';
   ctx.fillText(row.main+" "+(row.main===1?"dia útil":"dias úteis"),247,y,260);
   if(row.secondary>0){
    y+=14;ctx.font='11px Arial,sans-serif';ctx.fillStyle="#837166";
    ctx.fillText(row.secondary+" dias úteis — "+(row.compatibility?"compatibilização":"revisão opcional"),247,y,280);
   }
   y+=18;
  }
 }
 ctx.fillStyle="#83766B";ctx.font='11px Arial,sans-serif';
 ctx.fillText("Datas e devolutivas: consulte o cronograma individual atualizado.",244,780,291);
}
function manualApplyChanges(canvas,pageNumber,project,pageWidth){
  const ctx=canvas.getContext("2d",{willReadFrequently:false});
  const scale=canvas.width/pageWidth;ctx.save();ctx.scale(scale,scale);
  if(pageNumber===1)manualDrawCover(ctx,project);
  if([5,6,7,10].includes(pageNumber))manualPatchNumbers(ctx,pageNumber,project);
  if(pageNumber===12)manualDrawSummary(ctx,project);
  ctx.restore();
}
function manualSaveDate(id,value){
 const p=projects.find(x=>x.id===id);if(!p||!value)return;
 p.manualCoverDate=value;save();manualStatus("Data da capa atualizada.");
}
function manualFileName(project){
 const name=(project.clientRegistration?.name||project.client||"cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 -]/g,"").trim().replace(/\s+/g,"_").slice(0,50);
 return "Manual_do_Cliente_"+(name||"projeto")+".pdf";
}
async function manualBuildFromTemplate(project,blob){
  await loadManualLibraries();
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const template=await window.pdfjsLib.getDocument({data:bytes}).promise;
  if(template.numPages!==16)throw new Error("O modelo deve conter as 16 paginas do manual original. Confira se escolheu o arquivo correto.");
  const PDF=window.jspdf.jsPDF;
  const output=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  for(let i=1;i<=template.numPages;i++){
    manualStatus("Gerando manual: pagina "+i+" de "+template.numPages+"...");
    const page=await template.getPage(i);
    const viewport=page.getViewport({scale:1.6});
    const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext("2d",{alpha:false});
    await page.render({canvasContext:ctx,viewport}).promise;
    manualApplyChanges(canvas,i,project,page.view[2]-page.view[0]);
    if(i!==1)output.addPage();
    output.addImage(canvas.toDataURL("image/jpeg",0.88),"JPEG",0,0,210,297,undefined,"FAST");
    page.cleanup();canvas.width=0;canvas.height=0;
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  await template.destroy();
  return output;
}
async function manualRenderPdf(project,blob){
 const doc=await manualBuildFromTemplate(project,blob);
 doc.save(manualFileName(project));
 manualStatus("Manual gerado e enviado para download.");
 return doc;
}
async function generateManualPdf(id){
 if(typeof manualGenerateFromBuiltIn!=="function"){
  manualStatus("O módulo de geração não carregou. Atualize a página (Ctrl+F5) e tente novamente.",true);
  alert("Não foi possível carregar o gerador do Manual do Cliente. Atualize a página (Ctrl+F5) e tente novamente.");
  return;
 }
 return manualGenerateFromBuiltIn(id);
}
async function importManualTemplate(event,id){
 const input=event?.target;
 const file=input?.files?.[0];
 if(input)input.value="";
 if(!file)return;
 if(!/\.pdf$/i.test(file.name)){
  manualStatus("Selecione um arquivo com extensão PDF.",true);
  alert("Selecione um arquivo PDF.");return;
 }
 if(file.size>20000000){
  manualStatus("Este arquivo ultrapassa o limite de 20 MB. O modelo original de 16 páginas é menor.",true);
  alert("O modelo é muito grande (limite de 20 MB).");return;
 }
 if(manualProcessing)return;
 const project=projects.find(x=>x.id===id);
 if(!project){alert("Projeto não encontrado.");return}
 manualProcessing=true;
 manualStatus("Verificando o arquivo "+file.name+"...");
 let template=null,stored=false;
 try{
  await loadManualLibraries();
  const bytes=await file.arrayBuffer();
  try{
   template=await window.pdfjsLib.getDocument({data:new Uint8Array(bytes.slice(0))}).promise;
  }catch(e){
   const issue=e?.name==="PasswordException"?"O arquivo está protegido por senha.":"Não foi possível ler o PDF. Ele pode estar corrompido ou protegido.";
   throw new Error(issue+" Detalhes: "+(e.message||"arquivo inválido"));
  }
  const pages=template.numPages;
  await template.destroy();template=null;
  if(pages!==16){
   throw new Error("O arquivo '"+file.name+"' tem "+pages+" páginas, mas este gerador utiliza o Manual do Projeto original de 16 páginas. Não selecione o Manual do Proprietário de 34 páginas nem o arquivo que junta manual e cronograma.");
  }
  const blob=new Blob([bytes],{type:"application/pdf"});
  try{
   await manualTemplatePut(blob);
   stored=true;
  }catch(e){
   console.warn("PDF validado, mas o armazenamento local não está disponível:",e);
  }
  manualStatus(stored
   ?"Modelo válido de 16 páginas salvo neste navegador. Gerando o manual..."
   :"Modelo válido de 16 páginas. Este navegador não permitiu guardar o arquivo, mas vou gerar o manual agora...");
  await manualRenderPdf(project,blob);
  if(!stored)manualStatus("Manual gerado! O modelo não pôde ser salvo neste navegador. Você precisará selecioná-lo novamente na próxima vez.",true);
 }catch(e){
  console.error("Erro ao importar o modelo:",e);
  const message=e.message||"Não foi possível validar o arquivo.";
  manualStatus("Não foi possível usar o PDF: "+message,true);
  alert("Não foi possível usar esse PDF.\n\n"+message+"\n\nO modelo anterior salvo no navegador, se existir, não foi substituído.");
 }finally{
  if(template)try{await template.destroy()}catch(e){}
  manualProcessing=false;
 }
}
async function maybeAutoGenerateManual(id){
 // O manual só é gerado quando a equipe clicar em "Gerar manual PDF".
 // Não iniciar downloads automaticamente ao cadastrar projetos.
 return refreshManualTemplateStatus();
}
