// Função privilegiada: a chave administrativa nunca sai do servidor.
// Somente usuários autenticados e com portal_staff.role='admin' podem criar contas.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': 'https://diegues28.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Content-Type': 'application/json',
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Método inválido.'},405);
  const url=Deno.env.get('SUPABASE_URL');
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!secret)return json({error:'Configuração administrativa indisponível.'},503);
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const token=(req.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return json({error:'Faça login para continuar.'},401);
  const {data:{user},error:identityError}=await admin.auth.getUser(token);
  if(identityError||!user)return json({error:'Sessão inválida.'},401);
  const {data:staff,error:staffError}=await admin.from('portal_staff')
    .select('role').eq('user_id',user.id).maybeSingle();
  if(staffError||staff?.role!=='admin')return json({error:'Somente administradores podem criar acessos.'},403);
  let payload;
  try{payload=await req.json()}catch{return json({error:'Dados inválidos.'},400)}
  const email=String(payload.email||'').trim().toLowerCase();
  const action=payload.action==='reset'?'reset':'create';
  const kind=payload.kind==='staff'?'staff':'client';
  const projectId=String(payload.projectId||'');
  const staffRole=payload.staffRole==='admin'?'admin':'colaborador';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'E-mail inválido.'},400);
  if(kind==='client'){
    if(!uuid.test(projectId))return json({error:'Selecione um projeto válido.'},400);
    const {data:project}=await admin.from('portal_projects').select('id').eq('id',projectId).maybeSingle();
    if(!project)return json({error:'Projeto não encontrado.'},404);
  }
  // 192 bits de entropia. A senha é exibida uma única vez para o administrador.
  const raw=crypto.getRandomValues(new Uint8Array(24));
  const password=Array.from(raw,b=>b.toString(16).padStart(2,'0')).join('')+'!A';
  if(action==='reset'){
    const {data:profile}=await admin.from('portal_profiles').select('user_id').eq('email',email).maybeSingle();
    if(!profile)return json({error:'Conta não encontrada.'},404);
    if(kind==='client'){
      const {data:membership}=await admin.from('portal_project_members')
        .select('user_id').eq('project_id',projectId).eq('user_id',profile.user_id).maybeSingle();
      if(!membership)return json({error:'Este usuário não pertence ao projeto selecionado.'},403);
    }else{
      const {data:employee}=await admin.from('portal_staff').select('user_id').eq('user_id',profile.user_id).maybeSingle();
      if(!employee)return json({error:'Esta conta não pertence à equipe.'},403);
    }
    const {error}=await admin.auth.admin.updateUserById(profile.user_id,{password});
    if(error)return json({error:'Não foi possível redefinir a senha.'},500);
    return json({ok:true,email,password,kind,userId:profile.user_id});
  }
  const {data:created,error:createError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,
  });
  if(createError||!created.user){
    const duplicate=/already|registered|exists/i.test(createError?.message||'');
    return json({error:duplicate?'Este e-mail já possui uma conta. Use o vínculo de cliente existente.':'Não foi possível criar este acesso.'},duplicate?409:400);
  }
  const userId=created.user.id;
  if(kind==='client'){
    const {error}=await admin.from('portal_project_members').insert({project_id:projectId,user_id:userId});
    if(error){await admin.auth.admin.deleteUser(userId);return json({error:'Não foi possível vincular o projeto.'},500)}
  }else{
    const {error}=await admin.from('portal_staff').insert({user_id:userId,role:staffRole});
    if(error){await admin.auth.admin.deleteUser(userId);return json({error:'Não foi possível registrar o colaborador.'},500)}
  }
  return json({ok:true,email,password,kind,userId});
});
