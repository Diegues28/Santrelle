# Sincronização entre computadores — Santrelle

## Origem dos dados
O aplicativo antigo grava projetos, equipe, entregas, feriados e pós-obra em localStorage, por navegador. O Supabase não tem como recuperar automaticamente os registros do computador principal.

## Primeiro acesso à nova versão
1. **No computador principal, no navegador com todos os cadastros antigos**, entre como administrador da Santrelle.
2. A tela mostrará que não há dados compartilhados; clique em **Baixar backup deste computador**. Guarde o arquivo JSON em local seguro.
3. Clique em **Enviar dados deste computador principal** e confirme. A sincronização criará o primeiro registro central.
4. No outro computador, atualize a página e faça login. Se houver dados locais diferentes, baixe o backup oferecido e selecione **Carregar dados do Supabase**.
5. Depois disso, os computadores sincronizam o estado compartilhado durante o uso. Atualizações são verificadas a cada 12 segundos, e alterações são enviadas após salvar.

**Não clique em Enviar dados no computador vazio.** Se não estiver no principal, use **Continuar sem sincronizar por enquanto**.

O aplicativo preserva um download de backup ao substituir dados locais no primeiro carregamento. Em caso de conflito de gravação, não sobrescreve a outra edição e oferece backup local. Os dados não são mesclados automaticamente.

A migração cobre: projetos, etapas, entregas, feriados, funcionários, funcionários ocultos, pós-obra e as configurações locais de prévia do portal. Os documentos reais do cliente continuam no Storage privado; outras configurações específicas fora desses dados precisam de migração própria.

A migração não remove nem apaga automaticamente os dados antigos do computador. Não limpe o armazenamento do navegador antes de confirmar que a sincronização foi concluída em ambos.

A sincronização funciona como uma base comum por escritório; não é um controle granular de permissões por projeto. Para produção com dados sensíveis, a evolução indicada é migrar cada entidade para tabelas próprias protegidas por RLS.
