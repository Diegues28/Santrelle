# Equipe: e-mail de acesso e exclusão com redistribuição

## Cadastro
- **Equipe → + Funcionário** pergunta nome e e-mail opcional.
- **Equipe → selecionar funcionário → Cadastrar / editar e-mail** permite adicionar ou corrigir um e-mail mais tarde. O e-mail aparece no cabeçalho do funcionário.
- Validação básica de formato e de duplicação entre funcionários cadastrados.
- O endereço fica em `santrelle_employees[].email`, sincronizado pelo workspace do Supabase.
- **Importante:** informar um e-mail NÃO cria conta no Supabase Auth, NÃO envia convite e NÃO concede acesso automaticamente. A ativação da conta com senha e a autorização em `portal_staff` serão tratadas separadamente quando a política de senhas for definida. Não utilizar senha padrão compartilhada sem medidas de segurança.

## Desligamento / Exclusão de funcionário
- Exclusão iniciada na própria ficha da Equipe.
- Antes de excluir, é possível escolher outro funcionário cadastrado para receber responsabilidades ou manter as atribuições históricas.
- Exige a mesma senha administrativa de exclusão de clientes, cadastrada em **Configurações gerais**, com limite de tentativas no Supabase.
- RPC `public.santrelle_remove_employee` valida o papel admin, senha e destinatário. Na mesma transação atualiza a equipe e redistribui campos `owner` de projetos/subetapas, entregas e itens do pós-obra. Nomes, notas e descrições permanecem intactos.
- Exclusão sem destinatário remove apenas do cadastro da Equipe, ocultando o nome da lista; tarefas antigas permanecem atribuídas ao nome.
- Uma cópia do workspace anterior é preservada na tabela privada de recuperação.
- Trigger no banco impede remoção de funcionários por atualização comum do JSON, sem passar pela função protegida.
- Se o e-mail estiver associado a um colaborador comum em `portal_staff`, o acesso desse usuário ao app interno é revogado no banco. A conta de autenticação em `auth.users` continua existente; se for usuário administrador, a exclusão fica bloqueada até o tratamento separado da permissão admin.
- A revogação de vínculo no banco não apaga cópias locais previamente obtidas; finalize sessões e limpe aparelhos corporativos quando aplicável.

## Validação
- Atualizações dos arquivos JS tiveram sintaxe verificada; a função recursiva de transferência de responsáveis foi testada apenas com dados fictícios.
- Falta um teste ponta a ponta com usuários admin/colaborador, funcionário fictício e login real. Nenhum funcionário real foi excluído nesta implementação.
