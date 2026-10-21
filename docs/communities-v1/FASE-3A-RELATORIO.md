# Comunidades V1 — 3A: Eventos, entrega local

Data: 21/10/2026. Branch `codex/communities-v1`.
Base preservada: `9d35d25` (código funcional anterior: `f08c38b`).

**Somente a 3A foi implementada.** Descoberta (3B) e moderação (3C) não foram
iniciadas. A próxima subfase aguarda avaliação do usuário. Nenhuma publicação,
push, migration remota ou atualização automática foi realizada.

## 1. Funcionalidades concluídas

- Criar, editar e cancelar eventos com título, descrição, capa HTTPS opcional,
  canal de voz/texto/avisos associado, início obrigatório e fim opcional.
- Horário persistido como instante `timestamptz`, acompanhado do fuso IANA.
  O editor interpreta a hora no fuso escolhido, independentemente do fuso da
  máquina. Horário inexistente é recusado; horário repetido exige escolher a
  ocorrência, sem selecionar silenciosamente um dos instantes.
- Eventos próximos e em andamento na Home; listas de passados e cancelados.
  Paginação por `(starts_at,id)`, 12 registros na UI e teto de 30 por RPC.
- “Tenho interesse”, “Vou participar” e retirada de confirmação. Um único
  estado por vínculo de membro/evento; editar a resposta não duplica pessoas.
- Contagens reais, calculadas no banco, sem expor lista de participantes.
- Gestão pelo proprietário ou cargo **expressamente delegado para comunidade**.
  Administrador sem essa delegação não recebe gestão de eventos automaticamente.
  Não foi criado um segundo sistema de cargos ou administração.
- Revisões esperadas para editar/cancelar/responder; conflito explícito diante
  de alteração de outra sessão. Criação com UUID estável permite repetir a mesma
  requisição sem duplicar o evento; colisão entre servidores não sobrescreve dados.
- Auditoria existente registra criação, edição e cancelamento. Cancelar mantém
  o evento e as confirmações; não usa DELETE para remover histórico.
- O módulo continua acessível na área de boas-vindas quando a Home é desativada.
  Navegação lateral e hotbar não foram redesenhadas. Abrir um canal pelo card não
  adiciona nova lógica de entrada automática em voz.

Capa é uma URL HTTPS opcional, sem credenciais; não há um novo uploader nem
ampliação das permissões atuais do Storage. Falha da imagem deixa o card utilizável.

## 2. Notificações e lembretes: alcance real

A infraestrutura anterior é específica de menções e depende de mensagem/canal.
Ela não foi usada para criar mensagens falsas ou menções como notificações de
evento. Foram reutilizados os padrões de toast, estado de não perturbe, navegação
e notificação do sistema, sem pedir permissão do sistema automaticamente.

Quem confirma interesse/participação pode ativar **explicitamente** avisos.
O padrão é desligado. O backend prepara alterações, cancelamentos e lembretes
nos 15 minutos anteriores ao início. Não há envio indiscriminado a todos os
membros quando um evento é criado. Retirar confirmação desliga avisos futuros.

As entregas ficam em `community_event_notifications`, com unicidade por evento,
vínculo de membro, revisão e tipo. O cliente lê a caixa e permite marcar como
lido. Usuários fora do canal, banidos, que saíram ou cuja comunidade está
desativada não recebem novas entregas visíveis. Não são armazenadas cópias de
conteúdo privado do evento nas notificações; a leitura revalida o evento atual.

**Limite deliberadamente exposto:** a rotina confiável
`dispatch_community_event_notifications` está implementada e testada no banco,
mas **nenhum agendamento automático/cron foi instalado**. O processamento depende
de um scheduler futuro chamar essa rotina. O navegador não fabrica entregas por
timer, e abrir a Home não é tratado como execução do scheduler.

A caixa é consultada a cada 20s com o app aberto, inclusive em segundo plano,
sujeita à limitação de timers do navegador. Toasts são limitados a três por lote
e deduplicados durante a sessão. Notificação do sistema só é tentada quando já
há permissão e o documento está oculto. O estado de não perturbe é respeitado.
Avisos não lidos continuam na caixa; reabrir outra sessão pode apresentá-los
novamente. A deduplicação garantida pelo banco é dos registros de entrega, não
uma promessa de toast único em todos os dispositivos.

Portanto, **lembrete com app fechado, entrega pelo sistema operacional e operação
contínua de scheduler não estão validados**. A interface informa essa condição
local em vez de prometer entrega. O procedimento está em `EVENTOS-WORKER.md`.

## 3. Migration e contratos

Migration incremental preparada e aplicada **apenas ao PostgreSQL isolado de testes**:
`20261021030000_community_events.sql`.

Tabelas:

- `community_events`: mesmo `server_id`, canal existente, estado e revisão,
  instantes/fuso e autoria administrativa separada da projeção de membros.
- `community_event_rsvps`: PK `(event_id,member_id)`, escolha, opt-in e cursores
  de entrega; FK ao vínculo existente, sem criar um cadastro paralelo de usuário.
- `community_event_notifications`: caixa persistida, unicidade de entrega e leitura.

Índices para listagem, FK de canal, contagens, escolhas por membro, processamento
de assinaturas ativas e caixa. Sem alteração em tabelas de mensagens, voz, XP,
onboarding ou dados de servidores existentes.

RPCs autenticadas: `can_view_community_event`, `list_community_events`,
`save_community_event`, `cancel_community_event`, `respond_community_event`,
`list_my_community_event_notifications`, `read_community_event_notifications`.
Processamento: `dispatch_community_event_notifications`, somente owner confiável
do banco/service_role, sem EXECUTE de anon/authenticated.

Escritas diretas de clientes são revogadas. RLS limita eventos ao membro atual,
comunidade ativa e acesso ao canal; RSVP e caixa são próprios. Autoria administrativa
não está no SELECT público de colunas nem na projeção dos RPCs. Não existe
listagem anônima ou diretório público de eventos nesta entrega.

Canal de outro servidor ou sem acesso é recusado. Se o canal for removido, a FK
fica nula e o evento não passa a ser público para membros comuns; gestores podem
revisar a referência indisponível. Remoção/banimento e permissões atuais são
rechecados no backend. A autorização é conferida novamente depois do lock.

Títulos/textos, campos exatos do payload, limites, caracteres de controle,
URL HTTPS, fuso existente, instantes com offset, fim posterior ao início e datas
finitas são validados. Novo evento/novo início precisam estar no futuro. A edição
de informações sem alterar o instante inicial continua possível para evento já
iniciado, sem deslocar silenciosamente o horário.

Limites de frequência por usuário: salvar 20/min, cancelar 10/min, responder
30/min e marcar lido 60/min. A rotina confiável processa no máximo 500 assinaturas
por chamada (padrão 100). São limites de proteção de escrita, não capacidade
inventada de participantes ou contagens exibidas.

Locks e revisão protegem transações e idempotência. Auditoria e evento são
atômicos: falha ao auditar desfaz a criação. O worker usa locks e unicidade para
duas execuções concorrentes não criarem a mesma notificação duas vezes.

## 4. Testes executados

| Verificação                        | Resultado / alcance                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Suíte Node existente + eventos     | **245 aprovados, 0 falhas**, sendo quatro novos testes de eventos                                |
| TypeScript                         | Aprovado                                                                                         |
| ESLint de arquivos novos/alterados | Aprovado                                                                                         |
| Scanner de segurança               | Sem achados; total no log final                                                                  |
| WEB com flag ligada                | Build aprovado, teste de compilação                                                              |
| Desktop com flag ligada            | Build aprovado, sem empacotar/distribuir instalador                                              |
| WEB com flag ausente               | Build aprovado, recurso desligado                                                                |
| PostgreSQL local real              | Todas as migrations, suítes anteriores e suíte de eventos aprovadas                              |
| UI funcional no navegador          | Componentes reais operados com callbacks em memória e dados fictícios identificados              |
| HTTP/Auth/Realtime/WEB↔EXE reais   | Não executados nesta 3A; não exigidos como condição para desenvolvimento local pelo pedido atual |

Banco isolado em `127.0.0.1:55468`, com diretório/marcador conferidos pelo runner.
Cada execução cria banco novo e conserva os resultados, sem reset/DROP ou dados
reais. Último banco completo: `lobbyx_community_test_1792591252637`.

O bootstrap local emula schemas/identidade SQL para testar PostgreSQL/RLS. Ele
não é GoTrue nem substitui autenticação HTTP. Docker, CLI de stack e o laboratório
Supabase preparado anteriormente **não foram utilizados ou exigidos** nesta entrega.

Cobertura SQL de eventos:

- Ativo versus servidor comum/desativado; proprietário, delegado, administrador
  sem delegação, membro, outro servidor e banido.
- Criação/repetição/edição/cancelamento, datas/fuso/capa inválidos e canal cruzado.
- Conflito de revisão, retirada de poder e acesso ao canal revogado.
- Escrita direta negada; coluna privada de autoria protegida; RSVP de outro
  membro invisível; evento/canal removido não vira divulgação pública.
- Interesse alterado para participação sem duplicar contagem; histórico de
  confirmações preservado ao cancelar; IDs e dados anteriores/XP preservados.
- Notificação opt-in/opt-out, atualização, lembrete devido, cancelamento,
  leitura da caixa e processamento repetido sem duplicação.
- Paginação limitada com empate no horário sem repetir registros entre páginas.
- Falha sintética da auditoria desfaz a criação inteira.

Concorrência em processos PostgreSQL separados, com barreiras observadas:

1. Cinco cenários anteriores da fundação/onboarding continuaram aprovados.
2. Colisão de UUID em servidores diferentes: preserva o primeiro, recusa o segundo.
3. Dois editores do mesmo evento: um confirma, outro recebe conflito.
4. Edição aguardando revogação de gestão: rechecagem recusa o gestor revogado.
5. Dois workers: exatamente um registro de notificação para o participante opt-in.

Os testes Node cobrem fuso independente da máquina, data inválida, horário de
verão inexistente/repetido, capa insegura, fim inválido, texto excessivo,
identidade de servidor, contadores inválidos e resposta de notificação malformada.

As regressões SQL de mensagens/menções, contagens não lidas, guards, invalidação
de permissão e Performance Monitor também passaram. A suíte Node contém testes
anteriores de voz/mídia, mas isso não é validação de chamada entre clientes reais.

## 5. Interface e capturas reais

Componentes reais `CommunityHome`, `CommunityEventList` e `CommunityEventEditor`
foram montados na prévia local. O aviso visível identifica servidor/usuário
fictícios e callbacks em memória, sem chamadas Supabase.

Conferido: vazio honesto, criação com fuso, gravação em memória, confirmação de
um único usuário fictício, edição preservando horário, cancelamento no harness
e card de cancelado preservado. O cancelamento da aplicação tem diálogo próprio;
o harness usa callback direto e não foi tratado como teste autenticado desse diálogo.

O editor de horário repetido exibiu as duas ocorrências UTC de
`2026-11-01 01:30 America/New_York` e manteve Salvar desativado até a escolha.
Campos datetime foram exercitados também por teclado nativo; o preenchimento
automatizado isolado de datetime não disparou a alteração React até a interação
de teclado, sem ser confundido com falha do backend.

Layouts conferidos em largura Desktop 1280×800, largura inicial estreita e
390×844. Documento de 390px sem overflow horizontal. Console da prévia sem erros
durante os fluxos conferidos. Estados de rede/revogação autenticados permanecem
pendentes, apesar dos contratos correspondentes passarem no SQL.

Capturas em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/`:

- [Home final, captura direta do navegador](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-final.png)
- [Editor final, captura direta do navegador](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-final-editor.png)

As duas capturas finais foram conferidas visualmente. Capturas anteriores abaixo tiveram redimensionamento pelo provedor e podem perder nitidez; a captura auxiliar `community-3a-narrow.png` ficou incompleta e não serve como evidência visual.

- [Lista e participação](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-events.png)
- [Editor](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-editor.png)
- [Escolha de horário repetido](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-dst.png)
- [Cancelado](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-cancelled.png)
- [Tela estreita](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-mobile.png)
- [Vazio inicial](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-3a-empty.png)

Para abrir a prévia funcional novamente, na raiz desta worktree execute
`npm run preview:community-events` e abra `http://127.0.0.1:5208/`.
O harness versionado está em `tests/community-events-preview/`; não requer Docker,
credenciais ou backend. Ele sempre começa vazio e perde os dados ao recarregar.
Sua configuração não carrega o prefixo VITE de ambiente do aplicativo.

Essas capturas são evidência visual dos componentes; **não** são sessões reais
WEB/EXE autenticadas, persistência HTTP ou notificação do sistema operacional.

## 6. Arquivos e evidências técnicas

Novos: migration de eventos; `types/community-events.ts`,
`lib/community-events.ts`, `services/community-events.ts`,
`hooks/use-community-events.ts`, `hooks/use-community-event-notifications.ts`,
componentes `CommunityEventEditor.tsx`, `CommunityEventList.tsx`,
`CommunityEvents.tsx`, testes SQL/Node, harness `tests/community-events-preview/`, este relatório e `EVENTOS-WORKER.md`.

Estendidos: `CommunityHome.tsx` (slot do módulo), `CommunityWorkspace.tsx`
(integração), `routes/_authenticated/app.tsx` (consumo de avisos), tipos Supabase,
rótulos de auditoria, runner SQL e script npm da prévia. Nenhuma alteração em providers de chamadas,
captura, sinalização, mensagens, banco de servidores ou versão do aplicativo.

Logs locais em `vo/work/`:
`community-3a-tests.log`, `community-3a-db.log`, `community-3a-typecheck.log`,
`community-3a-lint.log`, `community-3a-security.log`, `community-3a-web.log`,
`community-3a-desktop.log`, `community-3a-web-default.log`,
`community-3a-preview.log` e `community-3a-preview-versioned.log`.

Os builds finais usam URL loopback e uma chave pública **placeholder não
operacional somente de compilação**, sem credenciais de produção e sem alegar
login real. A prévia usa componentes puros, sem configuração Supabase. Não há
instalador, deploy ou ambiente remoto criado a partir desses artefatos.

## 7. Limitações e próximos passos

- Não foram executadas autenticação HTTP, sessões reais WEB/EXE, entrega de push,
  reconexão real de rede ou chamada/compartilhamento com clientes reais nesta 3A.
- Scheduler precisa ser configurado/operado em ambiente autorizado para entrega
  contínua. Intervalo, disponibilidade, recuperação e notificações de sistema
  precisam de validação antes de prometer lembretes confiáveis em produção.
- Uma notificação antiga pode permanecer não lida e ser apresentada ao reabrir;
  não há política de expiração/limpeza automática criada nesta etapa.
- Não há RSVP recorrente, evento em série, limite de vagas, anexos, calendário
  externo ou descoberta pública. Não foram simulados como disponíveis.
- A compatibilidade CSP/TLS/perfil Desktop com backend local real continua sendo
  a pendência descrita na validação anterior; não houve enfraquecimento de segurança.
- Não foram medidos CPU/GPU nem carga com milhares de confirmações; consultas,
  contagens e processamento são limitados/indexados, mas isso não é um benchmark.

A mesma flag `VITE_COMMUNITIES_V1_ENABLED` continua desligada por padrão. Reversão
funcional consiste em desligar a interface e suspender a rotina de entrega;
desativar a comunidade também torna eventos/avisos indisponíveis. Não há script
destrutivo que apague eventos ou confirmações. Nenhum cron foi criado para remover.

Próximo passo deste trabalho: **aguardar avaliação da 3A**. A 3B não foi iniciada
e nenhuma aprovação de publicação é inferida desta entrega local.
