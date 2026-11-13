# Área do Cliente — concluir projeto e exclusão por senha

## Concluir e encaminhar para Pós-obra
No gestor interno `index.html`, abra **Área do Cliente → Configurar** o projeto. Ao final da página está **Concluir projeto e encaminhar para Pós-obra**.

A ação:
- muda o projeto existente para **Concluído** por `changeProjectStatus()`;
- preserva ficha cadastral, histórico, cronograma, documentos da prévia e demais dados;
- cria um acompanhamento de pós-obra com referência ao **mesmo ID do projeto**, apenas se ainda não houver um;
- atualiza a etapa de prévia para **Pós-obra**;
- abre o acompanhamento sem duplicar o cliente.

Projetos já concluídos podem abrir ou iniciar seu pós-obra pelo mesmo botão.

## Excluir cadastro interno
No final da página **Área do Cliente → Configurar** ficam **Cadastrar / trocar senha de exclusão** e **Excluir cadastro interno do cliente**.
Somente usuários com papel de `admin` no Supabase podem configurar ou usar a senha; a senha tem no mínimo 10 caracteres, é armazenada como hash bcrypt e nunca é exibida ou incluída no arquivo JavaScript. Para mudar uma senha existente é necessário informar a atual.
A exclusão exige o texto EXCLUIR e, depois, a senha administrativa. A verificação é realizada na função SQL do servidor `santrelle_delete_workspace_project` e não pode ser contornada por uma sincronização de projeto normal: um gatilho recusa remoção de projetos no payload compartilhado fora da ação administrativa.
A função remove o projeto, as entregas vinculadas, o pós-obra vinculado e a prévia local correspondente do JSON compartilhado. A revisão é incrementada para os outros computadores receberem a atualização. É guardada uma cópia completa anterior à exclusão em `santrelle_private.deleted_projects`, sem acesso público.
Uma senha incorreta não executa a exclusão; após cinco erros seguidos, existe bloqueio de novas tentativas por 15 minutos.

**Escopo importante:** esta operação não remove contas autenticadas do Supabase nem projetos independentes do portal online `portal_projects`, porque não há mapeamento automático confiável entre os cadastros legados e as contas do portal. Anexos legados em IndexedDB podem continuar no computador antigo e precisam de limpeza/migração separada. Para o encerramento normal do contrato, preferir concluir o projeto, nunca excluir.

## Validação antes do uso real
Conferir o carregamento em GitHub Pages, cadastrar uma senha de teste com o administrador, simular senha incorreta e confirmar que nenhum projeto foi excluído. Testar **Concluir → Pós-obra** com um projeto demonstrativo, checar se o mesmo cadastro permanece em Projetos concluídos e se o vínculo é correto em outro computador. Não foi feita exclusão de nenhum projeto real durante a implementação.
