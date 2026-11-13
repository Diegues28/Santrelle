# QR Code Pix estático na Área do Cliente

A administração envia a **imagem PNG ou JPG** do QR Code Pix do escritório em **Gestão da Área do Cliente → Gerenciar projeto → Pix do escritório**. O arquivo fica no bucket privado `santrelle-clientes` e o caminho é armazenado em `public.portal_projects.pix_qr_path`. A imagem é compartilhada com os clientes autorizados naquele projeto.

A área do cliente mostra a imagem na seção Financeiro. O pagamento e o valor são preenchidos no aplicativo bancário do cliente, não no portal Santrelle.

**Antes de enviar**, gere o QR Code Pix **estático e sem valor preenchido** no aplicativo do banco do escritório; confira o destinatário e faça um pagamento de teste autorizado, se possível. O portal não lê o conteúdo da imagem, não valida automaticamente a chave Pix, nem recebe confirmação automática de pagamento. O financeiro registra manualmente as parcelas pagas.

Se já houver um QR Code por parcela gerado a partir de um código copia e cola, o portal prioriza a imagem Pix fixa do projeto e não mostra os dois ao mesmo tempo. A imagem enviada pode ser substituída por um novo upload.

Limite do envio: 5 MB, PNG ou JPG. A visualização usa URL assinado temporário. O código original e a política de segurança ficam no Supabase.

A funcionalidade deve ser testada com uma conta real de cliente e com o QR do banco antes de liberar para uso financeiro.
