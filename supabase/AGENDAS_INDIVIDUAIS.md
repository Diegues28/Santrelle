# Agendas individuais e calendário por funcionário — Santrelle

## No Painel geral
- A identificação do usuário vem do login Supabase (`portal_staff.role` e `auth.users.email`) e do campo `santrelle_employees[].email`, cadastrado em **Equipe**.
- **Colaboradores:** a lista de entregas em atenção e o calendário mensal são filtrados pelo nome do funcionário vinculado ao e-mail. Atividades de outros responsáveis não aparecem nesses dois componentes.
- **Administradores:** veem todas as equipes por padrão e podem marcar/desmarcar quais funcionários acompanhar. A seleção fica em `santrelle_calendar_preferences` individual por conta. Com a seleção restrita, marcos agregados do projeto também usam os responsáveis atribuídos.
- A regra já existente da lista de atenção continua considerando somente a primeira subetapa pendente de cada projeto, sem empilhar todas as etapas futuras.
- Reuniões em **Área do Cliente → Configurar → Próximas reuniões** agora têm campo **Responsável pela reunião**. Assim, reuniões atribuídas entram no calendário e na lista de atenção da pessoa correspondente.
- Um compromisso adicional pode ser cadastrado pelo botão **+ Compromisso**, com data e horário, nas categorias reunião, compromisso ou pessoal. Eventos pessoais ficam privados e só aparecem para a própria conta. Compromissos não privados podem ser visualizados pelos administradores e são sincronizados entre computadores pelo Supabase.
- Eventos da tabela dedicada são recarregados periodicamente enquanto a página está visível. A alteração de responsáveis nas reuniões do portal permanece sujeita à sincronização do workspace já existente.

## Segurança e limitações
- Eventos pessoais são separados na tabela `public.santrelle_calendar_events` com RLS por usuário. A função administrativa `santrelle_calendar_team_events()` só entrega eventos não privados a contas administradoras.
- **O filtro das tarefas de projetos é uma preferência de visualização do Painel geral, não uma separação de permissões de leitura da base de projetos.** O workspace legado `santrelle_workspace` ainda é compartilhado com os colaboradores autorizados; esse trabalho não implementa isolamento de dados de projetos no banco, nem modifica todas as outras telas (Projetos, Área do Cliente, Pós-obra).
- Para um colaborador enxergar suas tarefas, o e-mail utilizado no login precisa corresponder exatamente ao e-mail de um cadastro em **Equipe**. Sem vínculo, ele verá seus compromissos pessoais, mas não terá tarefas atribuídas automaticamente.
- Os marcos do calendário sem responsável específico não são mostrados aos colaboradores. Administradores veem marcos gerais quando a opção de acompanhar toda a equipe estiver ativa.
- A integração **Google Agenda ↔ Santrelle não foi ativada**. Requer conta Google escolhida, consentimento OAuth e sincronização bidirecional. A agenda atual é interna ao app Supabase.
- A página de métricas e outras telas mantêm a base anterior; o escopo individual foi aplicado à lista de atenção e ao calendário.

## Validação necessária
Verificar com contas de teste de colaborador e administrador, responsáveis corretos, dois computadores e compromissos pessoais. Não foram criados nem alterados eventos ou cadastros de clientes reais para os testes. Também não foi possível confirmar a atualização do site no GitHub Pages.
