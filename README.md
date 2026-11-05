# Formulário Dev GPS

Formulário de oito etapas para solicitar uma conversa com Timoteo Dev. As respostas são enviadas para `caiotimoteo9@gmail.com` por uma função da Vercel usando a API do Resend.

## Rodar localmente

```bash
npm install
npm run dev
```

O Vite mostra a interface local. Para testar o envio de e-mail com a função `/api/submit`, use `vercel dev` depois de configurar as variáveis abaixo; o servidor Vite sozinho não executa funções da Vercel.

## Publicar na Vercel

1. Importe este repositório na Vercel. O build usa `npm run build` e publica `dist`.
2. Crie uma conta no [Resend](https://resend.com) e valide um domínio seu para envio de e-mail.
3. Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` nas variáveis de ambiente do projeto Vercel. Exemplo de remetente: `Timoteo Dev <contato@seudominio.com.br>`.
4. Faça um novo deploy. Envie uma resposta de teste e confirme que ela chegou em `caiotimoteo9@gmail.com`.

Não coloque a chave do Resend no repositório nem em variáveis `VITE_`. O destinatário fica definido somente na função de servidor. O endereço usado como remetente precisa estar autorizado no Resend.

## Testes

```bash
npm test
npm run build
```
