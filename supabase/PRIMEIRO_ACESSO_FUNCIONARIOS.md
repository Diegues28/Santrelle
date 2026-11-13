# Primeiro acesso de colaboradores — Santrelle

## Comportamento
- Em **Equipe → + Funcionário** ou **Cadastrar / editar e-mail**, um administrador cadastra o e-mail.
- A função administrativa Supabase **criar-acesso** recebe `kind:'staff'` e `staffTemporary:true` e cria conta nova com senha provisória definida no servidor (**709709**), perfil **colaborador** e registro `santrelle_first_access.must_change_password=true`.
- O sistema **não redefine senhas de contas já existentes**. Se o e-mail já possuir conta, o cadastro na Equipe pode ficar salvo, mas o administrador é avisado de que o login não foi recriado.
- Na primeira autenticação, `staff-login.js` consulta `santrelle_first_access`; quando há troca pendente, apresenta **Altere sua senha provisória** e bloqueia o acesso ao app.
- A troca de senha ocorre em uma Edge Function **trocar-senha-provisoria**. O servidor verifica a sessão e a situação de primeiro acesso, exige nova senha com pelo menos 12 caracteres, letras e números, faz a atualização pelo endpoint Supabase Auth autenticado do próprio usuário e só então limpa a pendência.
- A função `portal_is_staff()` não libera dados compartilhados enquanto a troca for obrigatória.
- Depois de concluir, o funcionário entra normalmente com sua senha pessoal. Senhas pessoais não são exibidas ao administrador.

## Segurança e limites
A senha provisória compartilhada de 6 dígitos não é ideal em produção: qualquer pessoa que conheça o e-mail de um novo funcionário e o código pode tentar assumir o primeiro acesso antes dele. Recomenda-se substituir por **convite individual de uso único**, preferencialmente com confirmação do e-mail, assim que possível. Evite divulgar publicamente a combinação.
O e-mail do funcionário deve pertencer ao próprio colaborador e estar correto. O Supabase Auth mantém proteção por senha, mas `email_confirm:true` na conta administrativa não comprova posse do e-mail.
A criação do login é uma segunda operação após salvar o cadastro; caso dê erro (por exemplo, e-mail já utilizado), o sistema informa que o cadastro foi salvo, mas a conta não foi criada.
Conta antiga já criada sem flag de primeiro acesso conserva sua senha e não é redefinida.

## Testes
Validação estática da sintaxe dos arquivos JS, presença das funções no Supabase e RLS. **Não foram criadas contas reais de teste nem foi executado um ciclo completo de login em navegador com e-mail novo**; validar em um usuário fictício do escritório antes de entregar a todos os colaboradores.
