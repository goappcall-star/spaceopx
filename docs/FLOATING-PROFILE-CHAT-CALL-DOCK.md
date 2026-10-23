# Perfil, compositor e hotbar com superfícies independentes

Implementação local do conceito aprovado, usando os tokens de cor existentes do LobbyX: `surface` na coluna de navegação, `background` no chat e `surface-elevated` nos blocos. Temas e cor de destaque continuam sendo respeitados.

## Mudanças

- Perfil normal em card arredondado sem linha superior, no rodapé existente da navegação.
- Divisória e sombra da coluna de canais removidas dentro do layout de navegação; a separação é feita pelos fundos.
- Compositores de canal e mensagens privadas sem faixa de fundo própria ou linha superior. O campo tem superfície independente e contorno somente durante foco.
- Hotbar durante chamadas sem borda externa ou divisórias entre perfil, informações, participantes e controles. A ordem continua Perfil | Informações | Controles.
- Informações da chamada em card com sala/servidor em duas linhas; controles com mais espaço horizontal e desligar em vermelho preenchido.
- Fundo da hotbar continua os fundos da navegação/chat. O corte acompanha a largura existente da navegação; janelas estreitas mantêm a quebra de linhas necessária para não ocultar controles.
- Fora de chamada continua sem hotbar ou espaço reservado. Provedores, callbacks, dispositivos e transmissão permanecem intactos.

## Arquivos

- `src/components/app/app-navigation-layout.css`
- `src/components/call/call-dock.css`
- `src/components/chat/MessageComposer.tsx`
- `src/components/chat/message-composer.css`
- `src/components/social/DmComposer.tsx`
- `tests/fixed-call-dock-preview/{fixtures.tsx,preview.tsx,vite.config.mjs}`

## Validação

- 354 testes Node aprovados, sem falhas ou ignorados.
- TypeScript aprovado; lint dos TSX/configurações alterados sem erros, com um aviso de Fast Refresh na prévia.
- Prévia usa o compositor e a hotbar reais com serviços simulados. Envio de texto fictício, foco, menu do microfone, estado fora de chamada, conexão, reconexão e transmissão conferidos.
- Conferência em 1600, 1280, 900 e 640 px: nenhum transbordamento horizontal, campo de mensagem acima da hotbar em chamada normal, transmitindo e assistindo. Em larguras menores os controles quebram de linha para continuarem acessíveis.
- A prévia não valida áudio físico, autenticação ou upload real; uploads estão explicitamente desativados nos adaptadores locais.

Prévia: `http://127.0.0.1:5222/`.

Evidências e logs na pasta `outputs` principal: `floating-footer-idle.png`, `floating-footer-in-call.png`, `floating-footer-small.png`, `floating-footer-tests.txt`, `floating-footer-lint.txt`, `floating-footer-web-build.txt`, `floating-footer-desktop-build.txt`.

Nenhuma publicação, migration ou alteração de versão.
