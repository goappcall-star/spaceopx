# Comunidades V1 — relatório da reformulação visual

21/10/2026 · desenvolvimento local · branch `codex/communities-v1` · base `1278e33`.

## Resultado e escopo

Revisão dos componentes reais das Fases 1–5, iniciada pela auditoria [REVISAO-VISUAL-AUDITORIA.md](./REVISAO-VISUAL-AUDITORIA.md). A intervenção mais ampla ficou nos editores de eventos, personalização da Home, publicação no Explorar, sanções e coleção de cosméticos. Home, busca, apresentação pública e ativação já tinham estrutura adequada e receberam ajustes menores. Nenhuma publicação, push, migration, alteração de versão ou atualização automática foi executada.

A prévia unificada está em [127.0.0.1:5213](http://127.0.0.1:5213/), iniciada com `npm run preview:communities`. Usa componentes reais, callbacks em memória e fixtures identificadas. Não constitui uma conta autenticada, servidor real ou teste de permissões. Os exemplos dos módulos são independentes; editar um evento não modifica a fixture da Home.

## Inventário auditado e alterações

| Interface | Diagnóstico e resultado |
| --- | --- |
| Criação/edição de eventos | Modal estreito e campos uniformes substituídos por editor com prévia lateral, nome em destaque, grupos de conteúdo/data/canal/capa e fuso avançado. Rolagem interna e rodapé de ações sempre visível. Ambiguidades de horário permanecem explícitas, fora das opções recolhidas. |
| Home | Preservados banner, identidade, módulos e navegação; atalho renomeado para Configurações e hierarquia do saldo coletivo reforçada. |
| Ativação | Preservadas seis etapas e revisão final; indicadores recebem o acabamento compartilhado. Sem novas etapas ou mudança na autorização. |
| Onboarding | Progresso numerado, boas-vindas com identidade oficial, interesses/cargos em opções visuais, regras e resumo final claros. Aceite obrigatório e comportamento de salvar/continuar preservados. |
| Home e boas-vindas | Formulário dividido em Identidade, Organização da Home e Boas-vindas. Grupos continuam montados para preservar rascunhos. Prévia imediata do texto/banner, ações e erros identificáveis. |
| Publicação no Explorar | Editor agrupado e prévia pública ao lado; imagens opcionais recolhidas; ingresso, critérios e consentimento separados. Prévia não publica e não elimina a confirmação. |
| Busca, cards e apresentação pública | Estrutura existente preservada, escopo visual compartilhado; sem números de popularidade ou membros inventados. |
| Solicitações de entrada | View pura reutilizável, identificação/data, ações, vazio orientado, carregamento/erro e paginação. Controlador mantém RPC, revisão, cursor e invalidação existentes. |
| Denúncias/evidências | Contexto, data e evidência separados. Apenas identificador técnico fica recolhido; conteúdo e retenção continuam visíveis. Cabeçalho do formulário e vazio refinados. |
| Advertências/expulsão/banimento | Escolhas com consequências, resumo visível do membro/ação/motivo, ações destrutivas em vermelho. Checkbox continua obrigatório e é limpo quando alvo, ação ou motivo mudam. |
| Antispam/delegação | Limites agrupados, opções em cards e escopo das permissões explícito; nenhuma punição automática nova. |
| Segurança da Plataforma | Aviso destacado de autoridade oficial, mantendo separação da gestão da comunidade e consequências da suspensão/reversão. |
| Nível e XP | Saldo permanente destacado e barra existente preservada; ganhos automáticos continuam desligados. |
| Missões/conquistas/galeria | Hierarquia leve nos cards e ícones; status de indisponibilidade e verificador desligado preservados. Sem novas regras de progresso. |
| Estatísticas | Indicadores prioritários destacados, gráfico SVG compacto responsivo, datas nas extremidades, valores diários acessíveis por lista recolhível e estados sem registros. Período, consultas e paginação preservados. |
| Cosméticos | Coleção por tipo/slot, disponibilidade, seleção e prévia combinada lateral. Item bloqueado permite visualizar, mas mantém Aplicar desabilitado. Equipar/remover continuam nos callbacks existentes. |
| Diálogos, seletores e confirmações | Padrões compartilhados para cabeçalho, seção, capa, aviso, ações e vazio; sem modificar Dialog/AlertDialog globais nem esconder consequências sensíveis. |

## Componentes e arquivos

Novos: `src/components/community/CommunityUI.tsx`, `community-ui.css` e `CommunityJoinRequestsView.tsx`; teste `tests/community-visual.test.mjs`.

Componentes alterados em `src/components/community/`: `CommunityEventEditor`, `CommunityEventList`, `CommunityCustomizationForm`, `DiscoverySettingsForm`, `CommunityDiscoverySettings`, `ModerationViews`, `CommunityOnboarding`, `CommunityActivationWizard`, `CommunityHome`, `CommunityDiscoveryView`, `CommunityProgressionView`, `CommunityObjectivesView` e `CommunityEvolutionViews`.

Prévia: entradas e módulos de `tests/community-{events,discovery,moderation,evolution}-preview`, além de `tests/community-unified-preview/preview.tsx`. Estilos globais passam a ser carregados pelas entradas independentes, evitando sua reinserção tardia pelos módulos embutidos. A prévia unificada continua usando uma folha global com os fontes das fixtures.

São extensões dos Button/Input/Label/Dialog e tokens existentes, com CSS limitado ao escopo comunitário. Sem dependências novas, imagens geradas, fontes remotas, canvas, WebGL, animações ou sombras novas. O backdrop do Dialog existente permanece; não foi adicionado outro efeito. Modo Desempenho e provedores de mídia não foram modificados. Não houve medição comparativa de CPU/GPU ou benchmark; não se afirma ganho numérico de desempenho.

## Problemas encontrados e corrigidos durante a validação

1. CSS global repetido por módulos lazy da prévia podia sobrescrever a direção responsiva e empilhar o conteúdo abaixo da navegação. Importações movidas às entradas; teste de regressão adicionado.
2. A fixture da Home tinha ID de aviso não UUID e era recusada pelo validador real ao salvar. ID fictício corrigido; teste executa o validador real contra a fixture. O validador não foi afrouxado.
3. Handler HMR antigo do módulo de descoberta tentava desmontar um `root` que só existe na entrada. Handler duplicado removido; desmontagem permanece na entrada independente.
4. Prévia de evento em edição dizia “ainda não publicado”. Agora distingue prévia das alterações de novo evento.
5. Verificação final de TypeScript detectou que a validação mais estrita de URLs perdia o estreitamento de `src` opcional. Condição de renderização corrigida e TypeScript reexecutado com sucesso.
6. Prévia de imagem recusa HTTP, data URLs, URLs com credenciais, URLs relativas a outro host e barras invertidas; erro de imagem tem fallback e troca de URL permite nova tentativa. URLs HTTPS e ativos locais internos continuam aceitos para renderização. Validação de gravação permanece inalterada.

## Testes e evidências

| Verificação | Resultado e alcance |
| --- | --- |
| Node completo | **282 aprovados, 0 falhas, 0 ignorados**. Inclui 9 novos testes desta revisão. |
| Novas interações de componentes | Edição preserva revisão/fuso IANA e instante exato com milissegundos; mudança em horário ambíguo exige ocorrência explícita; conflito bloqueia salvamento; confirmação de sanção é limpa quando contexto muda; imagens inseguras/falhas/troca de URL; cosmético bloqueado; consentimento de descoberta; validade das fixtures e isolamento de estilos/raízes. Harness sintético com handlers reais, sem autenticação. |
| TypeScript | `npm run typecheck` aprovado após a correção registrada acima. |
| ESLint | Arquivos TSX/MJS alterados aprovados; formatação verificada com Prettier. Não se declara lint integral do repositório. |
| Scanner de segurança | Aprovado, sem achados. |
| Build WEB | Aprovado com configuração pública de compilação local, sem credenciais operacionais. |
| Build Desktop | Aprovado por `desktop/build.mjs`; não foi criado/distribuído instalador e não equivale a teste manual no Electron autenticado. |
| Build com flag padrão desligada | WEB aprovado; padrão da flag não foi alterado. |
| Build da prévia | Aprovado com saída local separada. |
| SQL | Não reexecutado nesta tarefa visual: nenhuma migration, RPC, consulta SQL, RLS ou contrato de backend foi alterado. Resultados anteriores não são reapresentados como novos testes. |
| HTTP autenticado / Storage / mídia | Não executados; não há backend isolado autenticado nesta prévia. Nenhum teste em produção. |

Logs locais: `vo/work/community-visual-check-0.log` (Node), `community-visual-check-1.log` (TS), `community-visual-lint.log`, `community-visual-check-2.log` (scanner), `community-visual-web.log`, `community-visual-desktop.log`, `community-visual-default-web.log` e `community-visual-preview-build.log`. Os logs podem conter avisos já existentes das ferramentas, como diretivas `use client` e plugin de paths redundante; builds encerraram com código zero.

### Navegação e responsividade observadas no navegador

- 1366×768: editor, personalização, publicação, moderação, estatísticas e catálogo; composição em colunas quando há espaço.
- 1920×1080: editor de evento e sanções; prévia/resumo laterais.
- 390×844: editor, personalização, regras do onboarding e indicadores; composição em uma coluna. Editor com largura 366 px, altura aproximada 760 px e ação Salvar dentro da área visível.
- 800×600: editor com largura 776 px, altura 540 px e botão Salvar com limite inferior em 553 px. Rolagem interna mantém o rodapé acessível.
- Nas amostras DOM verificadas, `scrollWidth` não excedeu a largura do viewport; barra vertical esperada em páginas longas.
- Tab moveu de Título para Descrição com `:focus-visible` verdadeiro; foco visível inspecionado. Escape fechou onboarding. Seletores nativos mantidos. Não é uma auditoria completa com leitor de tela/WCAG.
- Na fixture, título de evento foi editado e salvo; texto da Home atravessou troca de grupos e foi salvo; onboarding percorreu regras/interesses/canais/cargos/conclusão; avançar sem aceite permaneceu bloqueado. Solicitação fictícia foi aprovada e removida da lista. Erro simulado do Explorar mostrou ação de tentar novamente. Nada foi escrito remotamente.
- Zoom real do navegador e escala de DPI do Windows **pendentes**: os atalhos Ctrl+mais não alteraram o viewport/devicePixelRatio no navegador incorporado. Teste de janela pequena não foi considerado substituto de zoom real. Teste manual no EXE permanece necessário.

## Comparação visual e capturas

Capturas reais dos componentes, com dados fictícios. As imagens “antes” foram feitas antes de editar os componentes; algumas são capturas de página completa e têm altura diferente das capturas de viewport “depois”. Não representam sessões autenticadas nem prova de integração.

| Área | Antes | Depois |
| --- | --- | --- |
| Eventos | [Antes](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-before-event.png) | [1366×768](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-event-1366.png) · [1920×1080](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-event-1920.png) · [Móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-event-mobile.png) |
| Personalização da Home | [Antes](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-before-settings.png) | [Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-settings-1366.png) · [Móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-settings-mobile.png) |
| Publicação | [Antes](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-before-publication.png) | [Depois](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-publication-1366.png) |
| Moderação | [Antes](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-before-moderation.png) | [Depois](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-moderation-1920.png) |

Outras evidências: [Onboarding Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-onboarding-1366.png), [regras no móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-onboarding-mobile.png), [antispam](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-security-1366.png), [estatísticas Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-statistics-1366.png), [estatísticas móveis](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-statistics-mobile.png), [cosméticos](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-visual-after-cosmetics-1366.png).

## Limitações e pendências reais

- Capa de eventos e imagens de publicação continuam por HTTPS. Storage existente exige `manage_server`; gerenciar eventos/comunidade não garante essa permissão. Não foi ampliada RLS nem simulada funcionalidade de upload. Home preserva a callback de upload existente quando fornecida pelo controlador autorizado; não foi validada com autenticação.
- Home sem banner personalizado usa o banner do servidor; o formulário não recebe esse ativo como prop e mostra placeholder explicativo na prévia. Falhas de imagem também usam placeholder.
- Auth HTTP, RLS em sessão real, upload assinado, reconexão e permissões revogadas entre clientes permanecem pendentes de ambiente autorizado apropriado. Os testes Node não substituem esses cenários.
- Chamadas WEB/EXE, áudio de sistema e sincronização não foram testados nesta revisão. Nenhum provedor de voz/compartilhamento foi modificado.
- Não se habilitaram XP, verificadores, schedulers, retenção automática, pagamentos ou impulsos. Dados sintéticos da prévia não atestam atividade real.
- Escala/zoom/DPI e exame manual do Electron devem integrar a próxima avaliação; não foram marcados como aprovados.

## Preservação e próxima avaliação

Nenhuma alteração em `supabase`, serviços, provedores, desktop, `package.json` ou lockfile nesta tarefa. Instalador estável 0.1.58 conserva SHA256 `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`.

Para avaliar: abrir a prévia, navegar pelos oito módulos, criar/editar evento, alternar os três grupos da Home, conferir consentimento/publicação, simular solicitação, testar denúncia/sanção e visualizar cosmético bloqueado. Alternar conta fictícia reinicia a sessão; servidor comum mantém os módulos exclusivos ocultos. Dados e ações continuam locais.

Aguardar avaliação visual. Antes de qualquer implantação futura, executar os cenários autenticados e manualmente no WEB/EXE, resolver as pendências operacionais, revisar o plano de migrations e obter as autorizações específicas. **Nenhuma implantação foi executada.**
