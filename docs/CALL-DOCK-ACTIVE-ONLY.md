# Hotbar somente durante a chamada

## Comportamento

`SessionCallDock` retorna `null` quando não há sessão de voz ou chamada privada em andamento. Não resta footer, borda, margem, altura ou placeholder da hotbar.

Voz usa `connectionState` (`connecting`, `connected`, `reconnecting`), não o canal selecionado nem somente `activeChannelId`. Chamadas privadas/grupos mantêm os estados existentes `outgoing`, `connecting`, `active`, `waiting` e `reconnecting`. Toque de chamada recebida continua no diálogo existente, sem dock ativo.

`IdleSessionProfile` mostra o `UserBar` normal no rodapé da navegação do aplicativo quando o dock está ausente. Ele consome os contextos existentes, sem criar controlador ou provedor de mídia adicional. Em Configurações, mantém-se a identificação de perfil existente da sidebar; não é reservado rodapé global fora de chamada.

Os provedores de voz, chamadas, reprodução remota, notificações e transmissão continuam montados em `SessionCommunications`. Nenhuma mudança de WebRTC, estilos/proporções do dock ativo, menus de dispositivos ou ações de transmissão foi feita nesta alteração.

## Arquivos

- `src/lib/call-dock.ts`: classificação da sessão de voz.
- `src/components/call/SessionCallDock.tsx`: visibilidade condicional e perfil normal.
- `src/routes/_authenticated/app.tsx`: perfil normal no layout existente de navegação.
- `tests/fixed-call-dock.test.mjs`: estados, fim da sessão, canal residual e restauração do perfil.
- `tests/fixed-call-dock-preview/{fixtures,preview}.tsx`: cenário Conectando e perfil normal na prévia.

## Validação

354 testes Node aprovados, sem falhas ou ignorados. TypeScript aprovado; lint dos arquivos alterados sem erros (um aviso de Fast Refresh no ponto de entrada da prévia).

Prévia com componentes reais e estados fictícios em `http://127.0.0.1:5222/`, viewport 1280 × 720:

| Cenário | Docks | Perfis | Altura da área de conteúdo | Altura do dock |
| --- | ---: | ---: | ---: | ---: |
| Fora de chamada | 0 | 1 | 720 | 0 |
| Conectando | 1 | 1 | 654 | 62 |
| Conectado | 1 | 1 | 654 | 62 |
| Reconectando | 1 | 1 | 654 | 62 |
| Transmitindo | 1 | 1 | 654 | 62 |
| Assistindo | 1 | 1 | 654 | 62 |
| Após desconectar pela ação real do componente | 0 | 1 | 720 | 0 |

O campo de mensagens ficou acima do dock em todos os estados ativos verificados. Após desconectar, nenhum footer vazio permaneceu e os 66 px de espaço total do dock (altura e margens) foram recuperados.

Esses testes visuais usam contextos simulados, sem mídia ou autenticação reais. A lógica de mídia não foi modificada.

Evidências na pasta `outputs` principal do trabalho: `hotbar-active-only-idle.png`, `hotbar-active-only-watching.png`, `hotbar-active-only-disconnected.png`, `active-call-dock-tests.txt`, `active-call-dock-types.txt`, `active-call-dock-lint.txt`, `active-call-dock-web-build.txt` e `active-call-dock-desktop-build.txt`.

Sem publicação WEB/EXE ou mudança de versão.
