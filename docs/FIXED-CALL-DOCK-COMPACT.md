# Hotbar fixa compacta

Alteração local, sem publicação, mudança de versão, migrations ou atualização automática. A versão estável 0.1.61 foi preservada.

## Implementação

Somente `src/components/call/call-dock.css` foi alterado no código. Perfil mais enxuto, avatar de 32 px, controles de 36 px de altura, participantes com avatares de 26 px quando há espaço e informações da chamada organizadas horizontalmente. Acabamento, cores de estado, menus rápidos, tooltips e todos os comandos existentes foram preservados.

Em larguras intermediárias, os avatares secundários cedem lugar à contagem e ao botão que abre a lista completa. Em janelas menores, os controles se distribuem em linhas. Nome da sala, servidor e estado continuam disponíveis; textos longos usam a truncagem e os títulos já existentes.

Foi conferido que CallDockView, SessionCallDock, ScreenViewingProvider, UserBar, use-voice, use-call e AudioOutputControl permanecem idênticos, normalizando LF/CRLF, aos arquivos da release 0.1.61. Não houve alteração de lógica, callbacks, captura, WebRTC, dispositivos, sidebar ou estrutura geral da tela.

## Medições na prévia real com fixtures

| Cenário | Resultado |
| --- | --- |
| Transmitindo, 1280×720, antes | 164,23 px de altura |
| Transmitindo, 1280×720, depois | 62 px de altura |
| Em chamada / assistindo / reconectando, 1280×720 | 62 px em cada estado |
| Em chamada, 1672×941 | 62 px; avatares de participantes de 26 px |
| Assistindo, 1024×768 | 95 px, controles em linhas |
| Assistindo, 390×844 | 147,67 px, controles em linhas |

Sem rolagem horizontal nas larguras conferidas. Em 1280 px, o campo de mensagem terminou em y=638 e a hotbar começou em y=654. Em 390 px, terminou em y=676,33 e a hotbar começou em y=692,33. Comandos de microfone, entrada, fone, saída, câmera, compartilhamento, opções da chamada, supressão, transmissão e desconexão presentes. O menu de microfone foi aberto e fechado pela interface compacta.

## Verificações

- 10 testes relevantes aprovados, zero falhas ou ignorados: fixed-call-dock, private-call-output e screen-viewing.
- TypeScript aprovado.
- ESLint dos componentes da hotbar e UserBar: zero erros/avisos.
- Prettier do CSS aprovado.
- Builds WEB e Desktop locais aprovados, executados sequencialmente com o wrapper de compilação local.

Logs: `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/hotbar-compact-{tests,typecheck,lint,format,web-build,desktop-build}.txt`.

## Capturas e prévia

Prévia atualizada: http://127.0.0.1:5222/.

Capturas em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/`:

- `hotbar-compact-before.png` e `hotbar-compact-after.png`: mesmo cenário transmitindo, em 1280×720.
- `hotbar-compact-active.png`: em chamada.
- `hotbar-compact-sharing.png`: transmitindo.
- `hotbar-compact-watching.png`: assistindo.
- `hotbar-compact-reconnecting.png`: reconectando.
- `hotbar-compact-small.png`: janela reduzida.

Os cenários visuais usam os componentes reais com fixtures identificadas e sem WebRTC. Não equivalem a teste de chamadas reais, dispositivos físicos ou EXE instalado. O build Desktop comprova compilação; não foi distribuído um novo instalador.
