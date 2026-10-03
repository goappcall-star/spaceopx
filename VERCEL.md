# Publicação do LobbyX

## Projeto

- Repositório: `goappcall-star/spaceopx`
- Branch com a migração: `codex/supabase-migration`
- Framework: **TanStack Start**
- Node.js: **24.x**
- Build: `npm run build:vercel` (configurado em `vercel.json`)
- Instalação: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
- Diretório de saída: automático; Nitro gera `.vercel/output`.

O instalador Windows é independente da publicação web. Não configure
`LOBBYX_DESKTOP=1` na Vercel. Não selecione a branch antiga `main` para publicar
estas alterações antes de integrá-las.

## Variáveis na Vercel

Adicione em Production e Preview, antes da compilação:

```dotenv
SUPABASE_PROJECT_ID=txkwmarzcyfbkizphjww
SUPABASE_URL=https://txkwmarzcyfbkizphjww.supabase.co
SUPABASE_PUBLISHABLE_KEY=<chave publicável do novo projeto>
VITE_SUPABASE_PROJECT_ID=txkwmarzcyfbkizphjww
VITE_SUPABASE_URL=https://txkwmarzcyfbkizphjww.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<mesma chave publicável>
```

Este aplicativo não precisa de uma chave administrativa para esta publicação.
O `.env` local não é enviado ao GitHub nem à Vercel. Após mudar variáveis,
gere uma nova implantação.

## Supabase após obter o domínio definitivo

Em Authentication → URL Configuration, configure Site URL com o endereço HTTPS
do site e adicione os seguintes Redirect URLs, substituindo DOMINIO:

- `https://DOMINIO/auth-callback`
- `https://DOMINIO/app`
- `https://DOMINIO/reset-password`

Mantenha o callback `lobbyx://app/auth-callback` do Windows e os endereços locais
necessários para desenvolvimento. O callback do Google Cloud continua sendo
`https://txkwmarzcyfbkizphjww.supabase.co/auth/v1/callback`.

O banco já recebeu a estrutura inicial. Para as molduras, execute somente
`supabase/migrations/20261002010000_avatar_frames.sql`; não execute novamente
o bootstrap do banco vazio.

## Validação após publicar

Abra `/login` e `/app` diretamente, teste login com Google, cadastro com escolha
de usuário, mensagens, chamada entre duas contas e compartilhamento de tela.
Verifique que navegar para outro servidor ou configurações mantém a chamada.
