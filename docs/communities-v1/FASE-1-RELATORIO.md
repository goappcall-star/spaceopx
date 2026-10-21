# Comunidades LobbyX V1 — entrega local da Fase 1

Data: 21/10/2026. Branch: `codex/communities-v1`.
Plano aprovado pelo usuário: implementar somente a Fase 1 local.
Base estável Desktop: `ea18a949404b27ea543605b9366ba56854c86fb9` (0.1.58).
Plano auditado: `8ef89f4e6c049a50055eb0c645105922e0e501ab`.

## Resultado e limites do escopo

Fundação implementada com configuração adicional no mesmo servidor, assistente
de seis etapas, autorização explícita por cargo, edição, desativação e reativação.
Nada foi publicado, enviado ao GitHub, distribuído como EXE ou aplicado no banco
de produção. Versão e atualização automática permanecem na entrega anterior.
Nenhum dado real de usuário foi usado nos testes de escrita.

O recurso fica **desligado por padrão**, controlado por
`VITE_COMMUNITIES_V1_ENABLED=true` no build local. O cliente sem essa variável não
mostra a seção nem consulta os RPCs novos. A migration não é aplicada por um build.
Não habilitar a variável contra produção antes de uma implantação autorizada.

Não foram implementados eventos, diretório público, onboarding obrigatório,
estatísticas, recompensas ou progressão coletiva das fases seguintes. O Progression
V1 arquivado não foi restaurado. Não existem abas com métricas ou ações fictícias.

## Modelo e contratos

Migration preparada: `20261021010000_server_community_foundation.sql`.

- `server_community_settings`: extensão 1:1 por `servers.id`, sem recriar servidor.
- Regras com UUID estável, revisão própria, categoria e interesses limitados.
- Canal de boas-vindas existente e elegível; não há criação automática de canais.
- Revisão da configuração impede sobrescrever alterações concorrentes.
- Metadados administrativos de autoria ficam fora da projeção dos membros.
- Índice da chave primária e índice parcial do canal de boas-vindas; nenhum
  carregamento global de regras ou nova lista de membros sem paginação.

RPCs: `can_manage_community`, `get_server_community`, `save_server_community`,
`disable_server_community` e `set_community_role_permission`.
Salvar ativa ou atualiza; revisão 0 representa primeira ativação.
Uma revisão obsoleta recebe `40001 community_revision_conflict`.
Repetição com a revisão atual e conteúdo igual não duplica auditoria ou dados.
O orçamento de frequência ainda é consumido em chamadas repetidas.

A migração tem transação, `lock_timeout` de 5s e `statement_timeout` de 30s.
Interrompe se encontrar uma concessão prévia de `manage_community=true`, exigindo
revisão manual em vez de herdar acesso inesperado.

## Autorização e preservação

Proprietário é determinado por `servers.owner_id`. Administrador e gerenciador
de servidor não recebem capacidade comunitária automaticamente. Delegação exige
chave JSON booleana explícita, associação ao mesmo servidor e ausência de banimento.
Somente o proprietário pode conceder/revogar a chave por RPC dedicada ou atribuir
um cargo com essa capacidade. Inserções e atualizações diretas são protegidas.
Remoção de cargo, saída, banimento e cascatas continuam seguindo as regras atuais.

Refinamento do plano: MEMBER é inelegível, pois os convites o atribuem automaticamente.
Isso evita conceder gestão a novos convidados ou impedir seu ingresso. OWNER usa
a propriedade real. A confirmação informa o alcance e começa desmarcada.

RLS impede leitura por não membros e escrita direta por clientes. Membros comuns
leem somente configuração ativa; gestores também leem a configuração desativada.
As mutações revalidam autorização depois de adquirir o lock do servidor e auditam
na mesma transação. Falha da auditoria desfaz a operação inteira.
Locks seguem servidor antes de cargo; mudança de permissão usa trigger invoker
que verifica a identidade confiável da RPC, sem confiar em flags enviadas pelo cliente.

Ativar/desativar preserva IDs, canais, mensagens, membros, cargos, convites, XP,
badges, privacidade e identidade visual. Nenhuma ativação torna o servidor público.
A exclusão existente do servidor continua nas demais opções, separada da
desativação não destrutiva. Se o canal escolhido for removido, a referência fica
nula e a interface pede novo canal no próximo salvamento.

## Interface e integração

Nova seção Comunidade nas configurações existentes, carregada sob demanda:
apresentação, regras, boas-vindas, segurança, identidade e revisão explícita.
Reutiliza logo, tema, componentes React e perfil atual. Usuário sem autorização
não recebe ações administrativas. Perfil só pode ser editado com sua permissão
existente, independente da nova delegação comunitária.

Validação no cliente e no backend. Conflitos e erros de rede não geram sucesso
falso. Um erro de atualização em segundo plano preserva o rascunho e bloqueia
salvamento até revalidar. Cache inclui usuário e servidor; trocar de conta/servidor
recria o componente. A seção aberta atualiza a configuração a cada 15s e reutiliza
invalidações existentes, sem nova conexão Realtime ou alteração no provedor de voz.

## Validação executada

| Verificação                           | Resultado e alcance                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suíte automatizada Node               | **238 aprovados, 0 falhas**, incluindo 6 testes novos de validação/projeção/permissões                                                                                  |
| TypeScript                            | `npm run typecheck` aprovado                                                                                                                                            |
| ESLint dos arquivos alterados e novos | Aprovado, sem achados                                                                                                                                                   |
| ESLint geral                          | 55 erros e 51 avisos em arquivos preexistentes; não foi declarado aprovado nem alterado código fora do escopo para mascará-los                                          |
| Scanner de segurança                  | 629 arquivos examinados, sem achados                                                                                                                                    |
| WEB com recurso habilitado            | Build aprovado                                                                                                                                                          |
| Desktop com recurso habilitado        | Build aprovado, sem empacotar instalador ou executar atualização                                                                                                        |
| WEB com variável ausente              | Build aprovado, recurso desligado                                                                                                                                       |
| PostgreSQL local real                 | Migration incremental e suites SQL aprovadas, detalhes abaixo                                                                                                           |
| Navegador local                       | Assistente real renderizado com dados sintéticos; fluxo completo até callback de revisão; regra vazia, confirmação desmarcada e canal ausente bloqueiam avanço/ativação |
| Responsividade                        | Inspeção visual em viewport padrão e 390×844; etapas reorganizam em grade e conteúdo permanece acessível por rolagem                                                    |

Banco isolado em `127.0.0.1:55468`, diretório validado e marcado como exclusivo
de testes antes de qualquer criação. O runner remove variáveis PG herdadas, não
aceita URL remota e cria novo banco, preservando resultados sem reset ou DROP.
Último banco da execução: `lobbyx_community_test_1792562230654`.

Foram aplicadas todas as migrations reais sobre o bootstrap local e exercitados
usuários sintéticos com `SET ROLE authenticated`/identidade de teste: proprietário,
administrador sem delegação, gestor delegado, gestor de cargos, membro, banido,
não membro e anônimo. Cobertura de autorização cruzada, RLS, grants de colunas,
payload inválido, limites, revisão, preservação de dados/XP/badges, reativação,
revogação, convites reais pelos RPCs existentes e remoção de cargos privilegiados.

Quatro cenários em processos PostgreSQL concorrentes, com barreiras observadas:

1. Duas ativações: uma confirma, outra recebe conflito; nenhuma duplicação.
2. Revogação enquanto save aguarda: autorização revalidada e operação recusada.
3. Concessão durante autoatribuição de cargo: atribuição exige proprietário.
4. Associação iniciada antes da concessão: serializa sem deadlock na ordem inversa.

Teste adicional provoca falha de auditoria e confirma rollback da ativação e do
orçamento de escrita. Regressões SQL executadas: security-write-guards,
unread-counts, everyone-mentions, private-permission-invalidations e
performance-monitor-access.

Evidências externas ao repositório, no diretório `../` da worktree:
`community-unit-tests-final.log`, `community-db-tests-final.log`,
`community-typecheck-final.log`, `community-lint-changed.log`,
`community-lint-final.log`, `community-security-scan.log`,
`community-web-enabled-build.log`, `community-desktop-enabled-build.log` e
`community-web-default-build.log`. Prévia: `../../outputs/community-phase1-review.png`.

Durante o desenvolvimento foram corrigidos erros locais de sintaxe SQL,
expectativa de teste de RLS (UPDATE invisível afeta zero linhas), ordenação de
locks e codificação UTF-8 de um arquivo. As execuções finais acima são posteriores
às correções pertinentes; não houve tentativa de migração de produção.

## Limitações e pendências reais

O PostgreSQL local usa bootstrap de auth/storage e identidades sintéticas.
Não equivale a validar GoTrue, JWT via HTTP, PostgREST ou Realtime hospedado.
A prévia do assistente é isolada: renderiza o componente real, mas o callback final
somente mostra o payload; não prova integração autenticada ponta a ponta.
O banco e suas RPCs foram testados separadamente por SQL real.

Não foram executados clientes WEB/EXE autenticados simultâneos, chamadas de voz,
compartilhamento de tela ou notificações reais nesta entrega. Builds e regressões
automatizadas não substituem esses testes. Não houve medição de CPU/GPU ou teste
de escala com milhares de membros; a nova consulta é pontual por servidor e só
fica ativa na seção administrativa. A contagem de alcance mostra expressamente
somente os membros carregados, sem inventar totais globais.

Antes de publicação futura: validar integração em Supabase local/staging completo,
login real, revogação entre sessões, falha/reconexão de rede, alternância de contas,
servidores comuns/ativados e smoke test WEB/EXE de voz, mídia e notificações.
Obter autorizações próprias para produção, migration, publicação WEB e distribuição
Desktop. O aceite desta fase não autoriza nenhuma dessas operações.

## Execução local e reversão

1. Usar banco isolado; nunca apontar os testes à produção. O runner exige o runtime
   PostgreSQL em `PG_BINDIR` e o diretório marcado `../communities-pg-data`.
2. Subir esse PostgreSQL com o helper local `../start-communities-test-db.mjs`.
3. Executar `npm run test:community-db`. Dados sintéticos e bancos são retidos.
4. Para integração HTTP futura, provisionar ambiente Supabase de teste completo,
   aplicar a migration nele e fornecer somente suas credenciais públicas ao build.
5. Habilitar `VITE_COMMUNITIES_V1_ENABLED=true` apenas nesse ambiente; variável
   ausente ou diferente de `true` deixa a seção desligada.

Reversão funcional preferida: desativar pelo RPC, preservando toda a configuração;
desligar a flag oculta o recurso no cliente. Isso não remove uma migration aplicada
nem revoga automaticamente delegações existentes. Se necessário, o proprietário
revoga cada delegação antes de desativar. Uma reversão física de schema eliminaria
a configuração nova e exige backup/decisão específica; não foi incluído comando
destrutivo automático. A versão anterior não depende da tabela nova.

## Arquivos principais

- `supabase/migrations/20261021010000_server_community_foundation.sql`
- `src/types/community.ts`, `src/lib/community-feature.ts`, `src/lib/community-validation.ts`
- `src/services/communities.ts`, `src/hooks/use-community.ts`
- `src/components/community/CommunityActivationWizard.tsx`
- `src/components/server-settings/SettingsCommunity.tsx`
- Integração: `ServerSettingsDialog.tsx`, `SettingsRoles.tsx`, `use-server-admin.ts`,
  `services/permissions.ts`, `services/server-admin.ts` e tipos Supabase.
- `scripts/test-community-db.mjs`, `tests/community-*.sql`,
  `tests/community-validation.test.mjs` e script npm correspondente.

Não há alterações nos provedores de chamadas, captura, player, mensagens ou XP.
