# Formulário Dev GPS

Formulário de sete etapas para solicitar uma conversa com Timoteo Dev. As respostas são enviadas para `caiotimoteo9@gmail.com` por uma função da Vercel usando a API do Resend. O envio exige verificação Cloudflare Turnstile no navegador e no servidor.

## Rodar localmente

Use Node.js 22 ou 24. Execute `npm ci` e `npm run dev`. O Vite serve a interface; o endpoint `api/submit.js` precisa do runtime de funções da Vercel e das variáveis descritas em `.env.example` para um teste real. Nunca versionar `.env`.

## Testes

```bash
npm test
npm run build
```

Veja `SECURITY.md` para os controles, testes e limites da revisão de segurança. O limitador gratuito é complementar e funciona por instância; não é um firewall distribuído.
