# Formulário Dev GPS

Formulário de sete etapas para solicitar uma conversa com Timoteo Dev. As respostas são enviadas para `caiotimoteo9@gmail.com` por uma função da Vercel usando a API do Resend. O envio exige verificação Cloudflare Turnstile no navegador e no servidor.

## Rodar localmente

```bash
npm install
npm run dev
```

O Vite mostra a interface local e usa a chave de teste oficial do Turnstile. Para testar o envio de e-mail com a função `/api/submit`, use `vercel dev` depois de configurar as variáveis abaixo; o servidor Vite sozinho não executa funções da Vercel.

## Publicar na Vercel

1. Importe este repositório na Vercel. O build usa `npm run build` e publica `dist`.
2. Crie uma conta no [Resend](https://resend.com) e valide um domínio seu para envio de e-mail.
3. Crie um widget no [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/) para o domínio final do formulário. Use o modo gerenciado ou invisível e autorize exatamente o domínio em que o formulário ficará.
4. Configure as quatro variáveis de ambiente do projeto Vercel: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VITE_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`. Exemplo de remetente: `Timoteo Dev <contato@seudominio.com.br>`. A chave `VITE_` é pública; as outras chaves ficam só no servidor.
5. Faça um novo deploy. Envie uma resposta de teste e confirme que ela chegou em `caiotimoteo9@gmail.com`. Confira também o cabeçalho de segurança e a página `/privacidade.html` no domínio publicado.

Não coloque `RESEND_API_KEY` nem `TURNSTILE_SECRET_KEY` no repositório ou em variáveis `VITE_`. Não use chaves de teste do Turnstile em produção. O destinatário fica definido somente na função de servidor. O endereço usado como remetente precisa estar autorizado no Resend. Sem as chaves de produção, a função responde com erro e não tenta enviar e-mail.

O formulário inclui validação no servidor, limite de tamanho da requisição, campo antispam invisível, token Turnstile validado pelo Cloudflare, identificador para evitar e-mails duplicados em novas tentativas, respostas sem cache e cabeçalhos de segurança. A página de privacidade informa quais dados são coletados. O responsável pelo projeto deve revisar esse aviso e gerenciar a retenção das mensagens recebidas.

A fonte DM Sans é servida pelo próprio site. Sua licença SIL OFL está em `public/dm-sans-license.txt`.

Após publicar, configure no Firewall da Vercel uma regra de limite de requisições para o caminho `/api/submit` e acompanhe os eventos de bloqueio. O formulário não usa cookies de autenticação nem salva as respostas em banco de dados; o rascunho fica apenas na sessão do navegador e a resposta final chega por e-mail.

## Testes

```bash
npm test
npm run build
```
