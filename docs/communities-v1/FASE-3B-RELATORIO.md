# Comunidades V1 — 3B: Explorar Comunidades

Entrega exclusivamente local de 21/10/2026, na branch `codex/communities-v1`.
Base preservada: `3fa140a`, incluindo toda a Fase 3A. A 3C não foi iniciada.
Nenhuma migration remota, publicação, push, instalador ou atualização automática.
A flag `VITE_COMMUNITIES_V1_ENABLED` continua desligada por padrão.

## Funcionalidades implementadas

- Entrada **Explorar** na navegação Social existente, condicionada à mesma flag.
  A tela é carregada sob demanda, sem alterar a Central Social, hotbar ou servidores.
- Pesquisa textual por palavras/prefixos de nome e descrição, filtros de categoria,
  idioma e interesse; paginação por `(published_at,server_id)`, 12 cards por página,
  teto de 30 por RPC. Busca tem debounce de 400ms.
- Cards com nome, descrição, ícone/banner opcional, categoria, idioma e forma de ingresso.
  Nenhuma contagem de membros, atividade, avaliação ou popularidade foi inventada.
- Destaques aparecem somente quando há registros realmente selecionados pela operação
  confiável (`featured_at`); não são calculados aleatoriamente nem concedidos pelo proprietário.
  Não há interface de curadoria/moderação da 3C nesta entrega.
- “Você conheceu nesta sessão” usa até três apresentações realmente abertas nesta conta,
  revalidadas por RPC. O histórico é apenas em memória, sem rastreamento entre sessões/contas.
- Apresentação pública com identidade, descrição completa, interesses e regras públicas.
  Estados de carregamento, erro com nova tentativa, vazio e apresentação retirada.
- **Comunidade → Descoberta** permite salvar sem listar, solicitar publicação, escolher
  ingresso direto ou por aprovação e remover a listagem. Somente o proprietário publica.
- Solicitações pendentes, retirada, aprovação/rejeição por proprietário ou gestor
  expressamente delegado. Administrador sem delegação não recebe esses poderes.
- O ingresso usa `server_members`, o cargo `MEMBER` existente e o onboarding da Fase 2.
  Não há cadastro de servidor, identidade ou sistema de cargos paralelo. Convites existentes
  continuam funcionando pelo caminho atual; a descoberta é uma alternativa autorizada pelo
  backend, sem fabricar ou expor códigos de convite públicos.
- Auditoria existente recebe rótulos de publicação/retirada, ingresso e revisão de solicitações.

## Publicação e elegibilidade

A apresentação é uma **cópia pública explícita**, independente do perfil e das configurações
internas. Nome, descrição, imagens, interesses e regras internas não são divulgados por
ativar Comunidade ou editar configurações anteriores.

“Solicitar publicação” faz verificação automática nesta V1, explicada no formulário:
comunidade ativa, proprietário atual não banido, nome de 2–100 caracteres, descrição de
20–3000, categoria válida, ao menos uma regra pública e consentimento explícito. Imagens
devem ser HTTPS sem credenciais, até 2048 caracteres; idioma segue formato simplificado
de tag, até 35 caracteres. Até dez interesses (40 caracteres) e regras públicas (500).
Não foi implementada uma fila fictícia de análise humana nem prometida aprovação manual.

O padrão é não listar. Desativar a comunidade retira sua listagem e incrementa a revisão;
reativá-la não republica. Uma suspensão confiável não é removida por salvar, publicar ou
desativar/reativar. O estado e o campo de destaque preparam controles operacionais futuros,
sem implementar a Central de Moderação da 3C.

## Banco e segurança

Migration incremental: `supabase/migrations/20261021040000_community_discovery.sql`.
Aplicada somente a bancos sintéticos no PostgreSQL local identificado pelo runner.

- `community_directory`: apresentação pública, estado/revisão e metadados privados
  de consentimento/curadoria. FKs aos servidores existentes.
- `community_join_requests`: uma solicitação por servidor/usuário; estado, revisão e
  auditoria privada de análise. Não armazena justificativas ou dados pessoais extras.
- Índices de ordenação, categoria/idioma, busca full-text GIN, interesses GIN e fila pendente.
- RLS habilitada nas duas tabelas, com políticas específicas de visibilidade pública e
  solicitação própria/gestão. **Nenhum SELECT ou escrita direta de navegador é concedido**:
  o acesso é por RPC com projeção explícita, autorização e orçamento de requisições.
- “Público” significa visível a usuários autenticados que não são membros. **Anon não tem
  acesso** nesta entrega. Isso permite controlar frequência por identidade sem confiar
  em um endereço IP fornecido pelo cliente. Não é um diretório anônimo indexável por buscadores.
- RPCs públicas autenticadas: `search_community_directory`, `get_public_community`,
  `get_community_discovery_settings`, `save_community_discovery`,
  `join_discovered_community`, `list_community_join_requests`,
  `review_community_join_request`, além do predicado restrito `community_is_discoverable`.
- A projeção não contém autoria administrativa, listas de membros, mensagens, canais,
  eventos, configurações internas, códigos de convite ou revisões de regras privadas.
  IDs inexistentes, comuns ou retirados retornam a mesma apresentação indisponível.
- Limites por usuário: pesquisa 120/min; apresentação 120/min; salvar 10/min;
  ingresso/solicitação 10/min; listar solicitações 60/min; revisar 30/min.
  São limites por identidade, não proteção completa contra criação distribuída de contas.
- Repetição de solicitação pendente é idempotente; recusa/retirada impõe espera de 24h.
  Edição e ingresso usam revisão esperada. Aprovação usa revisão da solicitação.
- Ingresso trava o servidor, revalida publicação, comunidade e banimento e só atribui
  o `MEMBER` atual. Um cargo padrão com privilégios administrativos ou permissões
  desconhecidas ativas bloqueia o ingresso, sem conceder esse poder a recém-chegados.
- A data de ingresso é `clock_timestamp()`, para não anteceder o início do screening
  quando a configuração e a admissão acontecem na mesma transação.
- Aprovação não aceita regras em nome do usuário nem atribui cargos de onboarding.
  O usuário continua sujeito ao screening de texto e à atribuição segura da Fase 2.
  A política anterior de voz/mídia não foi ampliada nem modificada nesta tarefa.
- Um trigger estreito em banimentos serializa novas inserções contra o ingresso pela
  descoberta de servidores configurados; os mecanismos de banir/expulsar existentes
  permanecem. Não há edição em provedores de chamadas, captura ou mensagens.

Reversão funcional: desligar a flag e retirar listagens com as operações autorizadas.
Não foi criado script destrutivo de DROP/limpeza de histórico.

## Testes e resultados

| Ambiente / verificação             | Resultado e alcance                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Node                               | **248 aprovados, zero falhas/ignorados**; inclui os 245 anteriores e três novos testes de contratos |
| TypeScript                         | Aprovado                                                                                            |
| ESLint dos alterados/novos         | Zero erros; um aviso preexistente em `SocialSidebar.shortTime` sobre Fast Refresh                   |
| Scanner de segurança               | Zero achados; contagem no log final                                                                 |
| Build WEB, flag ligada             | Aprovado, compilação                                                                                |
| Build Desktop, flag ligada         | Aprovado, sem distribuir/empacotar EXE                                                              |
| Build WEB, flag ausente            | Aprovado, recurso desligado                                                                         |
| PostgreSQL nativo isolado          | Todas as migrations, suítes anteriores e testes 3B aprovados                                        |
| Prévia funcional                   | Componentes reais, callbacks em memória e fixtures identificadas; não é autenticação                |
| HTTP/Auth e clientes WEB/EXE reais | Não executados; permanecem pendentes                                                                |

O runner fixa `127.0.0.1:55468`, confere o diretório/marcador do laboratório e cria
um banco novo por execução, sem reset, DROP ou dados reais. A identidade SQL sintética
do bootstrap não é GoTrue/PostgREST. Docker, projeto hospedado e produção não foram usados.
Último banco aprovado: `lobbyx_community_test_1792593926321`.

Cobertura SQL: servidor comum/ativo/desativado; proprietário/delegado/admin sem delegação/
membro/visitante autenticado/anon; consentimento e campos; dados privados fora da projeção;
escrita direta negada; ingresso direto e por aprovação; duplicação, recusa, cooldown,
retirada e revogação de delegação; políticas RLS também exercitadas com grants de colunas
temporários, desfeitos no teste, além das restrições RPC-only efetivas;
revisão antiga, cargo padrão privilegiado, banimento, suspensão, reativação sem republicação;
preservação de dados existentes e IDs; screening obrigatório e mensagem recusada antes
da aceitação; paginação com 25 registros e horários empatados; prefixos e rate limit.

Três disputas reais em processos PostgreSQL distintos foram acrescentadas às nove anteriores:
duas solicitações produzem uma pendente; duas aprovações produzem um membro e um conflito;
ingresso aguardando um banimento é recusado após revalidação. Suítes anteriores de
mensagens, menções, não lidos, permissões e Performance Monitor também passaram.

Correções durante a execução: sintaxe da validação SQL, acesso estrito aos contratos
TypeScript, data de ingresso em transação e descarte do root React no hot reload da prévia.
Um fixture de paginação inicialmente acionou corretamente o limite de criação de servidores;
foi ajustado para preparação privilegiada sem identidade de cliente, somente no banco sintético.
Esses resultados intermediários não foram registrados como aprovações.

## Prévia e capturas reais

Na raiz desta worktree, executar `npm run preview:community-discovery` e abrir
`http://127.0.0.1:5208/`. A prévia começa vazia; “Carregar exemplo fictício” é um controle
somente do harness. Seus dados existem em memória e desaparecem ao recarregar.
Não carrega configuração Supabase nem o prefixo VITE de ambiente da aplicação.
Não oferece persistência, autenticação, revisão administrativa HTTP ou integração de ingresso.

Conferidos no navegador: vazio, card, apresentação/regras, filtro sem resultados,
formulário do proprietário, consentimento desmarcado por padrão, publicação em memória,
solicitação pendente/retirada, erro recuperável, carregamento e histórico da sessão.
Execução limpa sem erros de console após a correção de hot reload. Em viewport 390×844,
largura útil/scroll do documento de 375/375px, sem overflow horizontal.

Capturas em `vo/outputs/`, de componentes reais com dados fictícios:

- [Explorar completo](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3b-explore-full.png)
- [Vazio](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3b-empty.png)
- [Apresentação e solicitação pendente](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3b-presentation.png)
- [Escolha explícita do proprietário](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3b-owner.png)
- [Layout estreito](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3b-mobile.png)

## Arquivos e evidências

Novos: migration; `types/community-discovery.ts`, `lib/community-discovery.ts`,
`services/community-discovery.ts`; componentes `CommunityDiscovery.tsx`,
`CommunityDiscoveryView.tsx`, `CommunityDiscoverySettings.tsx`, `DiscoverySettingsForm.tsx`;
testes SQL/Node; `tests/community-discovery-preview/`; este relatório.

Estendidos: `SettingsCommunity`, `SocialSidebar`, rótulo tipado em `SocialHome`,
integração lazy em `routes/_authenticated/app.tsx`, tipos Supabase, rótulos de auditoria,
runner de banco e script npm. Não há dependência nova ou mudança de versão.

Logs em `vo/work/`: `community-3b-tests.log`, `community-3b-db.log`,
`community-3b-typecheck.log`, `community-3b-lint.log`, `community-3b-security.log`,
`community-3b-web.log`, `community-3b-desktop.log`, `community-3b-web-default.log`,
`community-3b-preview.log`. Os builds usam somente URL loopback e chave placeholder
não operacional de compilação; não representam login nem acesso ao banco.

## Privacidade, limitações e pendências antes de publicar

- Imagens HTTPS externas podem revelar o IP ao host da imagem. `no-referrer` evita enviar
  a origem, mas não equivale a um proxy de privacidade. Há consentimento do proprietário;
  hospedagem controlada/moderação de imagens deve ser avaliada antes da publicação.
- Conteúdo público é intencionalmente separado das regras internas. A administração
  precisa manter essa apresentação; não há cópia automática de alterações internas.
- Retirar a listagem bloqueia novas leituras/ingressos; não pode apagar uma cópia pública
  já recebida por outra pessoa. O cliente revalida e oculta resultados em caso de erro/retirada.
- Não há recomendações personalizadas, ranking fictício, métricas de popularidade,
  contagem pública de membros ou acesso anônimo. Destaques sem dados são omitidos.
- Não foram feitos benchmark de milhares de comunidades/solicitações nem medições de
  CPU/GPU. Paginação, índices, lazy loading de imagens e componentes, e ausência de efeitos
  pesados reduzem trabalho desnecessário; isso não comprova desempenho em máquinas fracas.
- Ainda validar autenticação HTTP real, RLS via API, duas sessões WEB/EXE, troca de conta/
  servidor, CSP/imagens, rede/reconexão e regressões reais de mensagens, notificações,
  chamadas e compartilhamento. Os testes SQL/fixtures não substituem essa integração.
- A política de onboarding da Fase 2 preserva screening de texto; não se declara bloqueio
  novo de voz/mídia antes de aceitar regras. Eventual ampliação exige escopo específico.
- Antes de abrir o diretório a público amplo, definir operação confiável de curadoria,
  suspensão, tratamento de abuso/contas múltiplas e retenção de solicitações. A estrutura
  permite essas políticas, mas a 3C aguarda avaliação e não foi implementada.

Instalador estável 0.1.58 preservado, SHA256:
`1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`.
Não há recomendação de liberação em produção sem as validações críticas acima.
Próximo passo: avaliação do usuário sobre a 3B; não iniciar a 3C automaticamente.
