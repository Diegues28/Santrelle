# Santrelle Arquitetura — preparação do Supabase Storage

> **Status: preparado, NÃO implantado.** Este diretório contém uma proposta de base para ativar o portal com segurança, depois que for criada a organização **Santrelle Arquitetura** e um projeto Supabase separado do OmniSpectra.

## 1. Criar organização própria (ação da proprietária da conta)

1. Entrar em <https://supabase.com/dashboard/new>.
2. Criar uma organização chamada **Santrelle Arquitetura**, com plano **Free (US$ 0)**.
3. Concluir e informar no ChatGPT que a organização já foi criada. **Não informar senhas, chaves secretas ou tokens.**
4. O assistente poderá localizar a organização conectada, verificar orçamento do projeto e solicitar a criação de um projeto nela. Região recomendada: `sa-east-1` (São Paulo), quando disponível.
5. O limite atual é de dois projetos ativos gratuitos somados às organizações em que a conta é Owner/Admin. Consulte <https://supabase.com/docs/guides/platform/billing-on-supabase>.

## 2. Preparar o armazenamento privado (assistente, após criar o projeto)

O arquivo [portal_storage_setup.sql](portal_storage_setup.sql) estabelece:

- Um bucket de documentos **privado**, nunca público.
- Limite de **50 MB por arquivo** (sujeito à configuração global do plano Free).
- Tabelas de projetos, vínculos de acesso, liberações por etapa, revisões e documentos.
- RLS em todas as tabelas novas, com **nenhuma permissão de leitura para visitantes anônimos**.
- Clientes autenticados podem ver somente documentos do **seu projeto**, com **publicação individual**, **etapa liberada** e **revisão liberada**, quando aplicável.
- Somente contas explicitamente vinculadas como `staff` podem cadastrar documentos e realizar uploads.
- Os arquivos não contêm nomes pessoais no caminho. Não há permissão de download por URL pública.
- A administração das associações de usuários com projetos fica **fora do navegador** até criarmos um fluxo seguro de convites/autorização.

**Não executar** o script no projeto OmniSpectra. O SQL deve ser aplicado e validado no novo projeto Santrelle, de preferência via migration controlada.

## 3. O que ainda é necessário para envio real de arquivos

A interface atual é um protótipo: selecionar arquivo do computador/celular mostra nome/tamanho, mas **não envia o conteúdo**.

Após a criação do Supabase Santrelle, faltam:

1. Configurar **Supabase Auth** por código temporário enviado por e-mail (não usar os últimos quatro dígitos do telefone como senha).
2. Criar as contas de equipe e associar explicitamente usuários a projetos como `staff` ou `client`, sem usar `user_metadata` como base de autorização.
3. Conectar os projetos locais do Santrelle à tabela de projetos do novo backend; nenhuma migração automática de dados privados será feita sem revisão.
4. Integrar o botão **Selecionar arquivo** com o Storage: criar metadados **não publicados**, fazer upload autorizado e publicar só quando o envio tiver sido concluído e verificado.
5. Sincronizar liberações de etapas e revisões com as respectivas tabelas do banco (não confiar na variável local do navegador para autorização).
6. Exibir/baixar arquivos usando a sessão do usuário e as políticas RLS do bucket privado; URLs assinadas, se necessárias, com validade curta.
7. Garantir que a interface interna do escritório também use login e permissões; as informações atuais do protótipo ainda são locais ao navegador.
8. Projetar exclusão/substituição/versionamento seguros; nesta primeira proposta, o upload é **somente de novos objetos**.

## 4. Testes obrigatórios antes de liberar o portal

- Visitante anônimo não lista projetos, documentos ou arquivos.
- Cliente A não consegue listar, abrir ou baixar documentos do cliente B, mesmo com o nome do arquivo.
- Cliente A não consegue inserir, atualizar, excluir nem publicar documentos.
- Cliente A não consegue ver documentos ocultos, de etapas bloqueadas nem revisões não liberadas.
- Ao liberar etapa, somente documentos publicados ficam visíveis; ao bloquear novamente, deixam de ficar.
- Equipe autorizada consegue cadastrar documento e fazer upload no projeto correto.
- Equipe sem vínculo com o projeto não consegue ler nem carregar arquivos.
- Erros no upload não deixam o documento parcialmente publicado.
- Confirmação de e-mail, sessões e expiração são testadas no computador e no celular.
- **Nunca** colocar `service_role` / chave secreta no `index.html` ou em arquivos publicados pelo GitHub Pages.

## Referências da documentação

- <https://supabase.com/docs/guides/storage/security/access-control>
- <https://supabase.com/docs/guides/storage/buckets/fundamentals>
- <https://supabase.com/docs/guides/auth/auth-email-templates>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/platform/billing-on-supabase>
