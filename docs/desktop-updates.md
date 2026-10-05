# Atualizações automáticas do LobbyX Desktop

O Electron carrega o frontend local por `lobbyx://app`, com preload isolado, e é empacotado com electron-builder/NSIS. O atualizador roda no processo principal, depois que a janela abre, usando electron-updater 6.8.10 e GitHub Releases público. A versão é definida somente em `desktop/package.json`; o build não a sobrescreve mais.

## Comportamento

- Verificação automática na abertura da versão Windows instalada. Desenvolvimento e WEB não fazem downloads.
- Download em segundo plano, porcentagem e cartão “Atualização pronta”.
- Somente o botão “Reiniciar e atualizar” inicia a instalação silenciosa e reabre o LobbyX.
- `autoInstallOnAppQuit=false`: sair do app, terminar chamada ou desligar o Windows não instala automaticamente.
- Os providers de voz e chamadas privadas reportam atividade separadamente. Chamada conectando, ativa, reconectando, aguardando ou compartilhamento bloqueia o reinício. Chamadas privadas tocando também bloqueiam por precaução.
- O processo principal verifica atividade; heartbeat ausente por mais de 10 segundos e navegação deixam instalação bloqueada. A interface trava novos inícios de chamada enquanto envia o pedido de instalação.
- IPC é restrito ao frame principal de `lobbyx://app`. Não recebe URLs, comandos, caminhos ou tokens da interface.
- Falhas são mostradas com opção de tentar novamente, sem bloquear login/abertura. Mensagens de erro não expõem respostas internas, caminhos ou credenciais.

## Build e publicação

1. Incremente `desktop/package.json.version` (e.g. 0.1.25). Não altere a versão de uma release já publicada.
2. Configure as variáveis públicas de Supabase do build como antes. Nenhuma chave privilegiada é necessária.
3. Execute `npm run desktop:dist` no Windows. Ele gera e verifica EXE versionado, `.exe.blockmap`, `latest.yml`, feed GitHub e presença do atualizador no ASAR.
4. Execute `node scripts/test-desktop-update.mjs` para exercitar o atualizador real contra HTTP local, incluindo download completo, progresso e rejeição de checksum inválido. Esse teste não instala nada nem acessa produção.
5. Faça commit/push do código e execute `npm run desktop:release` com GitHub CLI autenticado. O script envia todos os arquivos para um draft e só então publica como latest. Inclui `LobbyX-Setup-x64.exe` para preservar o botão de download WEB.

Opcionalmente o workflow `.github/workflows/desktop-release.yml` faz build/publicação no Windows ao receber tag `v<versão>` ou execução manual. Configure Repository Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Ele usa o `GITHUB_TOKEN` temporário apenas na etapa de publicação. O token nunca é incluído no aplicativo. Não combine publicação local e workflow para a mesma versão.

Distribuição/atualização não requer serviço pago nem token no cliente: usa releases públicas existentes. A assinatura de código continua como no empacotamento atual (instalador sem assinatura); hashes SHA-512 verificam integridade dos arquivos. O fluxo de atualização não desativa a validação de assinatura do electron-updater.

## Primeira instalação e limites da validação

A versão 0.1.23 e anteriores não têm updater e não podem instalar esse recurso sozinhas. Usuários precisam instalar manualmente a primeira versão com updater (0.1.24); daí em diante podem receber releases posteriores.

Testes automatizados validam controlador, bloqueio, erros, progresso e limpeza. O teste de download usa a biblioteca real e um instalador NSIS real, servido localmente. A validação final de substituição/reabertura pelo NSIS exige uma instalação descartável/VM Windows: instalar 0.1.24, disponibilizar uma versão superior com os quatro assets, abrir, conferir progresso, confirmar que o botão está bloqueado em chamada, sair da chamada e clicar no botão. Verificar novo app/version, login preservado e chamada nova funcional. Esse teste não deve sobrescrever uma instalação pessoal apenas para verificar o código.
