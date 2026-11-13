# Conexão Google Agenda — Santrelle

**Conta autorizada:** santrelleprojetos@gmail.com.  
**URI callback:** https://hyerhuhwplhykauynnqg.supabase.co/functions/v1/google-calendar-callback

## Preparação administrativa
1. Google Cloud Console → projeto Santrelle Arquitetura → Google Auth Platform → Clientes → **Santrelle – Google Agenda**.
2. Confirmar a URI de redirecionamento exatamente igual à indicada acima.
3. Abrir **Supabase Dashboard → Edge Functions → Secrets**.
4. Cadastrar as variáveis abaixo, exclusivamente no Supabase (NÃO no GitHub, no HTML ou em mensagens):
   - `GOOGLE_CALENDAR_CLIENT_ID`: ID de cliente OAuth do tipo Aplicativo da Web, exibido no Google Cloud.
   - `GOOGLE_CALENDAR_CLIENT_SECRET`: chave secreta de cliente OAuth. Se o Google não permitir visualizar a chave existente, gerar outra nas configurações do cliente OAuth e salvar imediatamente como Secret do Supabase.
5. No Google Auth Platform, manter `santrelleprojetos@gmail.com` como usuário de teste, enquanto o OAuth estiver em teste.

## Fluxo
Apenas usuários com perfil `admin` no `portal_staff` podem iniciar a conexão. O botão em **Configurações gerais → Agenda central do escritório → Conectar Google Agenda** consulta `google-calendar-start`, que emite estado aleatório com prazo de 10 minutos e prepara a autorização com `calendar.events`, `openid` e `email`.
O Google redireciona para a Edge Function `google-calendar-callback`. A função valida o estado de uso único, a autorização do administrador e o endereço autenticado do Google. Só aceita `santrelleprojetos@gmail.com`. Armazena o refresh token no banco com RLS, sem permissão de leitura para `anon` ou `authenticated`.
A autorização retorna ao app com parâmetro `google_calendar` indicando resultado; o painel consulta o estado diretamente no Supabase.

## Limites
- **OAuth ainda não estará funcional até configurar os dois segredos do servidor.**
- Esta etapa conclui somente a autorização e armazenamento seguro do vínculo: **não importa eventos existentes nem envia novas reuniões ao Google**. A rotina de sincronização e resolução de conflitos será implementada separadamente.
- O refresh token fica armazenado em tabela protegida por RLS, com acesso de service role; restringir acesso administrativo e backups do projeto.
- Contas no modo de teste do Google podem precisar reconectar com periodicidade, porque refresh tokens podem expirar.
- Testar o login e a autorização com conta admin real; nenhum token foi conectado nesta implementação.
