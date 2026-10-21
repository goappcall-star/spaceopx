# Comunidades V1 — Fase 4B: missões e conquistas coletivas

Entrega exclusivamente local, em 21/10/2026, branch `codex/communities-v1`, sobre a 4A (`9503814`). Nenhuma publicação, push, migration remota, instalação de Docker, staging, mudança no atualizador ou distribuição de EXE. **Fase 4C não iniciada. Ganhos e verificador de missões permanecem desligados.**

## 1. Auditoria e decisão sobre fontes

Foram revisados a migration `20261021060000`, contratos/serviços/relatório da 4A, ativação e delegação da Fase 1, onboarding da Fase 2, eventos 3A, publicação do diretório 3B e permissões/moderação 3C. O Progression V1 individual arquivado não foi restaurado; `user_xp`, curva individual, triggers de mensagem/servidor, badges, ranks e inventário individual não foram alterados.

| Fonte                                            | O que o backend consegue comprovar                                                                                                 | Uso aprovado na 4B                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Primeira ativação                                | Inserção de configuração ativa após autorização explícita do proprietário/gestor, regras e canal validados pelo contrato existente | Uma conquista permanente, sem XP, apenas para novas ativações posteriores à migration                                   |
| Primeira publicação                              | Publicação realmente elegível, consentida e efetuada pelo proprietário no diretório                                                | Uma conquista permanente, sem XP, apenas para a primeira publicação posterior à migration                               |
| Atestação privada da 4A                          | UUID de evidência único, servidor correto, validade, consumo pelo backend e registro no ledger                                     | Contrato preparado para missões; **fonte real de participação ainda não integrada**, verificador inicialmente desligado |
| RSVP, interesse e lembretes                      | Intenção de comparecer; não comprovam realização/participação                                                                      | Rejeitados para progresso/XP                                                                                            |
| Criar/editar eventos ou mensagens                | Operação do banco, facilmente repetível e manipulável                                                                              | Rejeitados para progresso/XP                                                                                            |
| Voz, peers, presença e duração do renderer       | Conexão/sinalização; não comprovam participação legítima                                                                           | Rejeitados para progresso/XP                                                                                            |
| Ingressos, convites, cargos, denúncias e sanções | Operações verificáveis, mas incentiváveis artificialmente ou sujeitas a abuso                                                      | Não utilizados como objetivos ou fontes de XP                                                                           |

Os dois marcos administrativos não comprovam participação, qualidade da comunidade ou identidade humana. Contas falsas podem criar servidores novos e obter um marco por servidor; **isso não concede XP, item utilizável, recompensa individual ou valor econômico**. Conectar esses marcos a benefícios futuros exige nova análise de fraude.

Alternar ativação não concede novamente: o trigger observa somente a primeira inserção da configuração. Republicações são reconhecidas pelo `published_at` permanente; mudanças de versão do catálogo também não recriam o desbloqueio, único por servidor/ID da conquista. Não há backfill: comunidades já ativadas/publicadas antes da migration não recebem esses marcos ao reativar/republicar.

## 2. Funcionalidades implementadas

- Catálogo de IDs estáveis, critérios/cadências imutáveis e versões de definições também imutáveis.
- Missões diárias e semanais com nome, descrição, alvo, progresso, período UTC, recompensa configurada, conclusão e expiração.
- Estados `available`, `in_progress`, `completed`, `expired` e `unavailable`; sem verificador/habilitação, a interface identifica as missões como futuras.
- Instâncias criadas somente por atividade confiável consumida, não por abrir a Home. Períodos sem atividade não geram um histórico fictício de missões expiradas.
- Versão fixada na primeira contribuição do período. Trocar o catálogo não altera meta/recompensa da missão iniciada, nem permite repetir sua conclusão no mesmo período.
- Mapa privado e imutável das **evidências exatas creditadas em cada missão**. A mesma evidência não é contada duas vezes na mesma instância.
- Histórico de conclusões/instâncias expiradas paginado e preservado após desativação.
- Conquistas com categoria, raridade, critério, versão, data de desbloqueio e galeria bloqueada/desbloqueada. Versão do desbloqueio fica fixada, independentemente da versão atual do catálogo.
- Contrato de catálogo cosmético e registro de desbloqueios da comunidade, sem inventário paralelo de usuários, ativos fictícios, pagamento ou botão de aplicar/equipar.
- Home integrada aos componentes existentes: missões, conquistas recentes, galeria, histórico e detalhes com XP efetivamente recebido.

Nenhuma rota de voz, provider WebRTC, captura, mensagens, hotbar ou navegação principal foi redesenhada. A Home recebe os novos componentes no slot de progressão já criado pela 4A. A integração mantém chaves por conta/servidor; estados de diálogo e cache não são reutilizados entre essas chaves.

## 3. Definições iniciais e XP

| ID                      | Critério / período                                         | Recompensa configurada            | Situação inicial                 |
| ----------------------- | ---------------------------------------------------------- | --------------------------------- | -------------------------------- |
| `verified_daily`        | 3 atestações distintas de atividade legítima; dia UTC      | Até 150 XP, dentro dos tetos      | Futura, indisponível             |
| `verified_weekly`       | 10 atestações distintas; semana UTC iniciada segunda-feira | Até 500 XP, dentro dos tetos      | Futura, indisponível             |
| `community_foundation`  | Primeira ativação nova após a migration                    | Nenhum XP ou cosmético utilizável | Marco administrativo verificável |
| `community_publication` | Primeira publicação autorizada após a migration            | Nenhum XP ou cosmético utilizável | Marco administrativo verificável |

Os valores de missões são configuração de backend preparada; não há promessa de ganho real nem fonte de participação habilitada. O catálogo cosmético começa vazio e seu contrato exige `usable=false`. Selos, temas, banners, molduras e destaques são tipos preparados; aplicação visual pertence à 4C.

Uma atestação original pode contribuir para o objetivo diário e semanal, uma vez em cada um. Atividade válida continua verificável mesmo se o XP base tiver sido limitado a zero. Eventos de **recompensa de missão nunca contam como nova atividade**, impedindo cadeias recursivas de conclusões.

Há no máximo oito IDs de missão ativos por cadência e uma instância/conclusão por comunidade/ID/período. O progresso é limitado à meta. Missões completas permanecem congeladas, inclusive depois de mudança de versão ou aumento de teto; não há reabertura de recompensa limitada.

### Mesma carteira da 4A

A migration amplia o tipo de atestação para `community_mission_reward` e evolui o consumidor existente; a migration 4A original permanece intacta. **Conta, curva, ledger, função de cálculo de tetos e política global continuam os mesmos.**

Ao concluir, o backend fixa o vínculo entre a instância e uma atestação de recompensa. O valor é lido da versão imutável da missão, não de parâmetro do cliente. A recompensa passa pelo mesmo consumidor e pelos tetos diário/semanal; `service_role` não recebe exceção. Uma atestação de recompensa sem conclusão vinculada é recusada.

Exemplos efetivamente testados no PostgreSQL: recompensa diária de 150 XP concedeu **50 XP** quando só restavam 50 no teto de 450; recompensa semanal concedeu **0 XP** no teto esgotado; em outro cenário concorrente, a recompensa integral de 150 levou a mesma conta de teste a exatamente **430 XP**. Nenhum desses valores vem de conta real.

A transação inclui crédito original, evidência creditada, progresso, conclusão, registro cosmético e eventual XP da missão. Falha na recompensa desfaz tudo, incluindo o crédito original; o verificador confiável deve repetir a mesma atestação após corrigir a falha, nunca criar outra evidência para o mesmo fato.

## 4. Migration e segurança

Nova migration: `supabase/migrations/20261021070000_community_missions_achievements.sql`, incremental e transacional, com timeouts. Não apaga/recria tabelas ou IDs existentes. O CHECK de fonte de atestação da 4A é ampliado na mesma transação, sem perda de registros.

Tabelas públicas, todas com RLS e sem grants diretos para clientes:

- `community_objective_keys` e `community_objective_versions` — identidade/critério e versões.
- `community_mission_progress` — uma instância por período, versão fixada e vínculo da recompensa.
- `community_achievement_unlocks` — um desbloqueio permanente por comunidade/ID.
- `community_reward_catalog` e `community_reward_unlocks` — contrato cosmético e desbloqueios comunitários, sem integração visual.

Tabelas privadas, também com RLS e ACL restritiva:

- `community_objective_active` — versão vigente de cada definição.
- `community_objective_verifiers` — habilitação explícita; inicialmente falsa.
- `community_objective_config_audit` — alterações de versão/verificador com operador, anterior/posterior e data.
- `community_mission_evidence` — atestações exatas creditadas, sem exposição ao cliente.

RPCs de leitura: `get_community_objectives`, `list_community_achievements` e `list_community_mission_history`. Requerem membro atual de comunidade ativa, não banido. Não existe RPC para declarar progresso/conclusão, editar catálogo, reclamar recompensa ou conceder XP pelo cliente.

Galeria e histórico têm limites até 50 registros, UI usa 20, com cursor exclusivo. IDs bigint de histórico são transportados como string. Projeções não incluem atores, participantes, evidências, payloads privados ou IDs administrativos. Índices cobrem histórico por servidor e conquistas recentes.

Locks por servidor da 4A serializam concessões/desativação. O motor trava o verificador e a versão ativa, rechecando-os após espera; a instância fixa a versão original. Constraints únicas, ledger e mapa de evidências protegem contra repetição. Os helpers privados têm `search_path` fixo e nenhuma permissão de execução para clientes.

Desativar preserva instâncias, evidências, conquistas, desbloqueios, XP e histórico. A exclusão explícita de servidor mantém a cascata existente; foi testada **somente em fixture local, dentro de transação totalmente revertida**, inclusive com conclusão, recompensa e evidências presentes. Nenhum dado real foi excluído.

## 5. Testes e resultados

| Validação                     | Resultado                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                    | **264 aprovados, 0 falhas, 0 ignorados**; sete novos testes de contratos, mais as regressões anteriores                                                                                                             |
| PostgreSQL isolado            | Migrations e suítes 1–4B aprovadas, incluindo segurança, menções, notificações, onboarding, eventos, descoberta, moderação e 4A                                                                                     |
| Upgrade pré-4B                | Banco separado com comunidade já ativada e publicada antes da migration: zero concessões retroativas, inclusive após reativação/republicação                                                                        |
| Estados de missão             | Zero/disponível, em andamento, concluída, expirada e indisponível; revogar verificador preserva o progresso real                                                                                                    |
| Recompensas                   | Parcial, zero e integral; mesma conta/ledger/tetos; recompensa não vira atividade; fato sem conclusão vinculada recusado                                                                                            |
| Atomicidade                   | Falha injetada no ledger da recompensa reverte conclusão, evidência, desbloqueio cosmético e XP original                                                                                                            |
| Integridade                   | Catálogo e critérios imutáveis, missão iniciada presa à versão, teto de oito missões por cadência e evidências exatas únicas                                                                                        |
| RLS/permissões                | Escrita direta e consumo por cliente recusados; membro lê projeção; estranho/comunidade desativada recusados; grants temporários de teste não contornam RLS                                                         |
| Concorrência                  | Mantidos 18 cenários anteriores; três novos: conclusão por eventos simultâneos, replay simultâneo e revogação de verificador. Uma conclusão/recompensa, progresso não recursivo, saldo exato e revogação respeitada |
| Preservação                   | Snapshots de XP individual, badges e mensagens idênticos; desativar/reativar mantém histórico e conquistas                                                                                                          |
| TypeScript                    | `npm run typecheck` aprovado                                                                                                                                                                                        |
| ESLint dos arquivos alterados | Aprovado, zero erros/warnings. O lint global com erros legados registrado na 4A não foi reclassificado como aprovado                                                                                                |
| Scanner                       | Sem achados; contagem final registrada no log local de segurança                                                                                                                                                    |
| Builds                        | WEB com flag ligada, renderer Desktop e WEB com flag padrão desligada aprovados; sem empacotamento ou distribuição de instalador                                                                                    |
| Prévia real no navegador      | Padrão seguro, progresso, conclusão parcial, detalhes, galeria e histórico exercitados; console sem erros na amostra; largura útil 375 px com `scrollWidth = clientWidth`                                           |
| HTTP autenticado              | **Não executado**: nenhum GoTrue/PostgREST isolado foi configurado. Roles/claims SQL não são autenticação ponta a ponta                                                                                             |
| WEB/EXE reais e chamadas      | **Não validados nesta entrega**. Builds e testes automatizados de voz existentes não substituem sessões autenticadas entre clientes, áudio ou compartilhamento reais                                                |

Banco principal final: `lobbyx_community_test_1792611617866`. Banco de upgrade final: `lobbyx_community_test_1792611617866_upgrade4b`. Ambos descartáveis locais no PostgreSQL nativo, loopback 55468; nenhum usuário/credencial de produção. Os dois flags foram confirmados como falsos após os testes.

Durante o desenvolvimento, uma execução de upgrade falhou em `community-foundation.sql:86`: a fixture histórica adicionada ao mesmo banco interferia na contagem global de auditoria esperada pela Fase 1. O cenário foi separado em outro banco descartável; a expectativa da regressão não foi enfraquecida e nenhum teste foi ignorado. Execuções finais passaram.

Logs locais: `vo/work/community-4b-{tests,db,typecheck,lint,security,web,desktop,web-default,preview,states,cascade}.log`. As execuções separadas iniciais de estados/cascata também foram incorporadas ao runner completo final.

## 6. Interface e capturas

Prévia: `npm run preview:community-objectives`, endereço `http://127.0.0.1:5211/`. Importa os componentes reais de apresentação; dados e botões de cenário são fictícios, em memória e explicitamente identificados. Não carrega cliente Supabase, conta real ou credenciais. A lateral é um contorno demonstrativo; a integração de produção foi preparada na Home existente, sem publicação.

Capturas em `vo/outputs/`:

- `community-4b-home.png` — padrão seguro, missões futuras e conquista recente.
- `community-4b-future-detail.png` — ausência de verificador e recompensa apenas configurada.
- `community-4b-completed.png` — exemplo fictício de conclusão com 50/150 XP efetivos.
- `community-4b-gallery.png` — bloqueio/desbloqueio, data, categoria e raridade.
- `community-4b-history.png` — conclusão e expiração.
- `community-4b-mobile.png` — layout responsivo, sem overflow horizontal.

![Prévia local 4B — dados fictícios](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-4b-home.png)

## 7. Arquivos desta entrega

Novos: migration 070000; `src/types/community-objectives.ts`; `src/lib/community-objectives.ts`; `src/services/community-objectives.ts`; `src/components/community/CommunityObjectives.tsx` e `CommunityObjectivesView.tsx`; `tests/community-objectives.test.mjs`; `tests/community-objectives.sql`; `tests/community-objectives-states.sql`; `tests/community-objectives-cascade.sql`; `tests/community-objectives-upgrade-fixture.sql`; `tests/community-objectives-upgrade.sql`; `tests/community-objectives-preview/{index.html,preview.tsx,vite.config.mjs}`; este relatório e `MISSOES-CONQUISTAS-OPERACAO-LOCAL.md`.

Alterados: `CommunityWorkspace.tsx` (slot existente da Home), `src/integrations/supabase/types.ts` (RPCs de leitura), `scripts/test-community-db.mjs` (cenários, concorrência e banco de upgrade) e `package.json` (comando de prévia).

A migration 4A permanece intacta; seu consumidor é evoluído somente pela nova migration. Não foram alterados providers, captura, perfis/XP individual, configuração Desktop ou updater. Instalador estável 0.1.58 preserva SHA-256 `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`.

## 8. Limitações, fraude e pendências de habilitação

1. **Não há verificador real de participação integrado.** Evidência UUID e `service_role` não provam sozinhos legitimidade. O futuro produtor precisa resistir a contas falsas, repetições, conteúdo recriado e ações artificiais antes de inscrever fatos privados. Hoje missões não geram progresso/XP real automaticamente.
2. Catálogo é de backend, sem editor administrativo no cliente. Recompensas e regras novas exigem versão inédita e revisão; não reaproveitar IDs para critérios diferentes.
3. As conquistas administrativas atestam configuração/publicação, não atividade humana ou endosso de qualidade. Não convertê-las automaticamente em XP/benefícios transferíveis.
4. Nenhum backfill autorizado. Uma decisão futura de reconhecer comunidades antigas exige proposta, auditoria, chave idempotente e autorização separadas.
5. Cosméticos não são utilizáveis nesta fase. Não há integração de equipar, renderizar novos banners/molduras, impulsos ou pagamentos. Isso não inicia a 4C.
6. Consultas atualizam ao montar/focar/reconectar; não há polling, novo Realtime ou promessa de atualização instantânea em outra sessão. Dados já consultados não podem ser “desvistos” após revogação.
7. Não houve benchmark de carga, CPU/GPU/RAM ou teste de horas em chamada. Nenhuma porcentagem de economia ou ausência de regressão em cliente real é alegada.
8. Antes de habilitar ganhos: definir autoridade e política antifraude, revisar balanceamento/limites, validar HTTP autenticado e dois clientes WEB/EXE em ambiente isolado disponível, rever permissões/reconexão e testar voz/compartilhamento com áudio quando suportado.

A entrega está pronta para **avaliação local da 4B**. Não é recomendação de publicação nem autorização para ativar ganhos ou iniciar a 4C.
