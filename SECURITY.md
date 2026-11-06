# Revisão de segurança — DEV GPS

Revisão de 6 de novembro de 2026. Nenhuma revisão elimina todos os riscos.

## Escopo e evidências

- Código do formulário, endpoint, validações, configuração Vercel e seis commits do histórico disponíveis na revisão.
- Busca de padrões de chaves Resend, AWS e chaves privadas no histórico: nenhuma correspondência. Isso não prova ausência de todo tipo de segredo.
- `npm audit` de produção e desenvolvimento: zero vulnerabilidades conhecidas no momento da revisão.
- `npm test` e `npm run build`: executar a cada alteração. O comando de testes foi corrigido para funcionar no Node 24.
- Envio real anterior à revisão: sete respostas, tela de confirmação e Resend `Delivered` para o destinatário fixo. Repetir depois do deploy desta revisão.

## Controles

- Segredos somente nas variáveis de produção da Vercel; nenhuma chave privada deve ter prefixo `VITE_`.
- Resend com acesso de envio restrito ao domínio; destinatário fixo no servidor, sem aceitar `to` do cliente.
- API somente POST/JSON, limite de corpo de 8192 bytes, campos permitidos e validação de tipos/tamanhos.
- Origem obrigatória, domínio exato e HTTPS na Vercel. Em produção, somente os dois endereços públicos do formulário são aceitos.
- Turnstile verificado no servidor: sucesso, hostname e ação; chaves de teste recusadas fora de desenvolvimento. Sem chave ou falha de validação, não envia.
- Escape HTML, proteção do assunto e validação de `reply_to`; erros públicos sem chaves, respostas completas de provedores ou pilhas de execução.
- Idempotência do Resend e identificador UUID para reduzir duplicatas nas tentativas de reenvio.
- CSP, bloqueio de iframe, HSTS, `nosniff`, política de referência e `Cache-Control: no-store` na API.
- Não há banco de dados, área administrativa ou execução de comandos baseada nas respostas neste projeto.

## Limitador complementar gratuito

Dez tentativas válidas no formato esperado por IP por minuto, por instância quente da função; excesso retorna 429 e `Retry-After` antes dos provedores externos. Usa somente o cabeçalho `x-vercel-forwarded-for` da plataforma quando `VERCEL=1`; fora dela usa o endereço do socket. Não confia em cabeçalhos arbitrários do cliente. Guarda hashes com salt temporário e até 10 mil contadores, removendo entradas expiradas.

**Não é uma cota global/distribuída:** reinícios e múltiplas instâncias reiniciam/separam os contadores; IP ausente/inválido e capacidade esgotada não criam um bloqueio global. Não impede ataques distribuídos nem garante controle de custos. O Turnstile continua obrigatório. Um limite global durável exige armazenamento compartilhado ou a função paga de firewall, que não foi ativada nesta revisão.

## Limites e operação do responsável

- A revisão não é um pentest de toda a infraestrutura de Vercel, Cloudflare, Google ou GitHub, nem certificação legal/LGPD.
- Manter autenticação de dois fatores nas contas, revisar colaboradores e acessos, não compartilhar senhas e substituir qualquer senha compartilhada. Trocas de credenciais da conta devem ser feitas pelo titular.
- Acompanhar consumo/erros de envio, manter dependências atualizadas e aplicar limites de gastos conforme a necessidade.
- Definir e aplicar um prazo de retenção para as respostas na caixa de e-mail e atender solicitações de exclusão. O código não apaga mensagens do Gmail.
- A renda, idade e dados de contato são dados pessoais: avaliar a necessidade desses campos e o tratamento de respostas de menores. Não há inferência de conformidade legal nesta revisão.
- A CSP mantém `unsafe-inline` somente em estilos; não permite scripts inline. Não introduzir HTML de terceiros sem revisão.
