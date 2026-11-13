# Área do Cliente — Obra, Financeiro e aprovações

## Implantação
- Supabase: tabelas `portal_project_assets`, `portal_payments`, `portal_stage_approvals`; novas colunas `description` e `requires_approval` em `portal_stages`.
- O bucket `santrelle-clientes` segue privado. PDFs, imagens e comprovantes são enviados para esse bucket; o acesso exige autenticação e vínculo ao projeto ou autorização da equipe.
- A equipe configura as informações em `portal-gerenciar.html`, abrindo **Gerenciar** em um projeto online.
- O cliente acessa `cliente.html`. Só aparecem lançamentos e arquivos marcados como **Liberado**.
- Ative uma etapa para o cliente pelo controle já existente **Liberar etapa**. Depois, ele terá um botão de confirmação. Os dados de aprovação (conta e horário) são gravados no servidor. Não existe opção de revogação no portal.
- Ao avançar a etapa atual no painel online, o navegador exige ao menos uma aprovação registrada para cada etapa anterior marcada como obrigatória. Esta verificação de fluxo é da interface do portal; não é bloqueio na função de atualização SQL.
- **Aceite não é assinatura digital qualificada** e não substitui documentação formal eventualmente exigida por contrato.
- No financeiro, use o código **Pix copia e cola emitido pelo banco**. O navegador gera a imagem QR a partir desse código; não cria cobranças no banco e não confere a liquidação. A equipe registra o pagamento manualmente.
- A soma do cliente considera apenas os lançamentos que o escritório liberou. Não representa o valor total contratual se ainda existirem lançamentos ocultos.
- O portal online é diferente do painel legado de projetos locais e da sincronização `santrelle_workspace`. Criar/ligar o projeto online ao cliente é necessário para ele ver essas funções.
- Arquivos do computador principal salvos em IndexedDB **não são migrados automaticamente** pelo recurso de sincronização de projetos. Precisam ser anexados ao portal online uma vez.

## Segurança
- RLS por projeto e por equipe.
- A aprovação só pode ser inserida pela própria conta do cliente, em etapa liberada do seu projeto.
- O horário do aceite e o texto são fixados pelo banco. Não há UPDATE ou DELETE para `authenticated`.
- O Pix e os comprovantes só aparecem a um cliente após o escritório liberar cada lançamento.
- Não colocar segredos bancários, senhas nem chaves administrativas em JavaScript.

## Validação necessária antes de uso com clientes
- Testar com um usuário cliente real em um projeto de teste; aprovação, visualização de PDF e isolamento de outro projeto.
- Validar o QR Code gerado com o aplicativo do banco antes de enviar cobrança.
- Confirmar se a política da Santrelle exige que um ou todos os membros vinculados aprovem cada etapa.
