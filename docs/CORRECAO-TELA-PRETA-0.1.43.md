# LobbyX Desktop 0.1.43 — correção da tela preta

## Causa confirmada

A versão 0.1.42 calculava hashes CSP sobre os bytes originais de `_shell.html`. O script de hidratação gerado pelo TanStack contém um caractere nulo literal no identificador da rota raiz. O parser HTML do Chromium substitui esse caractere por U+FFFD antes da validação/execução. O hash original e o hash do texto efetivamente executado são diferentes.

No pacote instalado: CSP bloqueou o script de hidratação; o módulo principal lançou `Cannot set properties of undefined (setting 't')`; o corpo da página permaneceu vazio. O processo abria normalmente, mas a interface não inicializava. Foi uma regressão da CSP introduzida na 0.1.42; a checagem apenas de empacotamento não detectou o problema.

## Correção

`desktop/security.cjs` normaliza CR/CRLF para LF e substitui nulos por U+FFFD antes de gerar SHA-256, seguindo a normalização do parser HTML. A CSP continua exigindo hashes para scripts inline; não foi liberado `unsafe-inline` para JavaScript. Nenhuma sessão, cache, conta ou configuração do usuário é removida.

Versão Desktop incrementada para 0.1.43. Nenhuma migration ou configuração do Supabase foi alterada neste hotfix. Progression V1 continua arquivado; Realtime privado continua desativado nesta transição compatível.

## Validação

- Erro reproduzido carregando o main/HTML/JavaScript do ASAR instalado em perfil isolado.
- Com a correção, o mesmo HTML renderiza a tela de login; não ocorre mais bloqueio CSP nem falha de hidratação.
- Repetido com `win-unpacked/resources/app.asar` da 0.1.43: main e assets empacotados renderizam login normalmente. O harness usa Electron 44.4.5, janela oculta e perfil de diagnóstico separado; não autentica uma conta real e não executa o updater em modo empacotado.
- Captura local: `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/desktop-042-diagnostic.png`.
- 163 testes passaram, incluindo regressão com caractere nulo e quebras de linha no script; typecheck e lint dos arquivos alterados passaram.
- Instalador, versão no ASAR, updater empacotado, feed, tamanho/checksum SHA-512 e blockmap validados; scanner de fonte/assets sem secrets identificados.

## Recuperação de uma instalação com tela preta

Fechar o LobbyX e instalar a versão 0.1.43 sobre a instalação existente. A interface da versão afetada pode não permitir usar o botão do updater; nesse caso usar o instalador diretamente. Não apagar os dados em AppData.

Release: https://github.com/goappcall-star/spaceopx/releases/tag/v0.1.43.
Instalador: https://github.com/goappcall-star/spaceopx/releases/download/v0.1.43/LobbyX-Setup-0.1.43-x64.exe.
