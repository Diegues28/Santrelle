/* Relatório de pós-obra para o cliente.
   Consulta apenas dados do cliente e andamento dos ajustes; notas internas,
   responsáveis, fornecedores e anexos não entram no PDF. */
let pwPdfGenerating=false;

function pwClientReportSnapshot(work,project,today){
 const items=(work.items||[]).map((item,i)=>({
  order:i+1,
  environment:String(item.environment||'Ambiente não informado'),
  description:String(item.description||'Pendência sem descrição'),
  done:!!item.done,
  status:item.done?'Concluído':String(item.status||'Pendente'),
  dueDate:item.dueDate||'',
  completedAt:item.completedAt||'',
  overdue:!item.done&&!!item.dueDate&&item.dueDate<today
 }));
 const client=project.clientRegistration||{};
 return {
  name:String(client.name||project.client||'Cliente'),
  project:String(project.name||'Projeto'),
  address:String(client.constructionAddress||''),
  phone:String(client.phone||''),
  email:String(client.email||''),
  date:today,
  open:items.filter(i=>!i.done),
  done:items.filter(i=>i.done),
  total:items.length
 };
}
function pwPdfFileName(report){
 const safe=String(report.name||'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,54)||'Cliente';
 return 'Relatorio_Pos_obra_'+safe+'_'+report.date+'.pdf';
}
async function pwGenerateClientPDF(workId){
 const work=pwFind(workId),project=work&&pwProject(work);
 if(!work||!project){alert('Não foi possível localizar o pós-obra e o projeto vinculado.');return}
 if(!(work.items||[]).length){alert('Cadastre pelo menos uma pendência antes de gerar o PDF para o cliente.');return}
 if(pwPdfGenerating)return;
 pwPdfGenerating=true;
 const button=document.getElementById('pwGeneratePDF');
 if(button){button.disabled=true;button.textContent='Gerando PDF...'}
 try{
  if(typeof loadManualScript!=='function'||typeof SANTRELLE_JSPDF==='undefined')
   throw new Error('A biblioteca de PDF não está disponível neste navegador.');
  await loadManualScript(SANTRELLE_JSPDF,()=>!!window.jspdf?.jsPDF);
  const report=pwClientReportSnapshot(work,project,pwToday());
  const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const W=210,H=297,M=18,C=W-2*M,BOTTOM=267;
  const colors={
   brown:[93,79,69],taupe:[138,120,105],ink:[61,62,60],
   border:[223,214,204],warm:[248,246,243],
   green:[78,112,84],greenLight:[233,242,232],
   blue:[80,112,138],blueLight:[235,241,246],
   red:[167,91,80],redLight:[251,237,232],
   white:[255,255,255]
  };
  const setText=(s=9,color=colors.ink,bold=false)=>{
   doc.setFont('helvetica',bold?'bold':'normal');
   doc.setFontSize(s);doc.setTextColor(...color);
  };
  const write=(value,x,at,size=9,color=colors.ink,bold=false)=>{
   setText(size,color,bold);doc.text(String(value??''),x,at);
  };
  const wrap=(value,w,size=9,bold=false)=>{
   doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
   return doc.splitTextToSize(String(value||''),w);
  };
  let y=0,pages=0;
  const header=()=>{
   if(pages)doc.addPage();
   pages++;
   doc.setFillColor(...colors.warm);doc.rect(0,0,W,37,'F');
   write('SANTRELLE',M,19,20,colors.brown,true);
   write('ARQUITETURA E INTERIORES',M,25,8,colors.taupe);
   write('RELATÓRIO DE PÓS-OBRA',W-M,20,12,colors.brown,true);
   // jsPDF align right applies only to the preceding call:
   doc.setDrawColor(...colors.border);doc.line(M,37,W-M,37);
   y=47;
  };
  // Use an explicit right alignment for the report name without changing the logo position.
  const titleRight=()=>{
   doc.setFillColor(...colors.warm);doc.rect(105,9,87,21,'F');
   setText(13,colors.brown,true);
   doc.text('PÓS-OBRA',W-M,17,{align:'right'});
   setText(8,colors.taupe);
   doc.text('RELATÓRIO DE ACOMPANHAMENTO',W-M,23.5,{align:'right'});
  };
  const newPage=()=>{header();titleRight()};
  const ensure=(height)=>{if(y+height>BOTTOM)newPage()};
  const detail=(label,value)=>{
   const text=String(value||'').trim();if(!text)return;
   const lines=wrap(text,C-39,9);
   const height=Math.max(7,lines.length*5+2);
   ensure(height+2);
   write(label.toUpperCase(),M,y+4,7.5,colors.taupe,true);
   setText(9,colors.ink);doc.text(lines,M+36,y+4);
   y+=height;
  };
  const metric=(x,width,label,number,ink,bg)=>{
   doc.setFillColor(...bg);doc.roundedRect(x,y,width,20,2.2,2.2,'F');
   write(String(number),x+5,y+11,16,ink,true);
   write(label,x+5,y+16.7,7.2,colors.taupe);
  };
  const section=(name,num)=>{
   ensure(20);
   y+=8;
   doc.setDrawColor(...colors.border);doc.line(M,y,W-M,y);
   y+=9;
   write(name,M,y,12,colors.brown,true);
   write(String(num)+' '+(num===1?'item':'itens'),W-M-24,y,8,colors.taupe);
   y+=7;
  };
  const card=(item)=>{
   const descriptionLines=wrap(item.description,C-15,10,true);
   const environmentLines=wrap(item.environment.toUpperCase(),C-16,7.4,true);
   const statusLines=wrap(item.status,C-52,8.5,true);
   const finalText=item.done&&item.completedAt?
     'Concluído em '+new Date(item.completedAt).toLocaleDateString('pt-BR'):
     item.dueDate?'Prazo previsto: '+formatDateBR(item.dueDate):'Prazo: a definir';
   const finalLines=wrap(finalText,C-17,8);
   const alertHeight=item.overdue?5.1:0;
   const height=Math.max(33,11+environmentLines.length*3.6+descriptionLines.length*5.2+
    Math.max(statusLines.length*4.5,5)+finalLines.length*4.4+alertHeight+7);
   ensure(height+5);
   doc.setFillColor(...colors.white);
   doc.setDrawColor(...colors.border);
   doc.roundedRect(M,y,C,height,2,2,'FD');
   doc.setFillColor(...(item.done?colors.green:colors.blue));
   doc.rect(M,y,2,height,'F');
   let cy=y+6;
   write(String(item.order).padStart(2,'0'),M+7,cy,8.2,colors.taupe,true);
   setText(7.4,colors.taupe,true);
   doc.text(environmentLines,M+17,cy);
   cy+=environmentLines.length*3.6+5.2;
   setText(10,colors.ink,true);doc.text(descriptionLines,M+7,cy);
   cy+=descriptionLines.length*5.2+3.4;
   write('Situação:',M+7,cy,8.4,colors.taupe);
   setText(8.5,item.done?colors.green:item.overdue?colors.red:colors.blue,true);
   doc.text(statusLines,M+24,cy);
   cy+=Math.max(statusLines.length*4.5,5)+2.4;
   setText(8,colors.taupe);doc.text(finalLines,M+7,cy);
   if(item.overdue){cy+=finalLines.length*4.4+3.8;write('Prazo vencido',M+7,cy,7.8,colors.red,true)}
   y+=height+5;
  };
  newPage();
  write('INFORMAÇÕES DO CLIENTE',M,y,10,colors.brown,true);y+=9;
  detail('Cliente',report.name);
  detail('Projeto',report.project);
  detail('Endereço da obra',report.address);
  detail('Contato',report.phone);
  detail('E-mail',report.email);
  y+=3;detail('Atualizado em',formatDateBR(report.date));
  ensure(31);
  y+=5;
  const gap=4,tile=(C-2*gap)/3;
  metric(M,tile,'Pendências',report.total,colors.brown,colors.warm);
  metric(M+tile+gap,tile,'Em aberto',report.open.length,colors.blue,colors.blueLight);
  metric(M+2*(tile+gap),tile,'Concluídas',report.done.length,colors.green,colors.greenLight);
  y+=23;
  if(report.open.length){
   section('PENDÊNCIAS EM ACOMPANHAMENTO',report.open.length);
   for(const i of report.open)card(i);
  }
  if(report.done.length){
   section('PENDÊNCIAS CONCLUÍDAS',report.done.length);
   for(const i of report.done)card(i);
  }
  ensure(15);
  y+=8;
  const note='Este relatório apresenta o andamento dos ajustes registrados até '+formatDateBR(report.date)+'. Os status e prazos podem ser atualizados conforme a evolução do acompanhamento.';
  const noteLines=wrap(note,C,8);
  setText(8,colors.taupe);doc.text(noteLines,M,y);
  for(let n=1;n<=doc.getNumberOfPages();n++){
   doc.setPage(n);
   doc.setDrawColor(...colors.border);doc.line(M,H-18,W-M,H-18);
   write('SANTRELLE  |  ARQUITETURA E INTERIORES',M,H-12,7.5,colors.taupe);
   setText(7.5,colors.taupe);
   doc.text('Página '+n+' de '+doc.getNumberOfPages(),W-M,H-12,{align:'right'});
  }
  doc.save(pwPdfFileName(report));
 }catch(error){
  console.error(error);
  alert('Não foi possível gerar o relatório de pós-obra: '+error.message);
 }finally{
  pwPdfGenerating=false;
  if(button){button.disabled=false;button.textContent='Gerar PDF para o cliente'}
 }
}
