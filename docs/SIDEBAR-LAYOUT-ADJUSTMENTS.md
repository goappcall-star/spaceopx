# Ajustes locais da barra lateral e perfil

Data: 22/10/2026. Branch: `codex/communities-v1`.

## Implementação

- Restaurado o botão `+` tracejado de 48 × 48 px, conforme o histórico anterior ao redesign. O callback, o modal e os fluxos atuais de criar/entrar permanecem intactos.
- Divisória de 32 × 1 px, usando a cor existente de borda, inserida após os servidores e antes do botão. A divisória e o botão participam da mesma lista rolável. Sem servidores, não há divisória redundante.
- O componente Social existente continua no rodapé da coluna de servidores, agora acima do rodapé compartilhado de perfil. Ícone, classes, dimensões, badge e callbacks preservados.
- `AppNavigationLayout` reúne a coluna de servidores e a coluna de canais/Social, com uma única instância de `UserBar` abaixo delas. Removidas apenas as instâncias anteriores nas colunas.
- Barra de perfil ampliada horizontalmente, com pequeno ajuste de padding. Avatar, molduras, presença, nomes, controles e menus atuais são reutilizados. Nomes longos mantêm truncamento e ganham título com o valor completo.
- Lista com altura flexível e rolagem independente; itens não encolhem quando a lista cresce.

## Arquivos desta entrega

- `src/components/app/AppNavigationLayout.tsx` e `app-navigation-layout.css` (novos).
- `src/components/app/ServerAccessButton.tsx`, `ServerRail.tsx`, `UserBar.tsx`, `ChannelSidebar.tsx`.
- `src/components/social/SocialSidebar.tsx`.
- `src/routes/_authenticated/app.tsx`.
- `tests/sidebar-layout-preview/*` (prévia isolada nova).
- `tests/community-unified-preview/preview.tsx` (atalho para a prévia).

As demais alterações locais de tarefas anteriores foram preservadas.

## Validação visual real no navegador

Prévia: http://127.0.0.1:5220/ — componentes reais de barra lateral, perfil e menus rápidos, com serviços e dispositivos fictícios identificados. Não há login, chamadas ou captura de mídia nessa prévia.

Comparação no mesmo viewport de 1440 × 900:

| Elemento | Antes | Depois |
| --- | --- | --- |
| Largura do perfil | 255 px | 332 px |
| Altura do perfil | 65,5 px | 69,5 px |
| Topo do Social | 835 px | 732,5 px |
| Social | 48 × 48 px | 48 × 48 px |

Classes do Social e classes/dimensões dos botões de áudio foram comparadas no DOM e permanecem iguais. Botões principais de áudio: 28 × 36 px; setas: 14 × 36 px.

| Cenário | Resultado |
| --- | --- |
| 3 servidores | Divisória e `+` após o último servidor; perfil e Social visíveis. |
| 30 servidores | Área rolável de 512 px para 1741 px de conteúdo; Social e perfil não se movem. |
| Final da lista | Último servidor termina em y=631; divisória em y=639; `+` começa em y=648. Callback do botão acionado. |
| Sem servidores | `+` acessível; nenhuma divisória redundante. |
| Janela 390 × 640 | Rodapé com 388 px úteis, dentro da janela; sem sobreposição entre Social e perfil. |
| 30 servidores na janela pequena | Lista de 252 px, conteúdo de 1741 px e rolagem até 1489 px; controles inferiores preservados. |
| Menu do microfone | Seleção do dispositivo fictício atualiza o menu; popover e submenu visíveis. |
| Menu do fone | Abre pelo controle existente na barra ampliada. |
| Menu em janela pequena | Popover do microfone entre x=120 e x=390, y=305 e y=575, dentro do viewport. |

Capturas em `../../outputs/` a partir da raiz deste repositório:

- `sidebar-layout-before.png`, `sidebar-layout-after.png`.
- `sidebar-profile-expanded.png`.
- `sidebar-layout-many.png`, `sidebar-layout-many-scrolled.png`.
- `sidebar-layout-small.png`, `sidebar-layout-small-scrolled.png`.
- `sidebar-layout-empty.png`, `sidebar-layout-audio-menu.png`.

## Verificações técnicas

- `npm test`: **329 aprovados, 0 falhas, 0 ignorados**.
- `npm run typecheck`: aprovado.
- ESLint dos arquivos alterados e da prévia: 0 erros; 1 aviso preexistente em `SocialSidebar.tsx` sobre exportação do helper `shortTime` (`react-refresh/only-export-components`).
- Build WEB: aprovado, utilizando o wrapper local `work/build-community-3a.mjs web`.
- Build Desktop: aprovado, executado em seguida com o mesmo wrapper e alvo `desktop`.
- `git diff --check`: aprovado (somente avisos de normalização LF/CRLF).

Logs: `sidebar-layout-tests.txt`, `sidebar-layout-lint.txt`, `sidebar-layout-web-build.txt` e `sidebar-layout-desktop-build.txt` em `../../outputs/`.

## Limitações e conferência manual restante

As capturas comprovam o layout dos componentes reais com fixtures; não comprovam uma sessão autenticada WEB/EXE, hardware de áudio, chamada conectada ou seu painel `ConnectedVoiceBar`. A prévia usa adaptadores locais sem mídia; a seleção de dispositivos foi validada somente nesse contexto. O modal real continua ligado ao mesmo callback no aplicativo; a prévia verifica apenas seu acionamento. O build Desktop não equivale a executar um instalador ou testar interativamente o EXE.

Conferir no aplicativo autenticado: alternância servidor/Social, chamada ativa e retorno à chamada, menus de dispositivos com hardware, nomes longos e janela estreita. Nenhuma lógica de chamada ou dispositivo foi alterada.

Nenhuma migration, banco, publicação, push, versão ou atualização automática foi alterada.
