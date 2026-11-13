# Sincronização automática da Santrelle

A partir desta alteração, toda conta autorizada entra carregando automaticamente a versão do Supabase. Nenhum computador precisa selecionar "Enviar", "Baixar backup", "Continuar localmente" ou "Carregar dados". A antiga mensagem no rodapé sobre migração foi retirada.

- **Fonte única:** tabela `public.santrelle_workspace` (`id=1`, payload JSON compartilhado, revisão).
- **Login:** após autenticação, recupera os dados centrais automaticamente; se não conseguir acessar o banco, bloqueia a entrada em vez de disponibilizar um modo local não sincronizado.
- **Sincronização:** edição dispara envio automático com intervalo curto; outras sessões recebem as atualizações por consulta periódica (12 s) e quando a aba volta a ficar ativa.
- **Histórico local:** se existir uma versão antiga diferente no navegador durante o login, uma cópia de recuperação é registrada de forma silenciosa em `localStorage.santrelle_local_recovery_snapshot` e os dados da nuvem passam a ser exibidos. Nenhum arquivo é baixado e nenhuma escolha é solicitada.
- **Edições simultâneas:** em caso de conflito de revisão, reconsulta o Supabase e tenta mesclar campos e registros identificados por `id`/`name`, com novas tentativas. Uma cópia da divergência é registrada no navegador. Em conflito de valor da mesma propriedade, prevalece a edição local mais recente durante a mesclagem; essa regra pode exigir revisão administrativa de alterações disputadas.
- **Falha persistente:** o status avisa que a sincronização está pendente, sem fazer download automático nem bloquear a tela com modal. O navegador preserva uma cópia para recuperação.
- **Permissões:** as regras do banco continuam vigentes. Esta alteração não muda acesso a dados por função nem habilita sincronização Google Agenda.

**Validação:** sintaxe JS e mesclagem com dados fictícios foram verificadas. É necessário testar no site publicado com dois computadores conectados usando um projeto demonstrativo, sobretudo edições simultâneas. Nenhum dado real do workspace foi modificado pela correção.
