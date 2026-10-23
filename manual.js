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
    manualStatus(model?"Modelo PDF configurado neste navegador. Pronto para gerar o manual.":"Importe o modelo PDF uma única vez neste navegador para preservar o visual original.");
  }catch(e){manualStatus("Nao foi possivel consultar o modelo: "+e.message,true)}
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
 let parts=manualContractParts(step),total=parts.main+parts.secondary;
 return {office:parts.main,extra:parts.secondary,total,contractual:total};
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
function manualPatchNumbers(ctx,page,project){
  const study=manualDays(manualStep(project,"estudo preliminar")),ant=manualDays(manualStep(project,"anteprojeto")),exe=manualDays(manualStep(project,"executivo"));
  function replaceNumber(x,y,w,h,value,bg,fontSize){
    if(value==null)return;
    ctx.fillStyle=bg;ctx.fillRect(x-1,y-1,w+2,h+2);
    ctx.fillStyle="#88786E";
    ctx.textBaseline="middle";
    ctx.font=fontSize+'px Georgia,"Times New Roman",serif';
    ctx.fillText(String(value),x,y+h/2+1);
  }
  if(page===5&&study){
    replaceNumber(359,749,25,24,study.total,"rgb(239,235,232)",21);
    let revisionDays=manualContractParts(manualStep(project,"estudo preliminar")).secondary;
    if(revisionDays>0)replaceNumber(438,581,17,15,revisionDays,"rgb(239,235,232)",13);
  }
  if(page===6&&ant)replaceNumber(106,785,23,23,ant.total,"rgb(205,198,195)",19);
  if(page===7&&exe)replaceNumber(400,674,21,25,exe.total,"rgb(207,199,197)",17);
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
 const stages=["Levantamento","Estudo preliminar","Anteprojeto","Projeto executivo"];
 const lines=[];
 for(let name of stages){
   let step=(project.steps||[]).find(x=>x.name?.toLowerCase()===name.toLowerCase()),parts=manualContractParts(step);
   let primary=name==="Projeto executivo"?"Projeto executivo":name;
   lines.push({label:primary,days:step?parts.main:null});
   if(name==="Estudo preliminar")lines.push({label:"Revisão do estudo preliminar",days:step?parts.secondary:null,sub:true});
   if(name==="Anteprojeto")lines.push({label:"Revisão do anteprojeto",days:step?parts.secondary:null,sub:true});
   if(name==="Projeto executivo")lines.push({label:"Compatibilização dos móveis planejados",days:step?parts.secondary:null,sub:true});
 }
 ctx.fillStyle="rgba(250,248,245,0.97)";ctx.fillRect(51,128,489,348);
 ctx.strokeStyle="#CFC3BA";ctx.lineWidth=0.8;ctx.strokeRect(51.5,128.5,488,347);
 ctx.fillStyle="#8B7663";ctx.font='23px Georgia,"Times New Roman",serif';ctx.fillText("PRAZOS CONTRATUAIS",69,167);
 ctx.strokeStyle="#AFA094";ctx.beginPath();ctx.moveTo(69,185);ctx.lineTo(519,185);ctx.stroke();
 ctx.font="10px Arial,sans-serif";ctx.fillStyle="#625245";
 ctx.fillText("ETAPA / ATIVIDADE",69,205);ctx.fillText("DIAS ÚTEIS",433,205);
 for(let i=0;i<lines.length;i++){
   let r=lines[i],y=228+i*30;
   ctx.font=(r.sub?"12px":"13px")+' Georgia,"Times New Roman",serif';
   ctx.fillStyle=r.sub?"#89766A":"#625245";
   ctx.fillText((r.sub?"  ":"")+r.label,69,y,330);
   ctx.font="11px Arial,sans-serif";ctx.fillStyle="#625245";ctx.fillText(r.days==null?"A definir":r.days+" dias",435,y);
   ctx.strokeStyle="#E2D6CB";ctx.beginPath();ctx.moveTo(69,y+8);ctx.lineTo(519,y+8);ctx.stroke();
 }
 ctx.font="11px Arial,sans-serif";ctx.fillStyle="#7C6F65";
 ctx.fillText("Início previsto: "+(project.startDate?manualShortDate(project.startDate):"a definir"),69,459,420);
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
 if(!p)return alert("Projeto nao encontrado.");
 if(manualProcessing)return;
 try{
   let model=await manualTemplateGet();
   if(!model){manualStatus("Primeiro importe o PDF modelo. O arquivo fica guardado neste navegador.");document.getElementById("manualTemplateInput")?.click();return}
   manualProcessing=true;manualStatus("Preparando o manual do cliente...");
   await manualRenderPdf(p,model);
 }catch(e){console.error(e);manualStatus("Erro ao gerar manual: "+e.message,true);alert("Nao foi possivel gerar o manual: "+e.message)}
 finally{manualProcessing=false}
}
async function importManualTemplate(event,id){
 const file=event.target.files?.[0];event.target.value="";
 if(!file)return;
 if(!/\.pdf$/i.test(file.name)){alert("Selecione um arquivo PDF.");return}
 if(file.size>20000000){alert("O modelo e muito grande (limite de 20 MB).");return}
 if(manualProcessing)return;
 manualStatus("Validando e guardando o modelo PDF...");
 try{
   await loadManualLibraries();
   const b=await file.arrayBuffer(),pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(b.slice(0))}).promise;
   let pages=pdf.numPages;await pdf.destroy();
   if(pages!==16)throw new Error("O arquivo selecionado tem "+pages+" paginas, mas o modelo possui 16.");
   await manualTemplatePut(new Blob([b],{type:"application/pdf"}));
   manualStatus("Modelo importado com sucesso! Gerando o manual...");
   await generateManualPdf(id);
 }catch(e){manualStatus("Nao foi possivel importar o modelo: "+e.message,true);alert(e.message)}
}
async function maybeAutoGenerateManual(id){
 try{
   const model=await manualTemplateGet();
   if(model)await generateManualPdf(id);
   else refreshManualTemplateStatus();
 }catch(e){console.warn("Manual aguardando importacao do modelo:",e)}
}
