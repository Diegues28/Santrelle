# Integração Google Agenda ↔ Santrelle

**Conta central:** santrelleprojetos@gmail.com. O OAuth já estava autorizado no Supabase antes desta implementação.  
**Funções Supabase:** `google-calendar-sync` e `google-calendar-edit`.

## O que sincroniza
- **Google → Santrelle:** a função consulta eventos do calendário principal da conta central, dentro do intervalo de 1 ano atrás a 2 anos adiante, com paginação. Importa para `santrelle_google_events` usando `google_id` como chave única. Atualizações do Google atualizam as entradas importadas. Exclusões/ocultações e mudanças para visibilidade privada deixam de aparecer no aplicativo.
- **Santrelle → Google:** compromissos NÃO privados cadastrados pelo botão **+ Compromisso** são enviados automaticamente com identificador estável `santrelle<uuid>`. Editar o título, data ou horário atualiza o Google. Excluir o compromisso o coloca numa fila de exclusão, processada na próxima sincronização.
- **Reuniões da Área do Cliente:** novas reuniões têm a opção **Enviar ao Google Agenda do escritório** inicialmente marcada. Reuniões antigas permanecem sem seleção para evitar duplicação. Reuniões habilitadas são exportadas com ID estável e hash de alterações; essa via é **Santrelle → Google**, sem importar alterações das mesmas reuniões do Google de volta ao formulário do portal.
- **Eventos Google já existentes:** administrador vê na agenda central e pode atribuir um funcionário ou editar título/data/horário (a edição é gravada no Google). Eventos atribuídos aparecem no calendário e nos avisos do funcionário correspondente. Eventos sem responsável são vistos apenas pelos administradores quando acompanhando todas as agendas.
- **Eventos pessoais/privados da Santrelle:** permanecem apenas na base privada do aplicativo e **não são enviados ao Google**. Eventos marcados como privados no Google não são importados para o painel.
- **Evitar duplicações:** sincronização usa ID Google único e associação de cada evento local e reunião da Área do Cliente à sua identidade estável; reexecuções não criam cópias. Não há tentativa de unir automaticamente compromissos antigos com títulos/datas semelhantes, porque isso poderia combinar reuniões diferentes.

## Quando ocorre
- Ao entrar na Santrelle com uma conta autorizada e não pendente de troca de senha.
- Automaticamente, aproximadamente a cada 90 segundos **enquanto houver uma sessão aberta e o navegador estiver visível**.
- Manualmente em **Configurações gerais → Agenda central → Sincronizar agora**, apenas para administradores.
- Consultas ao banco para outras sessões ocorrem a cada 30 segundos.

## Segurança e compatibilidade
- O refresh token e os segredos OAuth continuam apenas no servidor; não são retornados ao navegador.
- A função de sincronização exige usuário autenticado em `portal_staff` e bloqueia acesso de quem ainda precisa alterar a senha provisória.
- Uma fila/lease evita execução simultânea excessiva; nada é apagado de agendas existentes durante a primeira importação, exceto exclusões futuras de eventos que **foram criados na Santrelle e explicitamente apagados nela**.
- `santrelle_google_events` tem RLS: administradores visualizam os eventos não privados, funcionários visualizam somente os atribuídos a seus nomes vinculados ao e-mail em Equipe. O cargo admin é necessário para atribuir ou editar eventos Google.
- As credenciais Google OAuth do projeto devem permanecer configuradas em Supabase Edge Secrets; se o modo de testes do Google causar expiração do refresh token, será necessário reconectar.
- Não há acesso aos calendários Google pessoais de cada funcionário: a única conta conectada é a agenda central.

## Limitações e validação
- Esta implementação **não instala um cron independente**: a sincronização periódica com o Google depende de alguém estar com a Santrelle aberta. A comunicação interna entre usuários permanece vinculada ao Supabase.
- Reuniões da Área do Cliente habilitadas são exportadas; mudanças feitas no Google nessas reuniões não voltam automaticamente ao formulário de reunião da Área do Cliente.
- Compromissos antigos no Google, sem responsável, precisam ser atribuídos manualmente para aparecer para funcionários comuns.
- A sincronização de eventos da agenda Google não altera tarefas, subetapas ou prazos gerados automaticamente pelos projetos.
- Arquivos JS e tabelas/funções SQL foram inspecionados, mas **não foi possível executar uma sincronização autenticada Google ponta a ponta desta sessão**. Validar com uma reunião fictícia primeiro, de preferência no futuro e sem convidados externos. O primeiro login após o deploy importará eventos para o espelho protegido, sem criar duplicatas das entradas existentes.
