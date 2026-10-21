# Comunidades V1 — Fase 3C: Moderação e Segurança

Entrega local na branch `codex/communities-v1`, sobre `fd52cda` (3B).
Nenhuma operação contra produção, push, publicação, distribuição de EXE ou alteração
do atualizador. Sem Docker ou projeto hospedado. A Fase 4 não foi iniciada.
A flag `VITE_COMMUNITIES_V1_ENABLED` e os filtros novos continuam desligados por padrão.

## 1. Implementação concluída

### Comunidade

- Seção **Moderação** nas configurações, além de acesso pela Home da Comunidade.
  Membros comuns têm a área de suas próprias denúncias e advertências; os demais
  recursos dependem de permissões efetivas do backend.
- Fila paginada de denúncias com estado, busca por identificador/categoria, evidência,
  justificativas e histórico de decisões. A página mostra somente o conjunto atual
  autorizado, sem contagem global inventada.
- Denunciar mensagens de canais de comunidade, membros, eventos, avisos e apresentações
  públicas do Explorar. Botões junto aos conteúdos preenchem a referência; membros são
  escolhidos por nome. Mensagens diretas não foram incorporadas ao escopo de comunidades.
- UUID de denúncia e deduplicação de alvo pendente por denunciante. Novo envio após
  análise exige intervalo de 24h. A descrição de outra denúncia não é sobrescrita.
- Advertências com motivo, autoridade, data, estado e histórico. Revisão/revogação exige
  outra autoridade autorizada e mantém o registro anterior. Emissão idêntica pelo mesmo
  autor para o mesmo alvo, ativa nas últimas 24h, não duplica advertências.
- Expulsar e banir com motivo e confirmação explícita. Reutiliza `server_members`,
  `server_bans` e seus triggers de remoção/auditoria; não há segunda lista de banidos.
  Proprietário, própria conta, pares de moderação e hierarquia superior são protegidos.
- Histórico das decisões da Central. A auditoria geral anterior permanece no local e
  com suas permissões anteriores; não foi concedida automaticamente a novos moderadores.
- Delegação específica por cargo existente: denúncias, advertências, membros,
  segurança e histórico. Somente o proprietário pode substituir/revogar essas permissões.
  Administrador genérico, `manage_community` e flags do cliente não conferem a nova gestão.

### Filtros

- Configuração opt-in por comunidade: mensagens por 10s (3–30), repetições normalizadas
  por minuto (2–10), menções por mensagem (1–30), até 50 domínios bloqueados.
- Verificação por trigger em INSERT e alterações relevantes de mensagens existentes,
  incluindo envio direto pela API. Filtros inativos não alteram o comportamento do servidor.
- Contagem de frequência/repetição serializada por autor/servidor com advisory lock.
  Menções consideram texto e array. Domínios cobrem host exato e subdomínios de URLs
  HTTP/HTTPS, incluindo porta e credenciais na URL; não bloqueiam nomes apenas parecidos.
- Mensagens bloqueadas não são armazenadas nem enviadas a uma quarentena. O compositor
  mantém o rascunho e explica o bloqueio. Edição recusada mantém a mensagem original e
  deixa o editor aberto. Não há banimento automático, IA, DNS ou serviço de reputação.

### Plataforma

- Fundação da **Central de Segurança da Plataforma**, acessível pelo Explorar somente
  quando a identidade atual é autorizada no backend. Não foi autorizado nenhum usuário real.
- Lista privada `security_private.platform_safety_staff`, sem acesso de navegador e sem
  RPC de autoinscrição. Identidades são UUIDs de Auth, não emails enviados pelo cliente.
  Alterações confiáveis da lista geram auditoria privada do operador do banco.
- Fila de denúncias contra apresentações públicas, revisão com justificativa, suspensão,
  remoção de destaques e reversão de suspensão.
- Suspensão não exclui servidor ou dados. Reversão exige outra identidade oficial que
  não tenha aplicado a suspensão; deixa a comunidade **não listada**, para publicação
  explícita posterior pelo proprietário. Não publica rascunhos automaticamente.
- A Central oficial não concede permissões internas de membro, acesso a mensagens,
  canais, eventos privados ou listas de participantes de comunidades.

## 2. Banco e reutilização

Migration incremental local: `20261021050000_community_moderation.sql`.

Tabelas novas com RLS e sem grants diretos de navegador:

- `community_moderator_roles`: extensão de delegação ligada aos cargos atuais.
- `community_security_settings`: parâmetros opt-in e revisão.
- `community_reports`: referências, prazos, estado e autoria privada.
- `community_warnings`: advertências e revisões.
- `community_moderation_decisions`: decisões justificadas e separação de escopo.
- `security_private.platform_safety_staff`: identidade oficial controlada no backend.
- `security_private.platform_safety_identity_audit`: trilha do provisionamento/revogação.

`community_directory` recebeu a cópia da última apresentação efetivamente publicada,
prazo da cópia e autoridade de suspensão ativa. Reutiliza estado/revisão/destaque da 3B.
Não há cópia de perfil interno ou mensagem privada na apresentação pública.
Um rascunho salvo enquanto suspenso não substitui a cópia pública mostrada à plataforma.

Reutilizados membros, cargos, hierarquia, banimentos, auditoria e premissas do onboarding.
O predicado `community_role_selectable` exclui cargos com delegação de moderação. Um guard
também impede que gestores de cargos não proprietários atribuam esse cargo a si ou a outros.
Configurações/onboarding não foram apagados nem restaurados a partir de código arquivado.

RPCs administrativas e de leitura estão tipadas em `src/integrations/supabase/types.ts`.
Nenhuma operação administrativa nova depende apenas de botão oculto. Schema da plataforma
não é exposto por uma API genérica de leitura de servidor.

## 3. Segurança, privacidade e retenção

- Permissões revalidadas depois dos locks. Filas e ações são isoladas por servidor e
  escopo. A identidade oficial é travada/reconferida nas ações sensíveis para serializar
  revogação concorrente.
- SQL declara `search_path=pg_catalog` e referências qualificadas. Nenhuma entrada do
  usuário é interpolada em comandos SQL administrativos.
- Os RPCs e a projeção TypeScript não retornam `reporter_id`. Concessões diretas nas
  tabelas ficam revogadas. RLS foi exercitada separadamente com grants temporários
  restritos a colunas e desfeitos no teste.
- Evidência privada de mensagem/evento exige acesso atual ao canal também para o
  moderador. Perder o canal oculta o item. Referência de outro servidor é recusada.
- Não é permitido analisar denúncia própria, denúncia de membro contra a própria conta,
  denúncia de diretório do próprio servidor, nem revogar a própria advertência.
- UUID estável protege repetição de sanções após falha de rede. Revisões esperadas
  detectam decisão/configuração antiga. Históricos são adicionados no backend.
- Orçamentos: denúncias 10/h; leitura de filas/histórico 90/min; decisões 30/min;
  sanções 10/min; revisão de advertências 20/min; configuração/delegação 10/min;
  revisão pública oficial 60/min; ações oficiais 20/min.

**Retenção implementada:** evidência textual limitada a 1000 caracteres/30 dias;
descrição de denúncia, vínculo do denunciante e referências pessoais por até 90 dias;
motivos de advertências/decisões por 90 dias. A projeção já oculta campos expirados antes
de uma limpeza física. O worker anonimiza referências vencidas e deixa tombstones mínimos
com identificador técnico, tipo/estado/categoria/data/servidor. Não apaga conteúdo anterior
do aplicativo. Advertência expirada não pode receber revisão baseada em identidade apagada.

Cópias públicas retiradas vencem em 90 dias. Identidades da auditoria privada de
provisionamento são dissociadas em 90 dias. A autorização oficial atual permanece até
revogação; a autoridade de uma suspensão vigente permanece até sua reversão para garantir
revisão independente. São estados ativos de autorização/aplicação, não cópias de evidência.
A auditoria geral existente mantém sua política anterior e pode conservar autor/alvo da
sanção; ela não recebeu evidências ou identidade de denunciantes.

`prune_community_moderation_data(100)` está implementado e testado, somente owner confiável/
service_role. Limite 1–500 por conjunto/tabela, com SKIP LOCKED. **Nenhum cron/scheduler foi
instalado**. A execução periódica e seu monitoramento precisam ser definidos antes de
prometer eliminação física dentro do prazo. Ver `MODERACAO-OPERACAO-LOCAL.md`.

**Limite importante dos orçamentos transacionais:** uma chamada rejeitada por exception
desfaz a transação, inclusive eventual incremento de orçamento. Os limites comprovados
valem para ações aceitas/leituras; identidade, hierarquia, deduplicação e revisões também
barram repetição indevida. Throttle durável de todas as tentativas inválidas e ataques
distribuídos requer controle HTTP/gateway antes de publicação; não foi simulado como pronto.

## 4. Testes e resultados

| Verificação                                | Resultado / alcance                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Node                                       | **252 aprovados, zero falhas/ignorados**; mantém os 248 anteriores, quatro testes novos |
| TypeScript                                 | Aprovado                                                                                |
| ESLint dos alterados                       | Zero erros; aviso preexistente do export `QUICK_EMOJIS` em MessageItem/Fast Refresh     |
| Scanner de segurança                       | Zero achados; contagem no log final                                                     |
| WEB com flag ligada                        | Build aprovado                                                                          |
| Desktop com flag ligada                    | Build aprovado; sem criar/distribuir instalador                                         |
| WEB com flag ausente                       | Build aprovado, recurso desligado                                                       |
| PostgreSQL nativo isolado                  | Migrations, suítes 1/2/3A/3B e nova suíte 3C aprovadas                                  |
| Prévia real dos componentes                | Formulários operados com callbacks em memória e fixtures identificadas                  |
| HTTP/GoTrue/PostgREST/WEB↔EXE autenticados | Não executados nesta fase                                                               |

Runner usa apenas `127.0.0.1:55468`, confere diretório/marcador e cria bancos sintéticos
novos sem DROP/reset. Último banco aprovado: `lobbyx_community_test_1792605616796`. Auth SQL do bootstrap não é um teste HTTP autenticado.
Identidades oficiais foram concedidas/revogadas somente em fixtures locais.

Cobertura: proprietário, moderador delegado, administrador sem delegação, membro, externo,
banido e identidade oficial; autoatribuição negada, RLS/canal revogado, denúncias duplicadas,
ID/revisão antiga, advertência própria, hierarquia, expulsão/banimento existentes, configuração
off, frequência/repetição/menções/domínios, edição bloqueada, suspensão/reversão independente,
rascunho privado, remoção de destaque, expiração e worker de retenção, preservação de IDs,
mensagens, canais, membros, cargos e XP fora das sanções intencionais de fixture.

Os 12 cenários concorrentes anteriores permaneceram; três foram acrescentados:
sanção esperando revogação do cargo é negada; suspensão esperando revogação da identidade
oficial é negada; dois lotes de mensagens simultâneos respeitam o burst após advisory lock.
Regressões SQL anteriores de mensagens, menções, não lidos, permissões e monitor também passam.

Ocorrências intermediárias corrigidas: sintaxe PL/pgSQL de CASE; fixture de moderador
inicialmente abaixo do cargo MEMBER (a hierarquia o barrou corretamente); expectativa de
código único na disputa antiga de UUID de eventos. Esse teste agora aceita tanto conflito
de criação quanto recusa de servidor diferente, e **acrescenta verificação do registro original**.
Não foi alterada a implementação de eventos para enfraquecer a proteção ou ignorar o caso.

## 5. Interface real e prévia

Executar `npm run preview:community-moderation` na worktree e abrir
`http://127.0.0.1:5209/`. A porta 5208 da prévia anterior não foi tomada.
Harness em `tests/community-moderation-preview/`, sem configuração Supabase ou prefixo VITE.
O seletor de Plataforma no harness não concede autorização na aplicação.

Conferidos: motivo obrigatório e botão desativado até preencher; análise de denúncia;
confirmação de membro/ação/motivo; advertência e revisão com histórico; filtros inicialmente
off e alteração em memória; apresentação pública e suspensão em memória. O harness não
substitui teste do wrapper autenticado, de hierarquia, credenciais ou persistência.
Viewport 390×844: documento 375px úteis/375px de scroll, sem overflow horizontal.
Console da prévia sem erros durante os fluxos conferidos.

Capturas reais em `vo/outputs/`:

- [Denúncias](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3c-reports.png)
- [Advertência](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3c-warning.png)
- [Segurança](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3c-security.png)
- [Plataforma](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3c-platform.png)
- [Layout estreito](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3c-mobile.png)

## 6. Arquivos e evidências

Novos: migration; `types/community-moderation.ts`, `lib/community-moderation.ts`,
`services/community-moderation.ts`; `CommunityModerationConsole`, `CommunityReportButton`,
`CommunitySafetyTools`, `ModerationViews`; testes SQL/Node, harness e documentação.
Estendidos: SettingsDialog (seção lazy), CommunityWorkspace/Home/EventList/Events, Explorar/
apresentação (pontos de denúncia e entrada oficial), ChatView/MessageItem/Composer (denúncia
e feedback de bloqueio), integração de props em app.tsx, tipos Supabase, auditoria e runner.
Sem modificação de provedores de chamadas, captura, sinalização, hotbar ou Central Social.

Logs em `vo/work/`: `community-3c-tests.log`, `community-3c-db.log`,
`community-3c-typecheck.log`, `community-3c-lint.log`, `community-3c-security.log`,
`community-3c-web.log`, `community-3c-desktop.log`, `community-3c-web-default.log`,
`community-3c-preview.log`. Builds usam loopback e chave placeholder não operacional de
compilação; não utilizam credenciais de produção nem comprovam autenticação.

## 7. Pendências antes de publicação

- Autenticação HTTP real, troca de conta/servidor, duas sessões WEB/EXE, revogação ao vivo,
  CSP, reconexão, notificações e chamadas/compartilhamento com clientes reais.
- Política operacional de identidades oficiais, revisão independente, monitoração do worker
  de retenção, controle de tráfego inválido/distribuído e eventual processo de recurso.
- Links usam regras locais explícitas, não resolvem redirecionadores/URLs encurtadas,
  links sem protocolo ou reputação global. Ajustar limites para evitar falsos positivos.
- Não houve benchmark em grande volume ou medição de CPU/GPU. Índices e páginas limitadas
  não são uma comprovação de desempenho em computadores fracos.
- Ações de banir/expulsar herdam a política de retirada de membros/onboarding existente.
  Screening de texto da Fase 2 permanece; não foi criado bloqueio novo em voz/mídia.
- Imagens públicas externas mantêm os riscos de IP/host descritos na 3B. Nenhum downloader
  de anexos ou scanner de arquivos privados foi introduzido.

Versão estável **0.1.58 preservada**. Nenhuma recomendação de liberação automática decorre
destes testes locais. Próximo passo: avaliação do usuário; não iniciar a Fase 4.
