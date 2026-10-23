# Hotbar 0.1.62 com tamanho do perfil corrigido

Decisão final: manter **Perfil | Informações da chamada | Controles**, usando a hotbar publicada na 0.1.62 como base. Somente o tamanho reservado ao perfil foi corrigido. As propostas intermediárias de inversão e redistribuição proporcional não fazem parte deste resultado.

`CallDockView.tsx` está idêntico à cópia de release 0.1.62. No código, a diferença fica em `call-dock.css`: coluna de perfil de 332 px dentro e fora da chamada, incluindo larguras intermediárias, e adaptação responsiva para preservar o perfil sem comprimir as informações. A disposição em linhas existente começa mais cedo para acomodar a coluna maior. Em telas pequenas o perfil ocupa a largura disponível em ambos os estados.

O restante do estilo, informações, botões, menus, callbacks e lógica da 0.1.62 permanece preservado. Nenhuma publicação, migration, mudança de versão ou atualização automática foi executada.

## Conferência

Em 1280×720, fora de chamada e nos estados conectado, transmitindo, assistindo e reconectando:

- Perfil: 332 × 55,06 px, avatar de 32 px em todos os casos.
- Hotbar: 62 px de altura em todos os casos.
- Ordem original preservada e sem rolagem horizontal.

Na largura de 1100 px, o estado de transmissão e o botão de participantes ficam separados, com informações e controles nas linhas responsivas existentes, preservando os 332 px do perfil.

10 testes relevantes aprovados, TypeScript e ESLint aprovados. Builds WEB/Desktop locais registrados em `outputs/hotbar-profile-size-web-build.txt` e `outputs/hotbar-profile-size-desktop-build.txt`, relativos à pasta vo. Logs dos demais checks usam o mesmo prefixo.

Prévia: http://127.0.0.1:5222/. Captura: `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/hotbar-062-profile-corrected.png`.

A prévia usa componentes reais e fixtures identificadas. Não equivale a uma chamada WebRTC real ou teste de hardware/EXE instalado.
