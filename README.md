# Encurtador

Encurtador de URLs com contas, analytics e QR Codes. Os números do painel vêm do SQLite local. Não há dados de demonstração.

## 🚀 Demo

Ainda não há uma versão publicada. Depois de rodar localmente, abra [http://localhost:3000](http://localhost:3000).

## 🛠️ Tecnologias

- Node.js 22.5 ou mais recente
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- SQLite (`node:sqlite`)
- bcryptjs
- qrcode
- Auth.js

## ✨ Funcionalidades

- Cadastro, login com e-mail ou Google, recuperação de senha e sessão em cookie httpOnly
- Encurtamento com slug automático ou personalizado, título, tags e descrição
- Expiração, senha, ativação e redirecionamento 302 ou 301
- Dashboard com cliques, dispositivos, navegadores, sistemas e origem do tráfego
- Analytics por link, com estimativa de únicos por dia
- QR Code do link curto, com cores, PNG e SVG
- Busca, filtro, ordenação, paginação e exportação em CSV
- Tema claro, escuro ou do sistema
- Política de privacidade em `/privacy`

## 📦 Como rodar localmente

```bash
npm install
npm run dev
```

O gerenciador do projeto é o npm, com o lockfile `package-lock.json`. É preciso Node.js 22.5 ou mais recente, porque o banco usa `node:sqlite`.

Abra [http://localhost:3000](http://localhost:3000) e crie a primeira conta. Essa conta é a administradora e é a única que abre ou fecha o cadastro. O banco fica em `data/encurtador.sqlite`.

O arquivo SQLite precisa de disco persistente e de uma única instância do processo. A segunda instância recusa abrir o mesmo banco. Um ambiente serverless, como a Vercel, não serve para este banco.

Para copiar o banco sem desligar a aplicação:

```bash
npm run backup
```

A cópia fica em `data/backups/`. Para voltar um backup, pare a aplicação e rode `npm run restore -- data/backups/nome-do-arquivo.sqlite`.

Se a instalação estiver atrás de um proxy reverso, defina `TRUST_PROXY=1`. O IP considerado é o último valor de `X-Forwarded-For`, aquele que o proxy acrescenta. Sem essa variável, a aplicação ignora os cabeçalhos de IP, de país e de host enviados pelo cliente. Em produção, as páginas enviam HSTS e uma CSP com nonce nos scripts.

Uma conta criada com senha não entra pelo Google. O Google só abre uma conta que já nasceu nele, ou cria uma conta nova quando o cadastro está aberto.

Copie `.env.example` para `.env` quando for definir o segredo. `AUTH_SECRET` precisa ter pelo menos 32 caracteres. Se ficar vazio, a aplicação gera um segredo e guarda em `data/auth-secret`. `EXPOSE_RESET_LINK=true` mostra o link de redefinição na tela durante o desenvolvimento. Em produção esse link nunca aparece.

Para o botão “Entrar com o Google”, preencha `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` e coloque `AUTH_SECRET` no `.env`. No Google Cloud, o URI de redirecionamento autorizado é `http://localhost:3000/api/auth/callback/google`. Sem essas variáveis, o login com e-mail e senha continua disponível.

## Analytics e privacidade

Um clique pode registrar data e hora, dispositivo, navegador, sistema, categoria de origem e o domínio do referenciador. País, região e cidade só entram com `TRUST_PROXY=1` e quando o proxy envia esses cabeçalhos. O IP completo não é armazenado. Prefetch e robôs conhecidos redirecionam, mas não contam.

A retenção padrão é de 365 dias e pode ser alterada nas configurações. Excluir os analytics zera os eventos e o total do link. A limpeza por retenção apaga eventos antigos e mantém o total acumulado.

Um redirecionamento 301 pode ser memorizado pelo navegador e deixar de gerar novos registros. Um QR Code gerado em localhost só abre nesta máquina. Para imprimir, configure o domínio público nas configurações.
