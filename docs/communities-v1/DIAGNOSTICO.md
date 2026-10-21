# Comunidades LobbyX V1 — diagnóstico técnico

Data: 21/10/2026. Base estável: Desktop 0.1.58, commit
`ea18a949404b27ea543605b9366ba56854c86fb9`; candidato WEB correspondente
`dc5e16dc30646dc8388c0cc6031f481aab449305`.

Estado desta entrega: auditoria e plano, aguardando validação do proprietário.
Nenhuma implementação funcional, migration, publicação ou alteração de dados
reais foi realizada nesta tarefa. Branch local: `codex/communities-v1`.

## 1. Escopo e método

A especificação completa foi considerada, incluindo a continuação dos itens 9–15.
Ela determina apresentar diagnóstico/plano antes de alterações extensas e,
**depois de validar o plano**, implementar apenas a Fase 1 localmente.

Foram examinados os componentes, serviços, hooks, tipos, migrations e testes do
projeto existente. Também houve consulta ao catálogo real do Supabase atual,
projeto `lnupoqtaeawwggbwgbuv`, usando `BEGIN READ ONLY`,
`default_transaction_read_only=on` e timeout de consulta. Foram lidos apenas
metadados: tabelas, colunas, políticas, índices, funções, triggers e configuração
dos buckets relevantes. Não foram consultadas mensagens, credenciais, perfis,
listas de membros, objetos de Storage ou conteúdo privado de usuários.

Evidências locais, fora do código distribuído:

- `work/communities-v1-audit/production-metadata.json`;
- `work/communities-v1-audit/guard-metadata.json`;
- scripts `work/communities-audit-production.mjs` e
  `work/communities-audit-guards.mjs`.

O retorno confirmou `transaction_read_only=on`. Todas as tabelas relevantes
encontradas têm RLS habilitada; foram examinadas 33 políticas desse subconjunto.
Isso confirma a existência das proteções, mas não substitui testes adversariais
dos novos fluxos que serão criados na Fase 1.

## 2. Arquitetura atual e reaproveitamento

| Área                   | Implementação existente                                                                                         | Decisão proposta                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| WEB                    | React, TypeScript, TanStack Router/Query, Tailwind e componentes Radix                                          | Manter projeto, rotas e componentes; adicionar módulos de comunidade                              |
| Desktop                | `desktop/build.mjs` empacota o mesmo renderer em `desktop/web`; Electron usa o protocolo `lobbyx://`            | Mesmo código React e mesmos contratos Supabase para WEB/EXE; sem novo processo de mídia           |
| Servidores             | `servers`, `serversService`, criação transacional por `create_server`                                           | Comunidade será uma configuração 1:1 do servidor atual; não executar `create_server` na conversão |
| Canais/categorias      | `channels`, `server_categories`, serviços e `ChannelSidebar`                                                    | Selecionar canais existentes; não duplicar canais nem categorias                                  |
| Membros/cargos         | `server_members`, `roles`, `member_roles`                                                                       | Preservar IDs, vínculos, hierarquia e permissões atuais                                           |
| Convites               | `server_invites`, `create_server_invite`, `get_invite_preview`, `join_server_by_invite`                         | Reutilizar códigos, expiração, usos e banimentos; não revogar/recriar convites na conversão       |
| Configurações          | `ServerSettingsDialog` com Perfil, Acesso, Membros, Cargos, Convites, Banimentos e Auditoria                    | Adicionar a seção Comunidade; reutilizar telas administrativas existentes                         |
| Identidade visual      | Logo oficial, temas, cores do usuário, `SettingsProfile`, `serverImagesService`, `server-assets`                | Reutilizar identidade, uploads e validações; preservar Modo Desempenho                            |
| Moderação              | Expulsão, banimentos, restrições/movimentação de voz, `audit_logs` e RPCs administrativos                       | Evoluir com denúncias/advertências posteriormente; não duplicar essas ações                       |
| Segurança              | RLS, `has_server_permission`, `has_channel_permission`, guards de identidade, validação e orçamento de escritas | Reutilizar fronteiras; criar validação específica das novas operações no banco                    |
| Presença/voz           | Provedores atuais de voz e chamadas privadas/grupos; Realtime; ocupação observada por contexto                  | Somente leitura de estados autorizados; não modificar sinalização, mídia ou hotbar                |
| Mensagens/notificações | Chat existente, @todos/menções, leituras persistentes e invalidação de permissões                               | Manter comportamento; futura integração de eventos precisará de contrato próprio de notificações  |
| Progressão ativa       | `user_xp`, `badges`, `user_badges`, `progressionService`, `XpBar` e perfis                                      | Preservar XP, níveis, fórmula e concessões existentes                                             |

Referências principais no código: `src/routes/_authenticated/app.tsx`,
`src/components/server-settings/*`, `src/services/{servers,channels,categories,
roles,members,invites,server-admin,permissions,gamer}.ts`,
`src/hooks/{use-servers,use-server-admin,use-gamer}.ts`,
`src/lib/permissions.ts` e `src/types/index.ts`.

## 3. Banco real: fatos e limites

- `servers` contém proprietário, nome, descrição, ícone, banner, `visibility` e
  `interactions`; não existe configuração de comunidade.
- `servers_select_members` exige associação ao servidor mesmo quando
  `visibility='public'`. O valor Público atual não constitui consentimento
  suficiente para a nova descoberta. Não ampliar essa política.
- Canais e categorias permanecem vinculados ao mesmo `server_id`. Os checks
  atuais de canal usam o servidor e os cargos; não há um sistema completo de
  overrides independentes por canal/categoria identificado nessa arquitetura.
  A implementação não deve presumir que essas estruturas existem.
- `has_server_permission` permite proprietário, administrador ou cargo com a
  chave solicitada. Portanto, reutilizá-la sem ressalvas para uma nova
  `manage_community` concederia implicitamente o poder aos administradores.
- Existem proteção do cargo proprietário e integridade contra associações de
  cargos entre servidores. Gerentes de cargos/membros ainda podem administrar
  cargos comuns; a nova delegação precisa impedir autoconcessão do poder de
  comunidade por esses caminhos.
- `security_private.write_windows` já implementa limites de frequência. Reusar
  o mecanismo com ações próprias, sem dar acesso direto ao cliente.
- Auditoria administrativa já existe e está protegida por `view_audit_log`.
  Comunidade terá novos tipos de ação nessa estrutura, sem uma segunda auditoria
  paralela e sem expor detalhes a membros comuns.
- O ingresso por convite valida autenticação, banimento, expiração, usos e
  associação anterior, em transação. Cria apenas o vínculo de membro e o cargo
  MEMBER. O futuro onboarding obrigatório deverá cobrir esse ingresso e qualquer
  outro caminho de associação no backend.
- Não foram encontradas tabelas de comunidades, eventos, denúncias, advertências,
  temporadas, missões ou conquistas da implementação de progressão arquivada.
- O bucket `server-assets` é privado, com limite de 8 MB e MIME de imagens.
  Ícones/banners são apresentados por URLs assinadas. Essas URLs não devem ser
  copiadas automaticamente para a descoberta pública.
- O XP atual é concedido por triggers: 5 XP por mensagem e 50 XP por servidor
  criado. `award_xp` não é executável por `authenticated`. A conversão não pode
  recriar servidor nem disparar recompensa de criação ou inventar atividade.

## 4. Progressão preparada e incompatibilidades

Existe o arquivo preservado
`archives/lobbyx-progression-v1-20261008`, incluindo código, migration, relatório,
patch e evidências locais. Ele está identificado como **arquivado/não publicar**
e não foi aplicado ao banco atual.

O relatório e os contratos foram examinados como referência. Esse sistema
preparado inclui níveis permanentes, temporadas/ranks, missões, conquistas,
inventário e concessões idempotentes. Também altera a curva de XP e substitui
recompensas atuais de mensagens/servidores. Aplicá-lo automaticamente agora
substituiria comportamentos ativos e restauraria patches sobre uma base antiga.

Proposta: não restaurar o patch ou migration arquivados nesta tarefa. Preservar
o sistema ativo; na Fase 4, reutilizar conceitos/contratos e testes compatíveis
por um adaptador, com uma decisão explícita sobre eventual retomada da progressão
individual preparada. Não apresentar ranks/temporadas arquivados como recursos
já disponíveis em produção.

Separação prevista:

| Conceito                     | Fonte/estado                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| Nível permanente do usuário  | `user_xp` ativo, sem rebalanceamento nesta tarefa                   |
| Rank de temporada            | Preparado no arquivo; integração indisponível até decisão posterior |
| Nível coletivo da comunidade | Novo domínio na Fase 4, separado do XP individual                   |
| Impulsos temporários         | Estrutura futura com vigência; não altera o nível permanente        |

Presença não comprova participação em áudio. XP automático por tempo em chamada
permanecerá desativado, inclusive para missões/conquistas e XP coletivo. Nenhuma
duração, lista de peers, `connected` ou estatística enviada pelo renderer será
aceita como prova. Não criar SFU ou reescrever chamadas para resolver isso aqui.

## 5. Riscos e decisões necessárias

| Risco                                                             | Tratamento no plano                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Converter criando outro servidor dispara duplicação e bônus de XP | Configuração 1:1 pelo ID atual, operação transacional e idempotente                                                        |
| Administrador ganha capacidade nova por herança genérica          | Nova capacidade explícita, sem concessão automática a ADMIN/administrator                                                  |
| Gerente de cargos concede o novo poder a si mesmo                 | Guard no banco para conceder a chave e associar cargos portadores; proprietário controla a expansão da autorização         |
| Cliente escreve configuração diretamente ou troca IDs             | RLS, ausência de grants de escrita direta, RPC com identidade derivada de `auth.uid()`, FKs e guards                       |
| Ativação publica conteúdo privado                                 | Descoberta separada e desligada; nenhuma alteração de `visibility` ou RLS existente                                        |
| URL assinada privada aparece no diretório                         | Futuro fluxo explícito de assets públicos e projeção curada                                                                |
| Fase 1 promete aceite obrigatório sem enforcement                 | Aceite obrigatório e cargos escolhíveis só serão habilitados com o backend completo de onboarding, na Fase 2               |
| Clientes .58 antigos encontram schema novo                        | Alteração aditiva; servidores e RPCs antigos continuam funcionando; feature flag protege o novo cliente antes da migration |
| Dois administradores salvam/ativam ao mesmo tempo                 | Lock por servidor, controle de revisão, erro de conflito e auditoria consistente                                           |
| Reversão perde configurações                                      | Desativar comunidade preserva sua configuração; rollback do app não exige DROP/TRUNCATE/DELETE                             |
| Estatísticas fabricam crescimento histórico                       | Só mostrar dados medidos; indicar desde quando há histórico e evitar reconstruções sem evidência                           |
| Eventos e denúncias expõem canais/membros privados                | Políticas específicas por canal/servidor; páginas públicas não consultam tabelas privadas                                  |
| Reinserir progressão arquivada muda níveis/recompensas            | Não restaurar automaticamente; integração posterior separada e sem inventar concessões                                     |

## 6. Resultado e próximo passo

Há base suficiente para implementar a Fase 1 de forma aditiva e isolada. Não é
necessário um novo projeto, refazer o sistema de servidores, mudar a mídia ou
duplicar convites, membros e cargos.

O modelo, as etapas, os arquivos afetados e os critérios de aceite constam em
`PLANO-DE-IMPLEMENTACAO.md`. A implementação funcional aguarda a validação desse
plano, conforme o item 15 da solicitação. Não há autorização para migrations de
produção, push/publicação, release ou atualização automática nesta tarefa.
