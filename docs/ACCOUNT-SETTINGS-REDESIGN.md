# Minha conta — redesign local

## Escopo

Somente o conteúdo de Minha conta foi alterado. `SettingsShell.tsx`, sua sidebar, cabeçalho, categorias, dimensões e links não foram editados. A aba Perfil também não foi modificada nesta entrega. Sem publicação, migrations, alteração do atualizador ou versão.

## Implementação

- Card de identificação com avatar somente informativo, nome, username, e-mail, verificação quando disponível e data de criação de `auth.user.created_at`.
- Editar perfil navega para a aba Perfil; não há input de arquivo nem botão de edição sobre imagens.
- Métodos identificados por `auth.user.identities`: e-mail e Google. Um endereço de e-mail sozinho não é tratado como prova de senha configurada. O cliente não recebe uma indicação confiável de senha; por isso a identidade é apresentada como E-mail, sem afirmar E-mail e senha ativo.
- Não há vinculação/desvinculação implementada na autenticação existente. A página informa essa limitação e não inicia OAuth como substituto de vinculação.
- Sessão com plataforma detectada pela bridge Desktop existente, estado real de rede do navegador e validade da credencial quando informada na sessão. Rede disponível não significa confirmação de conexão ao servidor. Sem localização/IP/dispositivo inventados.
- Sair reutiliza a mesma sequência anterior: authService.signOut, teardownPresence, limpeza do cache e navegação para login.
- Desativar e excluir são botões compactos desabilitados, sem callbacks destrutivos. Nenhum fluxo inseguro ou exclusão parcial foi criado.
- Painel direito com identidade LobbyX e arte já existente no projeto. Atalhos funcionais para Perfil e Privacidade. A arquitetura não possui aba Senha e segurança; sua ausência é identificada no painel sem criar rota fictícia ou alterar a sidebar.

## Arquivos

- `src/components/settings/AccountSettings.tsx`: integração com dados reais e logout existente.
- `src/components/settings/AccountSettingsView.tsx` e `account-settings.css`: conteúdo e aparência responsiva, estilos limitados à página.
- `src/lib/account-settings.ts`: métodos vinculados e formatação de data.
- `tests/account-settings.test.mjs`: identidades, datas, navegação, ausência de upload e bloqueio das ações destrutivas.
- `tests/account-settings-preview/preview.tsx`: fixture identificada que usa o componente real.
- `tests/community-unified-preview/preview.tsx` e `preview.css`: opção Minha conta na prévia local.

## Validação

- 321 testes Node aprovados, sem falhas ou testes ignorados.
- TypeScript e lint dos arquivos envolvidos aprovados.
- Builds WEB e Desktop locais aprovados; não houve distribuição de EXE.
- Interface conferida em 1448×1086 e 390×844. Sem overflow horizontal da página.
- Atalho Editar perfil testado no navegador, chegando ao formulário existente.
- Ausência de inputs de upload verificada no DOM e por teste do componente.
- Ações de desativar/excluir verificadas como desabilitadas e sem callback.

Logs: `vo/outputs/account-redesign-tests.txt`, `account-redesign-web-build.txt`, `account-redesign-desktop-build.txt`.
Capturas: `vo/outputs/account-redesign-desktop.png` e `account-redesign-mobile.png`.
Prévia: http://127.0.0.1:5213/ → Minha conta.

## Pendências

A prévia usa dados fictícios em memória e mostra só o conteúdo central. O aplicativo autenticado continua envolvido no SettingsShell original. Login real, estados de provedores de uma conta real e logout autenticado não foram executados: nenhuma sessão ou dado real foi alterado para testes. O EXE foi compilado, mas não instalado/testado interativamente nesta entrega.

Vinculação de provedores, Senha e segurança, desativação e exclusão precisam de implementação própria antes de serem apresentados como operacionais. Não fazem parte deste redesign e não foram improvisados.
