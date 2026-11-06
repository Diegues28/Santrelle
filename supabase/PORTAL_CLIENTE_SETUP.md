# Portal online Santrelle — implantação

O projeto Supabase **Santrelle** já recebeu as tabelas e políticas do arquivo
`portal_cliente_seguro.sql`. Todas as tabelas usam RLS; o bucket
`santrelle-clientes` é privado. **Nunca publique uma chave secret/service_role.**

## Antes de ativar o login do escritório

1. No Supabase, em **Authentication → URL Configuration**, definir:
   - Site URL: `https://diegues28.github.io/Santrelle/cliente.html`
   - Redirect URL: `https://diegues28.github.io/Santrelle/cliente.html`
2. Cadastrar a **primeira conta de administrador** pelo painel Supabase
   (**Authentication → Users → Add user**) e marcar o e-mail como confirmado.
   Esta etapa inicial é necessária para evitar criação pública de administradores.
3. No SQL Editor do projeto, executar, substituindo pelo e-mail autorizado:

   ```sql
   insert into public.portal_staff(user_id,role)
   select id,'admin' from auth.users where lower(email)=lower('EMAIL_DA_EQUIPE_AQUI');
   ```

4. Abrir `portal-gerenciar.html`, entrar com a conta administradora e criar
   as demais contas da equipe e dos clientes. O sistema gera uma senha provisória
   forte, exibida uma única vez ao administrador. Entregá-la por canal seguro e
   orientar a pessoa a trocá-la após o primeiro acesso.
5. O cliente entra em `cliente.html` com o e-mail cadastrado e a senha provisória.
   Não precisa criar conta ou receber e-mail de confirmação.
6. Para cada etapa, pasta e arquivo, usar **Liberar**. Nada é liberado por
   padrão. O formulário de documento aceita PDF, JPG e PNG, até 20 MB.

O `index.html` também recebeu a tela de login do escritório. **Não mescle a
branch enquanto o primeiro administrador não estiver criado e os testes não
estiverem concluídos**, pois isso bloquearia a interface atual.

Não é necessário SMTP para o cadastro com senha provisória. Caso a equipe
queira recuperação automática de senha por e-mail no futuro, será necessário
um serviço de SMTP próprio.

## Dados antigos

O aplicativo do escritório ainda mantém projetos e a prévia antiga em
`localStorage`. **Não existe migração automática** desses dados ao banco,
e os documentos de demonstração da prévia não são arquivos reais.
A gestão online é uma nova área, ligada na navegação da Área do Cliente.
Não apague os dados do navegador nem copie dados sigilosos para o GitHub.

## Limites do plano gratuito

O Supabase Free oferece atualmente até 1 GB de arquivos e pode pausar após
inatividade. Faça acompanhamento dos limites no painel. O envio de e-mail
é um serviço separado, que requer configuração própria para clientes reais.

## Verificações realizadas

- O projeto Supabase foi restaurado e suas 8 tabelas do portal possuem RLS.
- O bucket `santrelle-clientes` foi confirmado como privado.
- A auditoria Supabase de segurança não retornou alertas após a correção.
- O código JavaScript passou em `node --check`.
- **Pendente:** provisionamento da primeira administradora e teste ponta a ponta com outra conta de equipe e outra de cliente,
  incluindo download e tentativa de acesso ao projeto de terceiros.
