# Ativar o cadastro com Google no LobbyX

O instalador 0.1.3 inclui o botão Google, o retorno ao Windows e a escolha obrigatória de usuário. A ativação no backend ainda não foi feita.

## Configuração no backend atual

Projeto: rbybiqothnqrsuqdxqhv.supabase.co (o mesmo utilizado pelo Lovable).

1. Peça ao Lovable para aplicar o arquivo `ativar-cadastro-google.sql` nesse banco. O arquivo é uma migração transacional e não altera os perfis existentes. Para novas contas Google, o registro de autenticação existe primeiro, mas o perfil público só é criado quando a pessoa escolhe um usuário. O nome e o endereço do Gmail não são utilizados como username.
2. Configure o provedor Google compatível com `supabase.auth.signInWithOAuth`, usando o fluxo PKCE. Se o Google gerenciado do Lovable exigir outro SDK, esse fluxo precisa de configuração com credenciais próprias no provedor Supabase; não substitua silenciosamente a integração do aplicativo.
3. No provedor Google, o callback do backend Supabase é `https://rbybiqothnqrsuqdxqhv.supabase.co/auth/v1/callback`. Confirme o endereço exibido pelo painel antes de cadastrar o cliente OAuth do tipo Web no Google Cloud. Guarde o Client secret exclusivamente no backend.
4. Na lista de retornos permitidos do Supabase Auth, inclua exatamente `lobbyx://app/auth-callback` para Windows e `http://127.0.0.1:5173/auth-callback` para desenvolvimento. Para a versão web publicada, adicione seu domínio real seguido de `/auth-callback`.
5. Instale o LobbyX 0.1.3. O instalador registra o protocolo `lobbyx://` no Windows. O login abre no navegador padrão e retorna ao aplicativo; não requer localhost no computador do usuário.

Não habilite o provedor antes de aplicar a migração: o gatilho anterior cria usernames a partir do e-mail. O novo botão verifica se a migração existe antes de iniciar o login.

## Texto para enviar ao Lovable junto com o SQL

Configure o login Google do backend atual do LobbyX para a integração Supabase OAuth PKCE já implementada no aplicativo Electron. Aplique o SQL anexado, sem recriar o banco nem modificar perfis existentes. Não gere username a partir do Gmail: novas autenticações Google ficam sem registro em public.profiles até a chamada autenticada complete_registration(chosen_username). Preserve a unicidade e a imutabilidade do username. Configure o provedor Google e permita o retorno lobbyx://app/auth-callback, além dos callbacks web e de desenvolvimento usados pelo projeto. Informe se o Google gerenciado do Lovable não é compatível com o fluxo direto supabase.auth.signInWithOAuth antes de trocar SDK ou callbacks. Não envie segredos ao frontend.

## Validação após ativar

- Nova conta Google: campo de usuário vazio, sem acesso ao app antes de concluir.
- Nome inválido ou já ocupado: permanecer na tela com mensagem; não adicionar sufixos automaticamente.
- Fechar antes de escolher e entrar novamente: retomar escolha obrigatória.
- Conta com perfil existente: manter o usuário atual.
- Cancelar autorização Google: permitir tentar de novo.
- Windows: confirmar retorno do navegador para o app aberto e também após fechar e reabrir.
- Confirmar login tradicional e recuperação de senha. Os links PKCE devem ser abertos no mesmo navegador/dispositivo que iniciou o fluxo; o cadastro por senha no desktop ainda depende de URLs de e-mail válidas.

Verificações locais executadas: compilação, TypeScript e testes automatizados do retorno desktop, dos redirecionamentos, do bloqueio em backend sem migração e do tratamento de username duplicado. A migração não foi executada no banco real, e o OAuth real não foi testado porque as configurações administrativas não estão disponíveis nesta sessão.

Referências:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://docs.lovable.dev/features/google-auth
