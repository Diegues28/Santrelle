/* Santrelle - manual individual a partir do modelo PDF do escritorio.
 * O PDF original fica apenas no IndexedDB do navegador; nunca eh enviado ao GitHub.
 */
const SANTRELLE_MANUAL_DB="santrelle_manual_template_v1";
const SANTRELLE_PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const SANTRELLE_PDFWORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const SANTRELLE_JSPDF="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
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
function manualStatus(message,isError){
 const area=document.getElementById("manualTemplateStatus");
 if(area){area.textContent=message;area.style.color=isError?"#95584B":"#806E5E"}
}
async function refreshManualTemplateStatus(){
  if(!document.getElementById("manualTemplateStatus"))return;
  try{
    const model=await manualTemplateGet();
    manualStatus(model?"Modelo de 16 páginas encontrado neste navegador. Pronto para gerar o manual.":"Nenhum modelo salvo neste navegador. Selecione o Manual do Projeto de 16 páginas. Modelos enviados em outro aparelho ou no ChatGPT não aparecem automaticamente aqui.");
  }catch(e){manualStatus("O navegador não permitiu consultar o modelo salvo. Você ainda pode selecionar um PDF de 16 páginas para gerar o manual: "+e.message,true)}
}
async function loadManualScript(url,test){
  if(test())return;
  const existing=document.querySelector('script[data-manual-url="'+url+'"]');
  if(existing){await new Promise((ok,bad)=>{existing.addEventListener("load",ok,{once:true});existing.addEventListener("error",bad,{once:true})});return}
  await new Promise((ok,bad)=>{
    let s=document.createElement("script");s.src=url;s.async=true;s.dataset.manualUrl=url;
    s.onload=ok;s.onerror=()=>bad(new Error("Nao foi possivel carregar a biblioteca de PDF. Verifique a conexao com a internet."));
    document.head.appendChild(s);
  });
}
async function loadManualLibraries(){
  await loadManualScript(SANTRELLE_PDFJS,()=>!!window.pdfjsLib);
  await loadManualScript(SANTRELLE_JSPDF,()=>!!window.jspdf?.jsPDF);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=SANTRELLE_PDFWORKER;
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
  let name=(project.clientRegistration?.name||project.client||"CLIENTE").trim().toLocaleUpperCase("pt-BR");
  if(!name)return ["CLIENTE"];
  let parts=name.split(/\s+E\s+/i);
  if(parts.length===2)return [parts[0],"E",parts[1]];
  let words=name.split(/\s+/),lines=[],line="";
  for(let word of words){if((line+" "+word).trim().length>16&&line){lines.push(line);line=word}else line=(line+" "+word).trim()}
  if(line)lines.push(line);
  return lines;
}
function manualPatchNumbers(ctx,page){
  // O manual é fixo: nenhum prazo numérico fica impresso neste documento.
  // As datas e durações de cada cliente ficam exclusivamente no cronograma atualizado.
  if(page===5){
    ctx.fillStyle="rgb(239,235,232)";
    ctx.fillRect(69,578,479,57);
    ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";
    ctx.font='13px Georgia,"Times New Roman",serif';
    ctx.fillText("Quando houver solicitação de alterações, os prazos",75,592,462);
    ctx.fillText("de reapresentação serão informados no cronograma",75,610,462);
    ctx.fillText("atualizado, conforme as condições contratuais.",75,628,462);
    ctx.fillStyle="rgb(239,235,232)";ctx.fillRect(275,744,253,37);
    ctx.fillStyle="#88786E";ctx.font='15px Georgia,"Times New Roman",serif';
    ctx.fillText("PRAZO: CONSULTE O CRONOGRAMA",287,768,235);
  }
  if(page===6){
    ctx.fillStyle="rgb(205,198,195)";ctx.fillRect(39,780,226,34);
    ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";
    ctx.font='12px Georgia,"Times New Roman",serif';
    ctx.fillText("PRAZO: CONSULTE O",44,795,208);
    ctx.fillText("CRONOGRAMA DO PROJETO",44,809,208);
  }
  if(page===7){
    ctx.fillStyle="rgb(206,197,195)";ctx.fillRect(398,625,143,86);
    ctx.fillStyle="#625245";ctx.textBaseline="alphabetic";
    ctx.font='15px Georgia,"Times New Roman",serif';
    ctx.fillText("PRAZOS",409,650,119);
    ctx.font='11px Georgia,"Times New Roman",serif';
    ctx.fillText("CONSULTE O",409,678,119);
    ctx.fillText("CRONOGRAMA",409,694,119);
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
function manualDrawSummary(ctx){
  // Pág. 12: orientar o cliente a consultar o cronograma separado.
  ctx.fillStyle="rgba(250,248,245,0.99)";ctx.fillRect(48,128,502,693);
  ctx.strokeStyle="#CFC3BA";ctx.lineWidth=0.8;ctx.strokeRect(51.5,128.5,488,656);
  ctx.fillStyle="#8B7663";ctx.font='25px Georgia,"Times New Roman",serif';
  ctx.textBaseline="alphabetic";
  ctx.fillText("PRAZOS DO PROJETO",72,196,448);
  ctx.strokeStyle="#AFA094";ctx.beginPath();ctx.moveTo(72,215);ctx.lineTo(512,215);ctx.stroke();
  ctx.font='17px Georgia,"Times New Roman",serif';ctx.fillStyle="#625245";
  const lines=[
    "O cronograma do seu projeto será enviado",
    "separadamente e atualizado conforme o",
    "andamento das etapas.",
    "",
    "Nele você poderá consultar os prazos",
    "do escritório, os períodos de análise e",
    "aprovação e as datas previstas de entrega.",
    "",
    "Todos os prazos são considerados em",
    "dias úteis. As datas futuras poderão ser",
    "revisadas após cada devolutiva ou aprovação."
  ];
  lines.forEach((line,i)=>{if(line)ctx.fillText(line,74,276+i*30,444)});
  ctx.font='11px Arial,sans-serif';ctx.fillStyle="#7C6F65";
  ctx.fillText("O cronograma atualizado é o documento de referência para as datas.",74,715,442);
}
function manualApplyChanges(canvas,pageNumber,project,pageWidth){
  const ctx=canvas.getContext("2d",{willReadFrequently:false});
  const scale=canvas.width/pageWidth;ctx.save();ctx.scale(scale,scale);
  if(pageNumber===1)manualDrawCover(ctx,project);
  if([5,6,7].includes(pageNumber))manualPatchNumbers(ctx,pageNumber,project);
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
async function manualRenderPdf(project,blob){
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
  output.save(manualFileName(project));
  manualStatus("Manual gerado e enviado para download.");
}
async function generateManualPdf(id){
 const p=projects.find(x=>x.id===id);
 if(!p)return alert("Projeto não encontrado.");
 if(manualProcessing)return;
 let model=null,storageError=null;
 try{model=await manualTemplateGet()}
 catch(e){storageError=e;console.warn("Não foi possível consultar o modelo local:",e)}
 if(!model){
  manualStatus(storageError
   ?"O navegador não conseguiu acessar o modelo salvo. Selecione o PDF de 16 páginas para gerar o manual nesta sessão."
   :"Este navegador ainda não possui o modelo. Selecione o Manual do Projeto de 16 páginas. O arquivo não é sincronizado entre dispositivos.",!!storageError);
  const picker=document.getElementById("manualTemplateInput");
  if(picker)picker.click();
  else alert("Não encontrei a opção de selecionar o modelo do manual. Atualize a página.");
  return;
 }
 manualProcessing=true;
 try{
  manualStatus("Preparando o manual do cliente...");
  await manualRenderPdf(p,model);
 }catch(e){
  console.error("Erro ao gerar manual:",e);
  let message=e.message||"Falha ao preparar o PDF.";
  if(/16 p[aá]ginas|16 paginas/i.test(message))message+=" Use 'Importar/atualizar modelo PDF' para substituir o arquivo incorreto.";
  manualStatus("Erro ao gerar manual: "+message,true);
  alert("Não foi possível gerar o manual: "+message);
 }finally{manualProcessing=false}
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
 try{
   const model=await manualTemplateGet();
   if(model)await generateManualPdf(id);
   else refreshManualTemplateStatus();
 }catch(e){console.warn("Manual aguardando importacao do modelo:",e)}
}
