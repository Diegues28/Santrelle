# Portal online Santrelle — implantação

O projeto Supabase **Santrelle** já recebeu as tabelas e políticas do arquivo
`portal_cliente_seguro.sql`. Todas as tabelas usam RLS; o bucket
`santrelle-clientes` é privado. **Nunca publique uma chave secret/service_role.**

## Antes de convidar clientes

1. No Supabase, em **Authentication → URL Configuration**, definir:
   - Site URL: `https://diegues28.github.io/Santrelle/cliente.html`
   - Redirect URL: `https://diegues28.github.io/Santrelle/cliente.html`
2. Configurar SMTP próprio em **Authentication → SMTP Settings**. O servidor
   de e-mails padrão do Supabase não envia confirmações a usuários externos à
   equipe. Resend e Brevo possuem opções gratuitas, sujeitas a cotas e domínio.
   Guardar as credenciais **somente no painel do Supabase**.
3. Cadastrar/confirmar o e-mail da primeira pessoa da equipe em
   `cliente.html` (botão **Criar acesso**). O vínculo de equipe não acontece
   automaticamente.
4. No SQL Editor do projeto, **depois** da confirmação do e-mail, executar,
   substituindo pelo endereço autorizado da Santrelle:

   ```sql
   insert into public.portal_staff(user_id)
   select id from auth.users where lower(email)=lower('EMAIL_DA_EQUIPE_AQUI');
   ```

5. Abrir `portal-gerenciar.html`, entrar com a mesma conta e cadastrar os
   projetos online. Os clientes criam as próprias contas em `cliente.html`,
   confirmam o e-mail e a equipe vincula o e-mail ao projeto.
6. Para cada etapa, pasta e arquivo, usar **Liberar**. Nada é liberado por
   padrão. O formulário de documento aceita PDF, JPG e PNG, até 20 MB.

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
- **Pendente:** teste ponta a ponta com uma conta de equipe e outra de cliente,
  incluindo download e tentativa de acesso ao projeto de terceiros.
