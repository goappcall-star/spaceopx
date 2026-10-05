# Login Google no LobbyX WEB e Windows

O aplicativo usa Supabase OAuth com PKCE. O frontend contém apenas a chave pública; o Client Secret fica no provedor Google do Supabase.

## Projeto de produção

Supabase São Paulo: lnupoqtaeawwggbwgbuv.

- Google Cloud: autorizar https://lnupoqtaeawwggbwgbuv.supabase.co/auth/v1/callback no cliente OAuth Web configurado no provedor.
- Supabase Site URL: https://lobbyx-nine.vercel.app.
- Supabase Redirect URLs: https://lobbyx-nine.vercel.app/auth-callback, lobbyx://app/auth-callback e os retornos locais usados nos testes.
- Teste local da migração: http://127.0.0.1:5180/auth-callback.

O instalador 0.1.20 usa o novo projeto. Versões anteriores continuam usando o projeto antigo e precisam ser atualizadas. O protocolo lobbyx:// registrado pelo instalador permite retornar do navegador ao aplicativo.

## Banco e validação

A restauração preservou as funções google_registration_ready e complete_registration e o gatilho de cadastro. Após restaurações, atualizar o cache PostgREST com NOTIFY pgrst, 'reload schema'.

Contas existentes mantêm seus IDs. Novas contas Google precisam escolher um username; não criar username a partir do Gmail. Conferir login, retorno ao app, perfil, servidores, chamadas e recuperação de senha antes de remover o projeto antigo.

Referências:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
