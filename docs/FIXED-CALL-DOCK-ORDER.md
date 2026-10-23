# Ordem da hotbar e tamanho constante do perfil

> Proposta substituída pela decisão final em `FIXED-CALL-DOCK-PROFILE-SIZE.md`: manter a ordem e a hotbar da 0.1.62, alterando somente o tamanho do perfil.

Alteração local, sem publicação ou mudança da versão estável 0.1.62.

## Resultado

Ordem: **Perfil | Controles da chamada | Informações da chamada**. A ordem no DOM também foi atualizada para manter a navegação por teclado coerente com a apresentação visual.

O perfil usa a mesma coluna de 332 px dentro e fora da chamada em Desktop, sem aplicar os percentuais da referência. Avatar, nome, username, presença e engrenagem preservados. Microfone e fone continuam na área de controles durante chamadas, sem duplicação.

As informações à direita agrupam nome da sala e servidor em duas linhas, estado ao lado e participantes. Todos os callbacks, menus de dispositivos e lógica de chamadas permanecem como estavam.

Arquivos alterados: `src/components/call/CallDockView.tsx` e `src/components/call/call-dock.css`.

## Validação local

Em 1280×720 foram medidos, fora da chamada e nos estados conectado, transmitindo, assistindo e reconectando:

- Perfil: 332 px de largura e 55,06 px de altura em todos os casos.
- Avatar: 32 px em todos os casos.
- Hotbar: 62 px em todos os casos.
- Sem rolagem horizontal.

Em 1024 px, o perfil continua com 332 px e controles/informações usam duas linhas à direita; hotbar de 95 px. Em 390 px, a disposição passa a perfil, controles e informações em linhas sucessivas, preservando a largura total do perfil como no estado inativo. Sem overflow horizontal; o campo de mensagem permanece acima da hotbar.

- 10 testes relevantes aprovados, zero falhas/ignorados.
- TypeScript aprovado.
- ESLint do componente alterado e Prettier do CSS aprovados.
- Builds WEB e Desktop locais aprovados, executados sequencialmente.
- `git diff --check` aprovado.

Logs: `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/hotbar-order-{tests,typecheck,lint,format,web-build,desktop-build}.txt`.

## Capturas

Em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/`:

- `hotbar-order-before.png`: ordem e perfil anteriores, em chamada.
- `hotbar-order-after.png`: nova ordem, em chamada.
- `hotbar-order-idle.png`: perfil fora de chamada para comparação.
- `hotbar-order-sharing.png`: transmitindo com perfil preservado.
- `hotbar-order-small.png`: janela pequena.

Prévia: http://127.0.0.1:5222/. Usa componentes reais com fixtures identificadas; as verificações visuais não são chamadas WebRTC reais nem testes de hardware ou do EXE instalado.
