/* Extensões do portal interno: obra, financeiro, descrições e aprovações. */
(()=>{
 const cfg=window.SANTRELLE_PORTAL_CONFIG||{};
 if(!window.supabase?.createClient||!cfg.url)return;
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 const E=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const msg=s=>{const el=E('extrasMessage');if(el)el.textContent=s};
 const query=async q=>{const {data,error}=await q;if(error)throw error;return data||[]};
 const write=async q=>{const {data,error}=await q;if(error)throw error;return data};
 let projectId=null;
 const form=async(id,fn)=>{E(id).onsubmit=async e=>{e.preventDefault();const b=e.submitter;if(b)b.disabled=true;try{await fn();e.target.reset();await refresh(projectId);msg('Alterações salvas no Supabase.')}catch(err){msg('Não foi possível salvar: '+err.message)}finally{if(b)b.disabled=false}}};
 function init(){
  const editor=E('projectEditor');if(!editor||E('portalExtras'))return;
  const root=document.createElement('div');root.id='portalExtras';
  root.innerHTML=`
   <section class="card"><h2>Descrição e aprovação das etapas</h2>
   <p class="muted">Explique cada etapa para o cliente. Ele poderá registrar a aprovação diretamente pelo portal.</p>
   <form id="extrasCurrentForm" class="row"><label>Etapa atual do projeto<select id="extrasCurrentStage"></select></label><button>Atualizar etapa atual</button></form><div id="extrasStages"></div></section>
   <section class="card"><h2>Obra · Cronogramas e relatórios</h2>
   <p class="muted">Anexe os PDFs do cronograma de obra e os relatórios de acompanhamento. O cliente só vê documentos liberados.</p>
   <form id="extrasAssetForm" class="row">
    <label>Tipo<select id="extrasKind"><option value="cronograma_obra">Cronograma da obra</option><option value="relatorio_obra">Relatório de obra</option></select></label>
    <label>Descrição<input id="extrasAssetTitle" required placeholder="Ex.: Cronograma novembro"></label>
    <label>Arquivo PDF<input id="extrasAssetFile" type="file" accept=".pdf" required></label><button>Enviar</button>
   </form><div id="extrasAssets"></div></section>
   <section class="card"><h2>Financeiro · Projeto e acompanhamento de obra</h2>
   <p class="muted">Registre parcelas, vencimentos, pagamentos realizados e comprovantes. A liberação é individual.</p>
   <form id="extrasPaymentForm" class="row">
    <label>Referente a<select id="extrasScope"><option value="projeto">Projeto</option><option value="obra">Acompanhamento de obra</option></select></label>
    <label>Descrição<input id="extrasPaymentDesc" required placeholder="Ex.: Parcela 2 / 4"></label>
    <label>Valor (R$)<input id="extrasPaymentAmount" type="number" min="0" step="0.01" required></label>
    <label>Vencimento<input id="extrasPaymentDue" type="date"></label>
    <label>Pago em<input id="extrasPaymentPaid" type="date"></label>
    <label>Código Pix copia e cola (opcional)<input id="extrasPix" placeholder="Cole o código gerado pelo banco"></label>
    <label>Comprovante (PDF ou imagem, opcional)<input id="extrasReceipt" type="file" accept=".pdf,.png,.jpg,.jpeg"></label>
    <button>Adicionar lançamento</button>
   </form><div id="extrasPayments"></div></section>
   <p class="message" id="extrasMessage" role="status"></p>`;
  editor.append(root);
  form('extrasCurrentForm',async()=>{
   const [rows,project]=await Promise.all([
    query(db.from('portal_stages').select('id,label,requires_approval,position').eq('project_id',projectId).order('position')),
    query(db.from('portal_projects').select('current_stage').eq('id',projectId))
   ]);
   const next=E('extrasCurrentStage').value;
   const newIndex=rows.findIndex(x=>x.label===next);
   const currentIndex=rows.findIndex(x=>x.label===project[0]?.current_stage);
   if(newIndex>0&&newIndex>currentIndex){
    const earlier=rows.slice(0,newIndex).filter(x=>x.requires_approval);
    if(earlier.length){
     const approvals=await query(db.from('portal_stage_approvals').select('stage_id').in('stage_id',earlier.map(x=>x.id)));
     const missing=earlier.find(x=>!approvals.some(a=>a.stage_id===x.id));
     if(missing)throw Error('A etapa "'+missing.label+'" ainda não tem aprovação registrada. Aguarde a confirmação do cliente antes de avançar.');
    }
   }
   await write(db.from('portal_projects').update({current_stage:next}).eq('id',projectId));
  });
  form('extrasAssetForm',async()=>{
   const f=E('extrasAssetFile').files[0];if(!f||f.type!=='application/pdf'||f.size>20*1024*1024)throw Error('Envie um PDF de até 20 MB.');
   const path=await upload(f,'obra');
   try{await write(db.from('portal_project_assets').insert({project_id:projectId,kind:E('extrasKind').value,title:E('extrasAssetTitle').value.trim(),storage_path:path,released:false}))}
   catch(err){await db.storage.from('santrelle-clientes').remove([path]);throw err}
  });
  form('extrasPaymentForm',async()=>{
   const f=E('extrasReceipt').files[0];let path=null;
   if(f){if(!['application/pdf','image/png','image/jpeg'].includes(f.type)||f.size>20*1024*1024)throw Error('Comprovante deve ser PDF, JPG ou PNG de até 20 MB.');path=await upload(f,'financeiro')}
   const obj={project_id:projectId,scope:E('extrasScope').value,description:E('extrasPaymentDesc').value.trim(),amount:Number(E('extrasPaymentAmount').value),due_date:E('extrasPaymentDue').value||null,paid_at:E('extrasPaymentPaid').value||null,receipt_path:path,pix_code:E('extrasPix').value.trim()||null,released:false};
   try{await write(db.from('portal_payments').insert(obj))}
   catch(err){if(path)await db.storage.from('santrelle-clientes').remove([path]);throw err}
  });
 }
 async function upload(file,folder){
  const name=file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=projectId+'/'+folder+'/'+crypto.randomUUID()+'-'+name;
  const {error}=await db.storage.from('santrelle-clientes').upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;return path;
 }
 async function refresh(id){
  projectId=id;if(!id)return;init();
  const [stages,approvals,assets,payments]=await Promise.all([
   query(db.from('portal_stages').select('id,label,description,requires_approval,released').eq('project_id',id).order('position')),
   query(db.from('portal_stage_approvals').select('id,stage_id,user_id,approved_at').in('stage_id',(await query(db.from('portal_stages').select('id').eq('project_id',id))).map(x=>x.id).length?(await query(db.from('portal_stages').select('id').eq('project_id',id))).map(x=>x.id):['00000000-0000-0000-0000-000000000000'])),
   query(db.from('portal_project_assets').select('*').eq('project_id',id).order('created_at',{ascending:false})),
   query(db.from('portal_payments').select('*').eq('project_id',id).order('due_date'))
  ]);
  E('extrasCurrentStage').innerHTML='<option value="">Não informado</option>'+stages.map(x=>'<option value="'+esc(x.label)+'">'+esc(x.label)+'</option>').join('');
  const {data:projectData,error:projectError}=await db.from('portal_projects').select('current_stage').eq('id',id).single();
  if(projectError)throw projectError;
  E('extrasCurrentStage').value=projectData.current_stage||'';
  const profiles=approvals.length?await query(db.from('portal_profiles').select('user_id,email').in('user_id',[...new Set(approvals.map(x=>x.user_id))])):[];
  E('extrasStages').innerHTML=stages.map(s=>`<div class="item" style="display:block"><strong>${esc(s.label)}</strong> · <span class="pill">${approvals.filter(a=>a.stage_id===s.id).length} aprovação(ões)</span><p class="muted">${approvals.filter(a=>a.stage_id===s.id).map(a=>esc(profiles.find(p=>p.user_id===a.user_id)?.email||'Cliente')+' — '+new Date(a.approved_at).toLocaleString('pt-BR')).join('<br>')||'Aguardando aprovação'}</p><form class="row extrasStageEdit" data-id="${s.id}"><label>Descrição para o cliente<input name="description" value="${esc(s.description)}" placeholder="O que acontece nesta etapa?"></label><label>Exige aprovação?<select name="approval"><option value="true"${s.requires_approval?' selected':''}>Sim</option><option value="false"${!s.requires_approval?' selected':''}>Não</option></select></label><button>Salvar descrição</button></form></div>`).join('')||'<p class="muted">Crie etapas para configurar a aprovação.</p>';
  E('extrasStages').querySelectorAll('form').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await write(db.from('portal_stages').update({description:f.elements.description.value.trim(),requires_approval:f.elements.approval.value==='true'}).eq('id',f.dataset.id));await refresh(id);msg('Descrição e regra da etapa salvas.')}catch(err){msg(err.message)}});
  E('extrasAssets').innerHTML=assets.map(a=>`<div class="item"><span><strong>${esc(a.title)}</strong> · ${a.kind==='cronograma_obra'?'Cronograma':'Relatório'} · <span class="pill">${a.released?'Liberado':'Oculto'}</span></span><button type="button" data-asset="${a.id}" data-release="${!a.released}" class="secondary">${a.released?'Ocultar':'Liberar'}</button></div>`).join('')||'<p class="muted">Nenhum arquivo de obra.</p>';
  E('extrasPayments').innerHTML=payments.map(p=>`<div class="item"><span><strong>${esc(p.description)}</strong> · ${p.scope==='projeto'?'Projeto':'Obra'} · ${money(p.amount)} · ${p.paid_at?'Pago em '+p.paid_at:'Pendente'+(p.due_date?' · vence '+p.due_date:'')} · <span class="pill">${p.released?'Liberado':'Oculto'}</span></span><div><button type="button" data-payment="${p.id}" data-action="toggle" class="secondary">${p.released?'Ocultar':'Liberar'}</button> <button type="button" data-payment="${p.id}" data-action="paid" class="secondary">${p.paid_at?'Desmarcar pagamento':'Marcar pago hoje'}</button></div></div>`).join('')||'<p class="muted">Nenhum lançamento financeiro.</p>';
  E('extrasAssets').querySelectorAll('[data-asset]').forEach(b=>b.onclick=async()=>{try{await write(db.from('portal_project_assets').update({released:b.dataset.release==='true'}).eq('id',b.dataset.asset));await refresh(id)}catch(err){msg(err.message)}});
  E('extrasPayments').querySelectorAll('[data-payment]').forEach(b=>b.onclick=async()=>{try{const p=payments.find(x=>x.id===b.dataset.payment);const changes=b.dataset.action==='toggle'?{released:!p.released}:{paid_at:p.paid_at?null:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})};await write(db.from('portal_payments').update(changes).eq('id',p.id));await refresh(id)}catch(err){msg(err.message)}});
 }
 window.portalExtrasAdminRefresh=refresh;
})();