# Nova hotbar fixa de chamadas — entrega local

22/10/2026 · `codex/communities-v1`. Referência: `Mockup da Barra de Chamada LobbyX.png` e especificação anexada pelo usuário.

## Arquitetura e escopo

Antes da alteração, os controles estavam distribuídos em `UserBar`, `ConnectedVoiceBar`/`VoiceBar`, `VoiceControlBar` dentro de `AutoHideVoiceControls` e no footer de `CallOverlay`. A navegação fora de `/app` também montava um painel de voz flutuante.

Agora existe **uma única instância de `SessionCallDock`** no layout da sessão autenticada, abaixo da área de rotas. A barra é ancorada na base da janela por flex/grid, com altura real reservada; a região de conteúdo possui rolagem independente. Isso permite permanecer visível sem sobrepor mensagens ou campos de texto. A altura da titlebar Desktop continua descontada.

- `CallDockView.tsx`/`call-dock.css`: apresentação e layout responsivo.
- `SessionCallDock.tsx`: adaptação dos contextos existentes, queries existentes e callbacks existentes. Não cria outro provider, captura ou conexão WebRTC.
- `SessionCommunications.tsx`: monta o rodapé único e o provider de perfil compartilhado, preservando o ciclo de vida dos providers de comunicação.
- `app.tsx`: remove a instância local de perfil e consome o retorno de conversa para abrir mensagens a partir da barra global. A navegação e as sidebars existentes são preservadas.
- `AppNavigationLayout.tsx`: footer opcional, não utilizado pela aplicação principal; compatibilidade das prévias anteriores preservada.

## Comportamento

- Fora de chamada: avatar/moldura, nome, username, presença, microfone, seletor de entrada, fone, seletor de saída e engrenagem geral permanecem no `UserBar`. Controles de chamada não são montados.
- Durante chamada: `UserBar` oculta somente seus controles de microfone/fone. A engrenagem geral permanece no perfil. Os controles de áudio e seletores são montados uma única vez na seção de chamada.
- Nome da sala, servidor, estado, pessoas e contagem vêm da conexão ativa e das consultas existentes. Navegar para outro servidor não troca o contexto mostrado pelo dock.
- Avatares e lista de participantes usam membros/perfis reais disponíveis. Perfis ainda indisponíveis usam o fallback existente; não são inventadas contagens ou atividades. Em chamadas privadas, pessoas ainda não conectadas não entram na contagem; grupos usam a presença já fornecida pelo contexto.
- Botão central retorna à chamada correta. O menu de participantes lista as pessoas. Se o usuário mantém voz e chamada privada simultâneas, um seletor identifica as duas sessões existentes e permite escolher qual controlar; não abre nem encerra outra sessão implicitamente.
- Câmera, transmissão, microfone e desconexão usam os callbacks atuais. Durante reconexão, a barra permanece visível; novas capturas ficam desabilitadas, mas parada de transmissão e desconexão continuam disponíveis.
- Quem transmite vê **Transmitindo** e **Parar transmissão**, separados de encerrar chamada. Quem assiste vê **Assistindo**, monitor destacado em roxo e **Sair da transmissão**; depois pode voltar à visualização. Os estados de visualização introduzidos na entrega anterior continuam sendo reutilizados.
- Menus rápidos e supressão de ruído são os componentes existentes. Configurações exclusivas ficam no menu contextual de sliders, sem uma segunda engrenagem geral.
- Não existe transporte de reações de chamada na arquitetura atual; nenhum botão fictício de reações foi adicionado.
- O fone compartilhado passa a ser respeitado também pelo player já existente de chamadas privadas. O controle usa o estado/callback existente; não foi modificado o provider de mídia. Ao silenciar o fone pela barra de uma chamada privada, o callback de mute dessa chamada também é utilizado, conforme o comportamento de deafen existente na voz.
- O atalho de download WEB foi preservado no menu da conta quando `UserBar` está integrado ao dock, evitando uma linha extra acima da barra.
- Troca de conta mantém o teardown existente e o `key` por usuário em `SessionCommunications`.

## Interfaces antigas substituídas

| Interface anterior | Resultado |
| --- | --- |
| `ConnectedVoiceBar` dentro de `UserBar` | Montagem removida. |
| `ConnectedVoiceBar floating` fora de `/app` | Montagem removida. |
| `VoiceControlBar` flutuante/oculta em `VoiceRoom` | Montagem removida; a área de mídia permanece. |
| `AutoHideVoiceControls` em `VoiceRoom` | Substituído por contêiner simples da área de mídia. |
| Controles ativos do footer de `CallOverlay` | Removidos; o painel de mídia e o fechamento de chamada já encerrada permanecem. |
| Perfil dentro do rodapé da sidebar de `/app` | Movido para o dock da sessão. |

Os arquivos legados de barras foram preservados, mas não são mais importados/montados pelos pontos de entrada da interface de chamada. A aplicação principal tem uma só barra de perfil/chamada; prévias históricas isoladas não são pontos de montagem da aplicação. Não há controles duplicados na tela normal da chamada. Os formulários de configuração de áudio e o painel de ajuste de transmissão continuam disponíveis como configurações, não como uma segunda hotbar.

## Validação automatizada

- **346 testes Node aprovados, zero falhas/ignorados**: `outputs/fixed-call-dock-tests-final.txt`.
- TypeScript aprovado: `fixed-call-dock-typecheck-final.txt`. A primeira checagem identificou estados `idle/incoming/ended` ausentes no mapa de rótulos; o mapa foi completado antes da checagem final.
- ESLint dos arquivos alterados: zero erros, dois avisos Fast Refresh (exportação compartilhada existente em `SessionCommunications` e entrada de componente da prévia): `fixed-call-dock-lint-final.txt`.
- Build WEB local aprovado: `fixed-call-dock-web-build-delivery.txt`.
- Build Desktop local aprovado: `fixed-call-dock-desktop-build.txt`.
- `git diff --check` aprovado; avisos de normalização LF/CRLF não são falhas.
- Novos testes exercitam estado inativo/entrada recebida, origem real da sala ao navegar, callbacks de mute/câmera/parada/desconexão, saída e retorno da visualização, reconexão, fallback entre sessões, participantes privados/grupos e fone no player privado. As regressões de voz/mídia anteriores também passaram.

## Prévia e capturas

Prévia: http://127.0.0.1:5222/ — ou **Hotbar fixa** na prévia unificada http://127.0.0.1:5213/.

Usa os componentes reais do dock, perfil, seletores e menus, com adaptadores e dados fictícios identificados. Não conecta ao Supabase nem inicia WebRTC ou captura de mídia. Há cenários de inatividade, chamada, transmissão, visualização, reconexão, privado, grupo, duas sessões e troca de conta. A navegação simulada mantém o componente montado.

Capturas reais do navegador em `outputs/` no diretório `vo`:

- `fixed-call-dock-idle.png` — fora de chamada.
- `fixed-call-dock-active.png` — em chamada, navegando em outra área.
- `fixed-call-dock-sharing.png` — transmissor.
- `fixed-call-dock-watching.png` — espectador.
- `fixed-call-dock-mobile.png` — 390 × 844.
- `fixed-call-dock-notebook.png` — 1366 × 768.

Conferência no DOM:

| Viewport | Resultado |
| --- | --- |
| 1440 × 900 | Dock de 86 px, topo em y=814; campo de mensagem termina em y=798. Uma engrenagem geral, um seletor de microfone e zero seletores de microfone no perfil durante a chamada. Sem overflow horizontal. |
| 1366 × 768, transmitindo | Dock de 86 px; botão de parada separado; nome da sala e participantes acessíveis. Sem overflow horizontal. |
| 1280 × 720, transmitindo | Dock reorganizado em duas linhas, 133,89 px de altura. Campo de mensagem termina em y=570,11, antes do topo y=586,11 do dock. Sem overflow horizontal. |
| 390 × 844, assistindo | Dock de 182,5 px, topo em y=661,5; campo de mensagem termina em y=645,5. Perfil, controles e ações visíveis, sem overflow horizontal. |

Também conferidos na prévia: seleção de microfone fictício refletida no menu, abertura do menu do fone, participantes, reconexão, navegação para mensagens/outro servidor, parar/sair sem desconectar, troca de conta simulada, seleção entre duas sessões e retorno ao perfil após desconectar.

## Pendências reais e checklist antes de publicação

As verificações de navegador acima são de UI com fixtures; testes automatizados usam cenários determinísticos. **Não equivalem a autenticação real, hardware ou um E2E WebRTC**.

Conferir em duas contas e WEB/EXE: entrar em canal, trocar de servidor/canal/mensagens/configurações com voz ativa; mute/deafen e dispositivos físicos; iniciar/parar captura pelo app e pelo sistema; assistir/sair/voltar com áudio compartilhado; encerrar chamada; queda real de rede e reconexão; logout/troca de conta; perfil e popovers em resoluções menores e titlebar Desktop. Confirmar também o retorno à conversa privada e o caso simultâneo voz/privado. A emissão dos sons da entrega anterior precisa de audição física entre clientes atualizados.

Nenhuma migration, backend remoto, provider WebRTC, lógica de permissão, versão estável, atualizador, publicação WEB/EXE ou push foi alterado nesta tarefa. Build Desktop não é instalação ou distribuição de um novo EXE. Aguardar avaliação do usuário antes de publicar.
