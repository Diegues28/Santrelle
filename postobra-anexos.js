/* Fotos e documentos das pendências de pós-obra.
   Os arquivos ficam somente no IndexedDB deste navegador. Não são enviados
   ao GitHub, à nuvem nem inseridos automaticamente no PDF do cliente. */
const PW_FILE_DB='santrelle_postobra_anexos_v1';
const PW_MAX_FILE_SIZE=12*1024*1024;
const PW_MAX_FILES_ITEM=16;
let pwFileDbPromise=null;
let pwFileRenderCounter=0;
let pwFileUrls=[];

function pwOpenFileDB(){
 if(pwFileDbPromise)return pwFileDbPromise;
 pwFileDbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('O navegador não permite salvar anexos locais. Confira as permissões e o modo privado.'));
  const req=window.indexedDB.open(PW_FILE_DB,1);
  req.onupgradeneeded=()=>{
   const store=req.result.createObjectStore('arquivos',{keyPath:'id'});
   store.createIndex('itemId','itemId',{unique:false});
  };
  req.onsuccess=()=>{
   const db=req.result;
   db.onversionchange=()=>{db.close();pwFileDbPromise=null};
   resolve(db);
  };
  req.onerror=()=>reject(req.error||new Error('Não foi possível abrir o armazenamento dos anexos.'));
  req.onblocked=()=>reject(new Error('Feche as outras abas do aplicativo e tente novamente.'));
 }).catch(err=>{pwFileDbPromise=null;throw err});
 return pwFileDbPromise
}
async function pwFileList(itemId){
 const db=await pwOpenFileDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('arquivos','readonly');
  const req=tx.objectStore('arquivos').index('itemId').getAll(String(itemId));
  req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))));
  req.onerror=()=>reject(req.error||new Error('Erro ao consultar os arquivos.'));
 })
}
function pwFileAllowed(file){
 const ext=/\.(jpg|jpeg|png|webp|gif|heic|heif|pdf)$/i.test(file.name||'');
 const mime=/^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/i.test(file.type||'');
 return ext||mime
}
function pwFileKind(file){
 return (/^image\/(jpeg|png|webp|gif)$/i.test(file.type||'')||/\.(jpe?g|png|webp|gif)$/i.test(file.name||''))?'image':'file'
}
async function pwSaveFiles(workId,itemId,files){
 const incoming=Array.from(files||[]);
 if(!incoming.length)return [];
 const already=await pwFileList(itemId);
 if(already.length+incoming.length>PW_MAX_FILES_ITEM)
  throw new Error('Cada pendência permite até '+PW_MAX_FILES_ITEM+' anexos. Remova alguns arquivos antes de adicionar outros.');
 for(const file of incoming){
  if(!pwFileAllowed(file))throw new Error('Arquivo não permitido: '+file.name+'. Envie fotos JPG, PNG, WEBP, HEIC ou arquivos PDF.');
  if(file.size>PW_MAX_FILE_SIZE)throw new Error('O arquivo "'+file.name+'" ultrapassa o limite de 12 MB.');
  if(!file.size)throw new Error('O arquivo "'+file.name+'" está vazio.');
 }
 const db=await pwOpenFileDB(),at=new Date().toISOString();
 const records=incoming.map(file=>({
  id:String(Date.now())+'-'+Math.random().toString(36).slice(2,12),
  workId:String(workId),itemId:String(itemId),name:file.name||'Anexo',
  type:file.type||'',size:file.size,createdAt:at,blob:file
 }));
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('arquivos','readwrite'),store=tx.objectStore('arquivos');
  for(const record of records)store.put(record);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Não foi possível salvar as fotos.'));
  tx.onabort=()=>reject(tx.error||new Error('O navegador interrompeu a gravação. Confira o espaço disponível.'));
 });
 return records
}
async function pwFileDelete(fileId){
 const db=await pwOpenFileDB();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('arquivos','readwrite');
  tx.objectStore('arquivos').delete(String(fileId));
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Não foi possível remover o arquivo.'));
 })
}
async function pwFileDeleteForItem(itemId){
 const list=await pwFileList(itemId);
 if(!list.length)return;
 const db=await pwOpenFileDB();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('arquivos','readwrite'),store=tx.objectStore('arquivos');
  for(const item of list)store.delete(item.id);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Não foi possível remover os anexos.'));
 })
}
function pwFileSelected(input){
 const el=document.getElementById('pwFileSelected');
 if(!el)return;
 const files=Array.from(input?.files||[]);
 el.textContent=files.length?files.length+' arquivo'+(files.length===1?' selecionado: ':'s selecionados: ')+files.map(f=>f.name).join(', '):'Nenhum arquivo escolhido.';
}
function pwReleaseFileUrls(){
 for(const url of pwFileUrls)URL.revokeObjectURL(url);
 pwFileUrls=[];
}
function pwFileSize(size){
 const n=Number(size)||0;return n>=1024*1024?(n/(1024*1024)).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'
}
function pwFilesHtml(work,item,files){
 if(!files.length)return '';
 return '<div class="pw-file-heading">'+files.length+' '+(files.length===1?'anexo':'anexos')+'</div><div class="pw-file-gallery">'
  +files.map(file=>{
   const url=URL.createObjectURL(file.blob);pwFileUrls.push(url);
   const image=pwFileKind(file)==='image';
   const format=/\.pdf$/i.test(file.name||'')||file.type==='application/pdf'?'PDF':'FOTO';
   return '<div class="pw-file-card"><a class="pw-file-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" title="Abrir '+esc(file.name)+'">'
    +(image?'<img loading="lazy" alt="'+esc(file.name)+'" src="'+esc(url)+'">':'<span class="pw-file-document">'+format+'</span>')
    +'<span class="pw-file-name">'+esc(file.name)+'</span><small>'+pwFileSize(file.size)+'</small></a>'
    +'<a class="pw-file-download" href="'+esc(url)+'" download="'+esc(file.name)+'">Baixar arquivo</a>'
    +(!work.closedAt?'<button type="button" class="pw-file-delete" onclick="pwRemoveFile('+esc(JSON.stringify(work.id))+','+esc(JSON.stringify(item.id))+','+esc(JSON.stringify(file.id))+')" title="Remover anexo">Remover</button>':'')
    +'</div>'
  }).join('')+'</div>'
}
async function pwFilesAfterRender(work){
 pwFileRenderCounter++;
 const token=pwFileRenderCounter;
 pwReleaseFileUrls();
 if(!work)return;
 for(const item of work.items||[]){
  const id='pwFiles_'+item.id;
  const target=document.getElementById(id);
  if(!target)continue;
  try{
   const files=await pwFileList(item.id);
   if(token!==pwFileRenderCounter)return;
   const stillHere=document.getElementById(id);
   if(stillHere)stillHere.innerHTML=pwFilesHtml(work,item,files);
  }catch(err){
   if(token!==pwFileRenderCounter)return;
   const stillHere=document.getElementById(id);
   if(stillHere)stillHere.innerHTML='<p class="pw-file-error">Não foi possível carregar os anexos: '+esc(err.message)+'</p>'
  }
 }
}
async function pwRemoveFile(workId,itemId,fileId){
 const work=pwFind(workId);
 if(!work||work.closedAt||!(work.items||[]).some(x=>String(x.id)===String(itemId)))return;
 if(!confirm('Remover esta foto ou arquivo da pendência?'))return;
 try{
  await pwFileDelete(fileId);
  await pwFilesAfterRender(work)
 }catch(err){alert('Não foi possível remover o anexo: '+err.message)}
}


/* Anexa arquivos a uma pendência já cadastrada, sem abrir o formulário de edição. */
async function pwAttachDirect(input,workId,itemId){
 const files=Array.from(input?.files||[]);
 if(!files.length)return;
 const work=pwFind(workId);
 const item=work?.items?.find(x=>String(x.id)===String(itemId));
 if(!work||work.closedAt||!item)return;
 input.disabled=true;
 try{
  await pwSaveFiles(work.id,item.id,files);
  item.history=item.history||[];
  item.history.push({at:new Date().toISOString(),text:files.length+' anexo(s) incluído(s)'});
  save();
  await pwFilesAfterRender(work);
 }catch(err){
  console.error(err);
  alert('Não foi possível anexar: '+err.message);
 }finally{
  input.disabled=false;
  input.value='';
 }
}
