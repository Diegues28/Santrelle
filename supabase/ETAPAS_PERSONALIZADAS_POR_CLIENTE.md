# Etapas personalizadas por projeto — Santrelle

## Projeto-base
A ficha **Novo projeto** agora usa uma cópia completa de `santrelle_phases` (aba **Etapas e modelos**) na ordem oficial cadastrada pelo escritório. Isto inclui **Briefing** antes de Levantamento, além de todas as etapas que forem adicionadas posteriormente. Não existe mais uma lista fixa com apenas quatro etapas.

## Personalização na ficha cadastral
Na seção **03 · Prazos das etapas**, o usuário pode:
- **+ Adicionar etapa** com nome e dias úteis;
- **Excluir** uma etapa somente deste projeto (junto com suas subetapas), mediante confirmação;
- **Arrastar ⠿** para reposicionar, ou clicar nas setas ↑ e ↓ para ordenar sem arrastar;
- Modificar os prazos da etapa e das partes opcionais já existentes.

As ações são mantidas em **rascunho**, sem persistência imediata. Os demais campos preenchidos na ficha (dados do cliente, condomínio, datas etc.) são preservados durante a reordenação. **Salvar e criar projeto** ou **Salvar alterações da ficha** consolida o novo conjunto no registro do projeto e na sincronização Supabase. **Cancelar** abandona as alterações.

## Cronograma e preservação
- Alterações da composição/ordem das etapas disparam o recálculo do cronograma quando há data de início válida.
- O gerador preserva por **nome da etapa** o histórico, responsáveis e estados anteriormente cadastrados nas etapas remanescentes.
- Datas manuais de cronograma indexadas por etapa são remapeadas para acompanhar a etapa correspondente após a mudança de ordem.
- Excluir uma etapa exclui também as subetapas e a etapa correspondente do cronograma recalculado; por isso, o aplicativo pede confirmação.
- Projetos antigos continuam com suas etapas salvas, sem inclusão obrigatória e silenciosa do Briefing; quando necessário, a ficha pode ser ajustada manualmente.
- Modelos do escritório e outros projetos não sofrem alteração ao editar a ficha de um cliente.

## Verificação
Sintaxe JavaScript validada e teste isolado do modelo confirmou Briefing primeiro, todas as etapas em sequência e cópia independente. Ainda é necessário validar a interface no site publicado, com um projeto fictício e um cronograma. Nenhum cliente existente foi modificado durante a implementação.
