# Comunidades LobbyX V1 — plano de implementação para validação

Base: 0.1.58. Desenvolvimento local na branch `codex/communities-v1`.
Este plano não é uma autorização de publicação ou de alteração no Supabase de
produção. O diagnóstico real da arquitetura está em `DIAGNOSTICO.md`.

## 1. Decisões propostas

1. Uma comunidade é o mesmo servidor com uma configuração adicional. Não recebe
   outro ID nem outra lista de membros, cargos, mensagens ou convites.
2. Ativar não muda o servidor para Público e não o inclui na descoberta.
3. Proprietário sempre pode administrar; outros membros precisam de um cargo
   expressamente autorizado. Nenhum cargo atual recebe essa capacidade sozinho.
4. Desativar restaura o comportamento de servidor comum e mantém a configuração
   para futura reativação. Nenhum conteúdo existente é apagado.
5. Cada fase tem backend, interface, testes e critérios próprios. A próxima
   implementação, depois de validar este plano, será **somente a Fase 1 local**.
6. Progressão individual ativa, código arquivado, voz e modos de desempenho
   permanecem preservados. Não há bots, players ou nova arquitetura de mídia.

## 2. Modelo de dados proposto

### Fase 1: extensão 1:1 e contratos administrativos

Nova tabela `server_community_settings`, cuja chave primária e FK é
`server_id -> servers.id`. Ausência de linha equivale a servidor comum.

| Campo                          | Finalidade e proteção                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `server_id`                    | Mesmo UUID do servidor; imutável; chave 1:1                                      |
| `enabled`                      | Ativação da comunidade, false por padrão; escrita somente por RPC                |
| `rules`                        | Regras estruturadas com IDs estáveis e limites de quantidade/tamanho             |
| `rules_revision`               | Revisão das regras; incrementada no servidor quando seu conteúdo muda            |
| `welcome_channel_id`           | Canal existente de texto/avisos; validação de tipo, servidor e acesso no backend |
| `category_slug`                | Categoria temática validada; não confundir com categoria de canais               |
| `interests`                    | Lista limitada e normalizada de interesses, sem perfis comportamentais           |
| `revision`                     | Controle de concorrência de toda a configuração                                  |
| `activated_at`, `activated_by` | Metadados da ativação, definidos no banco                                        |
| `disabled_at`, `disabled_by`   | Metadados da desativação, sem apagar configuração                                |
| `created_at`, `updated_at`     | Timestamps do banco                                                              |

Nome, descrição, ícone e banner continuam em `servers`. A configuração não cria
uma segunda identidade de servidor. Na Fase 1, o assistente reutiliza esses
valores e encaminha a edição visual para os controles existentes. A etapa de
revisão explicita os valores preservados, sem sobrescrever metadados por uma
cópia desatualizada do wizard.

Não adicionar colunas em `servers` é intencional: o cliente antigo continua
compatível e os grants existentes de UPDATE não permitem contornar a conversão.
Haverá acesso específico à configuração, sem carregar regras de todos os
servidores a cada lista ou tick de presença.

Permissão nova: `manage_community` no JSON de permissões dos cargos existentes.
O helper de autorização comunitária verifica explicitamente essa chave,
associação ao servidor e ausência de banimento; `administrator` e `manage_server`
sozinhos não a substituem. O proprietário é validado por `servers.owner_id`,
nunca pelo nome do cargo.

Conceder/retirar a chave de capacidade de um cargo exige o proprietário.
Conceder uma nova associação a cargo que carrega essa capacidade também exige
o proprietário, inclusive em INSERT/UPDATE diretos na API. As regras existentes
de remoção/saída de membros não podem ser bloqueadas por esse guard; revogações
e cascatas existentes serão testadas. Não fazer backfill de permissões ou
associações, nem atribuir um cargo administrativo a ninguém.

Antes de delegar a um cargo, mostrar o alcance da concessão e alertar para cargos
amplos como MEMBER. A confirmação do proprietário não pode ocorrer por um
checkbox previamente marcado ou pela simples ativação da comunidade.

RPCs previstas, com contratos finais definidos junto aos testes SQL:

- leitura da configuração e da capacidade do usuário autenticado;
- ativação com payload completo e revisão esperada;
- atualização da configuração com revisão esperada;
- desativação preservando regras e configurações;
- delegação/revogação da capacidade pelo proprietário.

Todas as mutações derivam o ator de `auth.uid()`, bloqueiam o servidor relevante,
validam autorização e referências, respeitam limites de frequência e escrevem
na auditoria existente na mesma transação. Operações repetidas não criam canais,
linhas duplicadas, recompensas ou registros de ativação redundantes.

RLS e grants:

- `anon` sem acesso à configuração administrativa;
- membros podem ler a configuração pública interna de comunidade ativada;
- proprietário/gestores autorizados podem ler a configuração desativada;
- nenhum INSERT/UPDATE/DELETE direto para `authenticated`;
- funções `SECURITY DEFINER` com `search_path` fixo, grants mínimos e checks
  explícitos; helpers internos sem EXECUTE do cliente;
- chaves, timestamps e auditoria não são controlados pelo payload;
- sem alterações nas políticas atuais de canais, mensagens ou servidores.

Na Fase 1, dados internos de moderação não serão incluídos nessa linha legível
pelos membros. Campos administrativos sensíveis futuros terão armazenamento e
políticas próprios, em vez de confiar no frontend para escondê-los.

### Estruturas futuras, não incluídas na migration da Fase 1

| Fase | Estrutura proposta                                           | Reaproveitamento/limites                                                                                          |
| ---- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 2    | Revisões imutáveis de regras e `community_member_onboarding` | Referencia o mesmo servidor/membro; aceita apenas a revisão atual; cargos por allowlist validada no banco         |
| 2    | Configuração de etapas, interesses e atalhos                 | Reutiliza canais/cargos; não cria cópias e não atribui permissões privilegiadas                                   |
| 3    | `community_events` e `community_event_rsvps`                 | Timestamptz + fuso IANA, canal existente, RSVP único por usuário/evento, privacidade de participantes             |
| 3    | Projeção curada de descoberta e solicitações de entrada      | Apenas opt-in explícito, elegibilidade/moderação e consentimento vigentes; nunca SELECT público em `servers`      |
| 3    | `community_reports` e advertências                           | Novo conteúdo de moderação protegido; ações administrativas continuam em `audit_logs`                             |
| 3    | Notificações de eventos                                      | Entrega idempotente no backend, preferências e RLS por destinatário; não reutilizar uma menção como se fosse RSVP |
| 4    | Agregados diários de métricas e progresso coletivo           | Dados medidos, período explícito, sem copiar conteúdo de chat ou coletar áudio                                    |
| 4    | Catálogo de recompensas/impulsos e ledger de concessões      | Origem confiável e chave idempotente; separado de XP/rank individual; sem concessão arbitrária pelo cliente       |

Índices e paginação serão criados por necessidade real: PK/FKs da extensão na
Fase 1; nas fases seguintes, cursor por `(starts_at,id)` para eventos e por
`(created_at,id)` dentro do servidor para denúncias/atividade. Não usar polling
de todas as comunidades, contagens integrais por render ou páginas ilimitadas.

## 3. Fase 1 — Fundação: entrega local após validação

### Backend e proteção dos dados

Preparar migrations incrementais locais para a extensão, RPCs, RLS, guards de
delegação e auditoria. Nenhuma migration tocará dados de produção. Não inserir
comunidades a partir de todos os servidores existentes: padrão continua comum.

Conversão e reversão são transações sobre a configuração 1:1. Não executar
`create_server`, regenerar UUIDs, duplicar canais, trocar proprietário, atualizar
mensagens ou incrementar XP. Não alterar `visibility` ou permissões por ativar.

Rollback operacional: desligar o recurso ou desativar a comunidade. A extensão
pode permanecer no schema para preservar seus dados; não propor um “down” que
apague tabelas ou histórico. Schema rollback físico, se necessário, exige análise
separada e não será executado automaticamente.

### Interface mínima de conversão

`Configurações → Comunidade → Ativar Comunidade`, com seis passos:

1. Vantagens, preservação dos dados e privacidade.
2. Regras da comunidade.
3. Seleção de um canal existente de boas-vindas; sem criar outro por padrão.
4. Revisão das proteções existentes e da autoridade de gestão.
5. Categoria, interesses e identidade visual atual do servidor.
6. Resumo e ativação, com consentimento explícito para essa conversão.

Configurações que dependem de enforcement posterior não serão apresentadas como
proteções ativas. Exigir aceite obrigatório, oferecer cargos escolhíveis e
ativar descoberta só entram quando seus backends forem implementados nas fases
correspondentes. A Fase 1 não pode prometer bloquear mensagens por aceite antes
de cobrir todos os caminhos de ingresso e escrita.

Após ativar: mostrar estado, configurações, revisão e opção de desativar com
confirmação clara de preservação. Reativar recupera configuração existente.
Proprietário gerencia a concessão da nova capacidade a cargos; permissões são
revalidadas no backend em cada operação, inclusive com uma tela antiga aberta.

### Compatibilidade e rollout local

- Feature flag desligada por padrão nos builds normais; ligada apenas na prévia
  local com banco de testes migrado.
- Se o backend da comunidade não estiver disponível, não consultar tabelas novas
  ao listar servidores comuns e não interromper chat/login/voz.
- Erros de autorização/rede não podem ser tratados como sucesso ou ativação.
- Uma reversão para o cliente estável .58 continua lendo as tabelas atuais.
- Não gerar instalador distribuível, publicar WEB, fazer push, criar release,
  alterar canal de atualização ou aplicar SQL em produção.

### Testes obrigatórios da Fase 1

Banco PostgreSQL local isolado, conexão validada como loopback/banco de teste,
dados sintéticos e papéis equivalentes a anon/authenticated. Testar SQL/RLS
realmente, além de testes unitários de formulário/serviço; não apenas mocks.

| Cenário                                                             | Resultado exigido                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Proprietário ativa e desativa                                       | Sucesso, mesmo `server_id`, configuração preservada                                                                       |
| Cargo expressamente delegado                                        | Pode administrar somente seu servidor                                                                                     |
| ADMIN/administrator sem delegação específica                        | Não recebe a capacidade nova implicitamente                                                                               |
| Membro comum, não membro, anon ou banido                            | Ativação e leitura restrita negadas                                                                                       |
| Outro servidor/canal/cargo no payload                               | Rejeição, nenhuma escrita parcial                                                                                         |
| Chave nova por edição direta de cargo ou autoassociação             | Autoconcessão negada no banco                                                                                             |
| Delegação revogada com tela aberta                                  | Próxima operação negada; UI atualiza estado                                                                               |
| Saída/expulsão/remoção de cargo                                     | Fluxos atuais continuam funcionando; usuário perde o poder                                                                |
| Ativação repetida e duas ativações simultâneas                      | Sem duplicações; idempotência/conflito de revisão coerente                                                                |
| Falha durante a transação                                           | Nenhum estado parcialmente ativado ou auditoria enganosa                                                                  |
| Payload inválido, regra vazia/extensa, URL indevida, canal ausente  | Erros de validação, sem alterações                                                                                        |
| Canal de boas-vindas removido durante/depois da configuração        | Concorrência tratada e referência segura; sem impedir a gestão normal de canais, recriar canal ou manter um link inválido |
| Edição concorrente/revisão antiga                                   | Conflito explícito; não sobrescrever alteração de outro gestor                                                            |
| Repetição abusiva                                                   | Orçamento de escrita aplicado no servidor                                                                                 |
| Tentativa de escrita direta na configuração                         | Negada, ainda que a UI seja adulterada                                                                                    |
| Consulta pública ou usuário de outro servidor                       | Sem regras privadas, dados administrativos ou listagem nova                                                               |
| IDs, mensagens, canais, membros, cargos, convites e XP antes/depois | Preservados nas fixtures, exceto a nova configuração e auditoria esperadas                                                |
| Servidor privado e visibilidade                                     | Conversão não altera privacidade nem cria descoberta                                                                      |
| Cliente com feature flag desligada/backend ausente                  | Funcionalidades anteriores continuam disponíveis                                                                          |

Executar suite existente, typecheck, lint, security scan e builds WEB/Desktop.
Inspecionar wizard, erros, responsividade, tema e teclado na prévia. Smoke de
mensagens/notificações e entrada/saída de voz; áudio WEB/EXE só será declarado
validado se houver teste real entre clientes/contas. Ausência de credenciais ou
dispositivos será registrada como pendência, sem usar dados reais de terceiros.

### Arquivos afetados na Fase 1

| Novos                                                             | Papel                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `supabase/migrations/<timestamp>_server_community_foundation.sql` | Extensão 1:1, contratos RPC e RLS                          |
| Migration complementar de guard/delegação, se necessária          | Isolar a nova capacidade sem reescrever permissões antigas |
| `src/types/community.ts`                                          | Tipos da configuração, payload e erros                     |
| `src/lib/community-validation.ts`                                 | Validação compartilhada de formulário/contrato             |
| `src/services/communities.ts`                                     | Leitura e mutações autenticadas                            |
| `src/hooks/use-community.ts`                                      | Cache, capacidades e invalidação                           |
| `src/components/community/CommunityActivationWizard.tsx`          | Assistente de seis passos                                  |
| `src/components/server-settings/SettingsCommunity.tsx`            | Estado, edição, delegação e desativação                    |
| Testes SQL/TypeScript e fixtures de comunidade                    | Preservação, autorização, concorrência e regressão         |

| Existentes a estender                                                  | Limite da alteração                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ServerSettingsDialog.tsx`                                             | Entrada Comunidade, mantendo seções atuais                       |
| `SettingsRoles.tsx`, `services/permissions.ts` e `use-server-admin.ts` | Mostrar a capacidade nova sem herança genérica nem autoconcessão |
| `services/server-admin.ts`                                             | Rótulos das ações de auditoria novas                             |
| `integrations/supabase/types.ts`                                       | Tipos derivados do schema local validado                         |
| Configuração de feature flags                                          | Recurso desativado em builds normais                             |

Não há alteração planejada na Fase 1 em `MeshVoiceProvider`, `VoiceContext`,
providers de chamadas, captura de tela, hotbar, renderer de mensagens ou XP.

## 4. Fase 2 — Experiência: etapa posterior

Página inicial com banner/nome/ícone existentes, descrição, categoria, interesses,
estatísticas autorizadas, avisos, atalhos e compartilhamento por convites atuais.
Integrar a entrada “Início da comunidade” na lateral sem mudar a navegação dos
canais nem abrir a tela de chamada automaticamente.

Onboarding modular, com etapas desativáveis. Aceites vinculados à revisão das
regras, histórico mínimo, identificação do membro e lista de cargos elegíveis
controlada no backend. Não aceitar IDs arbitrários ou cargos com permissões de
administração/moderação por autoseleção. O backend deve cobrir todos os ingressos
e qualquer restrição de interação configurada, preservando o tratamento dos
membros anteriores. Não simular proteção apenas fechando um modal na UI.

Cards sem fonte disponível apresentam estado vazio honesto. Não inventar eventos,
atividade, ocupação ou presença. Contagens e salas respeitam permissões e o
alcance observado pelos provedores existentes.

Testes: onboarding opcional/obrigatório, versões de regras, cliente adulterado,
cargo de outro servidor/privilegiado, saídas/reentradas, rollback e navegação.

## 5. Fase 3 — Comunidade ativa: etapa posterior

- Eventos com fuso IANA, UTC no banco, capa, canal validado, criação/edição por
  capacidade, RSVP único, cancelamento e campo reservado para séries futuras.
- Lista de participantes apenas quando a política e o consentimento permitirem;
  contagens agregadas não autorizam revelar identidades. Notificações no backend,
  idempotentes, configuráveis e sem timers de entrega dependentes do cliente aberto.
- Descoberta com opt-in separado, revisão da apresentação pública, elegibilidade
  e controles de moderação. Remover opt-in/desativar comunidade retira a projeção
  pública. Nenhum membro, mensagem, presença, convite privado ou URL assinada
  entra nessa projeção. Ingresso por convite/solicitação respeita banimentos e
  onboarding; não conceder associação por aceitar apenas um estado local.
- Denúncias, advertências, revisão de conteúdo autorizado e ações existentes de
  expulsão/banimento, com quotas, autorização, paginação e auditoria.
- Moderação do diretório público não será atribuída a administradores de qualquer
  servidor, nem reaproveitará a whitelist do Performance Monitor. Um eventual
  papel global/serviço confiável dependerá de definição e autorização próprias.

Testes: DST/fusos, RSVP concorrente, cancelamento/reenvio, destinatários,
privacidade, opt-in/retirada, usuário banido, busca/cursor, denúncias abusivas e
isolamento de conteúdo administrativo entre servidores.

## 6. Fase 4 — Evolução: etapa posterior

Central da Comunidade com Visão geral, Personalização, Boas-vindas, Membros e
cargos, Eventos, Moderação, Estatísticas, Evolução, Descoberta e Configurações.
As abas serão entregues com a funcionalidade correspondente, sem ações simuladas
como se já funcionassem na Fase 1.

Métricas reais: membros atuais, adesões observadas no período, eventos, RSVPs e
participação comprovável. Crescimento líquido exige registrar saídas também;
não reconstruir períodos anteriores sem evidência. Agregados por dia/período,
sem armazenar mensagens, áudio ou telemetria pessoal desnecessária.

Progresso coletivo e catálogo de recompensas começam sem concessões inventadas.
Nível do usuário, rank de temporada, nível coletivo e impulso têm fontes e
ciclos distintos. Toda concessão futura exige origem verificável, idempotência
e autorização no backend. Sem XP de voz automático ou baseado em Presence;
sem recompensa por autodeclarar minutos; sem travar comunicação por nível.

Não aplicar o patch/migration da progressão arquivada. A retomada de temporadas,
missões e conquistas individuais precisa de decisão específica de integração,
pois o arquivo altera fórmula, bônus e outros comportamentos hoje ativos.

Testes: repetição/fraude de eventos, ausência de autoridade de voz, duplicação
de concessões, separação de saldos, expiração de impulso, acesso a recompensas,
períodos sem métricas e consultas paginadas com volume sintético representativo.

## 7. Entrega após aprovar este plano

Implementar localmente somente a Fase 1, produzir relatório com migrations
preparadas, contratos, testes executados/resultados, builds, evidências visuais,
limitações e pendências. Preservar um ponto de recuperação e backup do código.

Não executar fases 2–4, publicar WEB/EXE, criar release, habilitar atualização,
conceder administração global ou migrar produção sob a aprovação deste plano.
Essas operações exigem escopo e autorização posteriores.
