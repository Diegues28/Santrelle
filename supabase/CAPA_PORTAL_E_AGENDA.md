# Painel e capa do projeto no portal

## Página inicial
A seção **Entregas que precisam de atenção** foi movida para logo abaixo dos indicadores gerais, antes do calendário de entregas.

## Prévia do cliente (painel interno)
Em Área do Cliente > Configurar projeto > Capa do projeto, selecione um PDF. O sistema renderiza apenas sua **primeira página** como uma imagem JPEG, com sobreposição clara para leitura do título e saudação. A imagem fica vinculada ao projeto da prévia e segue a sincronização compartilhada do workspace depois do envio inicial. O PDF original **não** é armazenado por esse campo. Limite: 15 MB de PDF; JPEG convertido no máximo 600 KB.

## Portal real de login
Em **Gestão da Área do Cliente > Gerenciar projeto**, a opção **Capa do projeto** recebe o PDF e envia a primeira página convertida a JPEG ao bucket privado `santrelle-clientes`. O caminho da capa é salvo no `portal_projects.cover_path`. A sessão autenticada do cliente recebe um URL assinado de vida limitada e apresenta a imagem atrás da saudação. Cada projeto possui capa própria.

**Observação:** a prévia local e o portal real são cadastros diferentes; configurar a capa em um não cadastra automaticamente no outro. A migração/mapeamento desses projetos continua pendente.

## Google Calendar
A sincronização bidirecional com a conta do escritório **não foi ativada**. Exige Google OAuth com consentimento para calendário, tokens armazenados em backend (nunca no JavaScript público), mapeamento entre eventos do Google e entregas/projetos Santrelle, e regra contra conflitos/duplicações. O Supabase pode hospedar a ponte segura. A integração deve usar um calendário dedicado do escritório e testes com dados demonstrativos antes de habilitar escrita nos dois sentidos.
