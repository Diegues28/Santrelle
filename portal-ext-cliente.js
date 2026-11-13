/* Área do cliente: etapas, aceite, obra e financeiro (somente itens liberados via RLS). */
(()=>{
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const date=s=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'Não informado';
 const explain=(stage)=>{
  if(stage.description?.trim())return stage.description.trim();
  const n=(stage.label||'').toLocaleLowerCase('pt-BR');
  if(n.includes('briefing'))return 'Reunião para entender necessidades, preferências, prioridades e expectativas para o projeto.';
  if(n.includes('levantamento'))return 'Conferência das medidas, condições e informações do imóvel para orientar o desenvolvimento.';
  if(n.includes('estudo preliminar'))return 'Apresentação das primeiras soluções de layout, organização dos ambientes e imagens do projeto.';
  if(n.includes('anteprojeto'))return 'Definição e compatibilização das soluções, materiais, equipamentos e estimativas de investimento.';
  if(n.includes('executivo'))return 'Detalhamento técnico do projeto para orientar fornecedores e execução da obra.';
  if(n.includes('obra'))return 'Planejamento, acompanhamento e relatórios sobre o andamento dos serviços contratados.';
  return '';
 };
 const query=async q=>{const {data,error}=await q;if(error)throw error;return data||[]};
 async function fileButton(db,path,label){
  const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;
  b.onclick=async()=>{b.disabled=true;try{const {data,error}=await db.storage.from('santrelle-clientes').createSignedUrl(path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(e){alert('Não foi possível abrir o arquivo.')}finally{b.disabled=false}};
  return b;
 }
 window.portalExtrasClientRender=async(p,wrap,db)=>{
  const root=document.createElement('div');root.className='portal-extras-client';wrap.append(root);
  const section=(title)=>{const el=document.createElement('section');el.className='block';el.innerHTML='<h3>'+escape(title)+'</h3>';root.append(el);return el};
  const [stages,approvals,assets,payments]=await Promise.all([
   query(db.from('portal_stages').select('id,label,description,requires_approval,position').eq('project_id',p.id).order('position')),
   query(db.from('portal_stage_approvals').select('stage_id,approved_at')),
   query(db.from('portal_project_assets').select('id,kind,title,storage_path').eq('project_id',p.id).order('created_at',{ascending:false})),
   query(db.from('portal_payments').select('id,scope,description,amount,due_date,paid_at,receipt_path,pix_code').eq('project_id',p.id).order('due_date'))
  ]);
  const now=stages.find(s=>s.label.toLocaleLowerCase('pt-BR')===(p.current_stage||'').toLocaleLowerCase('pt-BR'));
  if(now&&explain(now)){const info=document.createElement('p');info.className='muted';info.textContent=explain(now);wrap.querySelector('h2')?.after(info)}
  if(stages.length){
   const s=section('Etapas do projeto e aprovações');
   for(const stage of stages){
    const panel=document.createElement('div');panel.className='tile';panel.style.marginBottom='10px';
    const h=document.createElement('strong');h.textContent=stage.label;panel.append(h);
    if(explain(stage)){const d=document.createElement('p');d.textContent=explain(stage);panel.append(d)}
    const approved=approvals.find(a=>a.stage_id===stage.id);
    const status=document.createElement('p');status.className='muted';status.textContent=approved?'✓ Sua aprovação foi registrada em '+new Date(approved.approved_at).toLocaleString('pt-BR'):stage.requires_approval?'Aguardando sua aprovação':'Etapa disponível para consulta';panel.append(status);
    if(stage.requires_approval&&!approved){
     const button=document.createElement('button');button.type='button';button.textContent='📄 Li e aprovo esta etapa';
     button.onclick=async()=>{
      const ok=confirm('Confirma que você analisou o material apresentado pela Santrelle e aprova a etapa "'+stage.label+'"? Esta confirmação ficará registrada com sua conta e data/hora, e não poderá ser desfeita por este botão.');
      if(!ok)return;button.disabled=true;
      try{
       const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)throw Error('Sua sessão expirou.');
       const {error}=await db.from('portal_stage_approvals').insert({stage_id:stage.id,user_id:user.id});
       if(error)throw error;
       status.textContent='✓ Sua aprovação foi registrada com sucesso.';button.remove();
      }catch(e){alert('Não foi possível registrar a aprovação: '+e.message);button.disabled=false}
     };
     panel.append(button);
    }
    s.append(panel);
   }
  }
  const obra=section('Obra · Cronograma e relatórios');
  if(!assets.length){const t=document.createElement('p');t.className='muted';t.textContent='Nenhum cronograma ou relatório de obra liberado no momento.';obra.append(t)}
  for(const a of assets){
   const row=document.createElement('div');row.className='doc';const span=document.createElement('span');span.textContent=(a.kind==='cronograma_obra'?'Cronograma · ':'Relatório · ')+a.title;row.append(span,await fileButton(db,a.storage_path,'Abrir PDF'));obra.append(row);
  }
  const finance=section('Financeiro · Pagamentos');
  if(p.pix_qr_path){
   const qrCard=document.createElement('div');qrCard.className='tile';qrCard.style.cssText='margin:12px 0 19px;padding:20px;background:#FAF8F5';
   const heading=document.createElement('strong');heading.textContent='Pague com Pix — QR Code do escritório';qrCard.append(heading);
   const description=document.createElement('p');description.className='muted';description.textContent='Escaneie o QR Code pelo aplicativo do seu banco e informe o valor do pagamento. Confira o destinatário e o valor antes de confirmar.';qrCard.append(description);
   const {data:pixSigned,error:pixError}=await db.storage.from('santrelle-clientes').createSignedUrl(p.pix_qr_path,300);
   if(!pixError&&pixSigned?.signedUrl){
    const picture=document.createElement('img');picture.src=pixSigned.signedUrl;
    picture.alt='QR Code Pix estático da Santrelle, sem valor predefinido';
    picture.style.cssText='display:block;max-width:250px;width:100%;height:auto;aspect-ratio:1;object-fit:contain;border:1px solid #E2D6CB;padding:12px;border-radius:10px;background:#fff;margin:14px auto';
    qrCard.append(picture);
    const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:center;gap:8px;flex-wrap:wrap';
    const open=document.createElement('a');open.href=pixSigned.signedUrl;open.target='_blank';open.rel='noopener noreferrer';open.textContent='Abrir QR Code em outra aba';open.style.cssText='color:#625245;text-decoration:underline;font-size:13px';actions.append(open);qrCard.append(actions);
   }else{
    const warning=document.createElement('p');warning.className='muted';warning.textContent='Imagem do Pix temporariamente indisponível. Entre em contato com o escritório.';qrCard.append(warning);
   }
   finance.append(qrCard);
  }
  if(!payments.length){const t=document.createElement('p');t.className='muted';t.textContent='Ainda não há informações financeiras liberadas.';finance.append(t);return}
  const total=payments.reduce((a,x)=>a+Number(x.amount),0),paid=payments.filter(x=>x.paid_at).reduce((a,x)=>a+Number(x.amount),0);
  const summary=document.createElement('p');summary.innerHTML='<strong>Total informado:</strong> '+money(total)+' · <strong>Pago:</strong> '+money(paid)+' · <strong>A pagar:</strong> '+money(total-paid);
  finance.append(summary);
  const help=document.createElement('p');help.className='muted';help.textContent='Resumo apenas dos lançamentos liberados pelo escritório. Em caso de divergência, confirme com o financeiro da Santrelle.';finance.append(help);
  for(const pmt of payments){
   const card=document.createElement('div');card.className='tile';card.style.marginBottom='10px';
   const h=document.createElement('strong');h.textContent=pmt.description+' · '+money(pmt.amount);card.append(h);
   const info=document.createElement('p');info.className='muted';info.textContent=(pmt.scope==='projeto'?'Projeto':'Acompanhamento de obra')+' · '+(pmt.paid_at?'Pago em '+date(pmt.paid_at):'A pagar'+(pmt.due_date?' até '+date(pmt.due_date):''));card.append(info);
   if(pmt.receipt_path){card.append(await fileButton(db,pmt.receipt_path,'Ver comprovante'))}
   if(pmt.pix_code&&!pmt.paid_at&&!p.pix_qr_path){
    const p=document.createElement('p');p.className='muted';p.textContent='Pix copia e cola fornecido pelo escritório:';card.append(p);
    const code=document.createElement('textarea');code.readOnly=true;code.value=pmt.pix_code;code.rows=3;code.style.cssText='display:block;width:100%;font:12px monospace;padding:10px';card.append(code);
    const copy=document.createElement('button');copy.className='secondary';copy.textContent='Copiar código Pix';copy.onclick=async()=>{try{await navigator.clipboard.writeText(pmt.pix_code);copy.textContent='Copiado!'}catch{code.select()}};card.append(copy);
    if(window.QRCode){const qr=document.createElement('div');qr.style.cssText='margin-top:16px;max-width:190px';card.append(qr);try{new window.QRCode(qr,{text:pmt.pix_code,width:170,height:170})}catch(e){qr.textContent='QR Code indisponível. Utilize o código copia e cola.'}}
   }
   finance.append(card);
  }
 };
})();