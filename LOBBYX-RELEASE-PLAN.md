# LobbyX — preparação de release

Auditoria de 10/10/2026, horário de São Paulo. **Estado: preparação local concluída; execução de produção NÃO autorizada.** Esta preparação não autoriza push, alterações de produção, concessões administrativas, deploy ou release. Referências obrigatórias: Performance Optimization V2, Performance Monitor V1.1 e `docs/NOTIFICACOES-NAO-LIDAS.md`.

## Estado verificado

| Item | Evidência de leitura/local | Situação |
| --- | --- | --- |
| Repositório | `goappcall-star/spaceopx`, branch `main`, HEAD `d33f2021dfe0e9897013e0ae9b6d42c5f6b58d18` | Código novo preservado em commit/tag locais separados; main e o índice original permanecem intactos |
| Electron publicado | GitHub `v0.1.43`, não draft/prerelease, Latest; alvo igual ao HEAD | Última release disponível; 0.1.42 permanece draft após problema de inicialização; não usá-la como retorno |
| WEB ativo | `dpl_ppVMUda9t3fpnUHj4h7RwwhG5QKH`, `lobbyx-6giqoib2b-nicolasmaarttins-projects.vercel.app`, SHA igual ao HEAD, READY | Alias público `https://lobbyx-nine.vercel.app`; publicado em 09/10/2026 às 18:18, São Paulo |
| Vercel | projeto `lobbyx`, Node 24.x, TanStack Start; GitHub/main como branch de produção | Push em main pode implantar automaticamente; nenhuma autorização implícita para push |
| Região WEB | SSR do deploy atual em `iad1` | Não confundir com região do Supabase, nem atribuir latência a essa região sem medição; sem mudança nesta tarefa |
| Supabase atual | `lnupoqtaeawwggbwgbuv`, PostgreSQL 17.11; consultas em transação READ ONLY | 15 usuários, 20 mensagens de servidor e 47 objetos Storage no inventário; três migrations originais ausentes; a quarta correção Realtime foi preparada localmente |
| Histórico SQL | `supabase_migrations.schema_migrations` ausente | Não executar `supabase db push` nem reaplicar todos os arquivos históricos; ordem inferida pelo catálogo não comprova datas históricas |
| Progression arquivado | Nenhuma funcionalidade arquivada restaurada | O serviço gamer/XP preexistente continua; não confundir seu nome com o pacote Progression arquivado |

O status READY/Latest identifica o ponto de recuperação, mas não constitui um novo E2E autenticado da versão estável. Antes da janela, reconfirmar IDs, SHA, usuários ativos e saúde da 0.1.43. O working tree já tinha alterações em voz/presença/instrumentação e outros recursos; não substituir arquivos pela versão publicada. Conferir o diff completo, inclusive arquivos novos, antes do commit candidato.

## Escopo e dependências

| Entrega | Dependência | Compatibilidade |
| --- | --- | --- |
| Notificações/badges persistentes | migration 010000, RPCs de leitura, tabelas de leitura já existentes, Realtime e hooks compartilhados | Cliente novo exige RPCs antes do deploy. Clientes 0.1.43 usam RPCs/cursors antigos, preservados |
| Optimization V2 | migration 020000 após 010000; caches, consultas paralelas e memoização de molduras | Mesmos identificadores, campos e retorno da RPC; não alterar transporte WebRTC |
| Monitor V1.1 | migration 030000, RPC `is_performance_admin`, rota protegida, collector/IPC local | Coleta OFF por padrão. WEB informa CPU/RAM total indisponível. EXE antigo não precisa acessar o painel; clientes novos toleram bridge ausente |

As três migrations completas estão em `supabase/migrations/20261010010000_persistent_unread_badges.sql`, `20261010020000_unread_query_performance.sql` e `20261010030000_performance_monitor_admin.sql`. Nenhuma dependência npm nova é necessária para essas funcionalidades. Preservar `package-lock.json` e o lock Desktop. Esta finalização acrescenta a migration 040000, invalidação privada no consumidor e testes SQL, além das guardas e documentos. Não houve alteração da arquitetura WebRTC.

Não há feature flag global para desligar somente badges/V2 em produção. O monitor pode ser pausado e sua autorização revogada; demais desligamentos exigem rollback WEB ou hotfix aprovado. Não prometer um botão de emergência inexistente.

**Correção Realtime preparada:** ver seção de finalização abaixo. As três tabelas ausentes não serão publicadas diretamente; eventos de mudança geram INSERT/UPDATE de avisos privados por usuário. Não houve alteração Realtime em produção.

## Backup e integridade

Diretório privado local: `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/release-preparation-private`. Fora do Git, com ACL Windows restringida à conta atual e SYSTEM. Esse diretório **não é um pacote compartilhável**; dump Auth contém informações privadas/hashes/sessões. Não anexar dumps, logs privados, arquivos de conexão ou bundle histórico a PRs, chats, releases ou ao repositório. ACL não substitui criptografia: confirmar BitLocker ou cofre criptografado e uma segunda cópia segura antes de publicar.

| Artefato | Verificação realizada | Limitação |
| --- | --- | --- |
| Tag local `codex/recovery-0.1.43-20261010` | Aponta ao SHA estável; sem push | Tag apenas local |
| `recovery-code.private.bundle` | `git bundle verify` passou; histórico/refs recuperáveis | Não inclui working tree; histórico pode conter itens antigos privados/arquivados, não compartilhar nem restaurar tudo sobre o workspace |
| Snapshot do código atual | Cópia sanitizada dos arquivos versionados/novos, manifesto SHA256 e verificação da cópia | Sem `.env`, tokens, banco, node_modules ou saídas de build; preservar também o estado Git/diff privado |
| Instalador anterior + blockmap/feed | Copiados sem sobrescrever originais; SHA256 do exe `d179fa807cbc2bc59538625c43d746f7f870d475bc6b25cf99c588ca892f5ec0`, igual ao digest publicado | Preservar durante toda a janela; não gerar novo instalador agora |
| `production.private.dump` | pg_dump custom completo, 699.435 bytes; TOC legível; SHA256 no manifesto | **Restauração completa não validada** |
| Roles/config SQL | Roles exportadas com `--no-role-passwords`; catálogo de extensões, policy e publicação preservados | Credenciais de login não estão nesse export; devem continuar no cofre privado |
| Storage | 47 downloads autenticados de leitura; hash dos bytes baixados igual ao arquivo local | Não prova restauração por upload, nem atomicidade conjunta com o dump; não houve upload em produção |
| Config Vercel | IDs, SHA, região e nomes/tipos/targets de variáveis preservados | Valores secretos não exportados; disponibilidade deles no cofre ainda precisa ser confirmada |

O teste de restore usou um banco novo isolado em localhost, transação única e erro fatal. Falhou por falta da extensão genuína `supabase_vault` no PostgreSQL local. Não substituímos a extensão por um mock nem removemos objetos para declarar sucesso. Esse ensaio também excluía owners/ACL; mesmo se concluísse, seria necessário validar owners, grants e RLS no ambiente Supabase compatível. Vault tinha zero segredos no inventário, mas a extensão ainda é uma dependência do schema.

**Risco aceito pelo proprietário em 10/10/2026:** a restauração integral continua NÃO comprovada devido à ausência de supabase_vault local. O proprietário aceita a possibilidade de perder os dados atuais ou começar do zero; essa limitação deixa de ser bloqueio absoluto da publicação. Preservamos dump, Storage e evidências sem declarar restore validado. Isso NÃO autoriza apagar, reinicializar ou modificar produção. Qualquer recuperação destrutiva exige nova autorização específica. Um ensaio Supabase compatível continua recomendado, sem ser requisito absoluto desta decisão.

Backup de hoje foi feito com produção ativa: dump tem snapshot lógico consistente, mas Storage foi obtido depois, sem congelamento de escritas. Para publicar, obter backup fresco durante a janela e comparar inventários antes/depois. Sem suspensão efetiva de escritas, declarar RPO maior que zero e não oferecer restore integral como reversão sem perda. Configurar e confirmar recuperação de providers OAuth, redirects, SMTP, URLs, Realtime, Storage, secrets externos e variáveis Vercel/GitHub fora do dump. Não renovar senhas/chaves para esta preparação.

## Auditoria das migrations

### 1. `20261010010000_persistent_unread_badges.sql`

BEGIN/COMMIT internos. Cria três funções novas SECURITY INVOKER, `search_path=pg_catalog`, identidade exclusivamente `auth.uid()`, execução negada a PUBLIC/anon e concedida a authenticated. Valida acesso a canal/conversa. Atualização de cursor monotônica; não apaga mensagens nem retrocede leituras. A contagem ignora próprias mensagens e histórico anterior à entrada quando não há cursor. Adiciona `channel_read_states` à publicação, se publicação existir e tabela ainda não fizer parte. As RPCs antigas e colunas continuam intactas.

Produção possui tabela de leitura/constraints, mas as RPCs novas e a inclusão dessa tabela na publicação estão ausentes. CREATE FUNCTION não é idempotente; abortar se aparecer uma função conflitante antes da execução. Não reaplicar sem verificar transação e catálogo. Backup da lista de publicação permite decidir rollback sem remover inclusão preexistente.

### 2. `20261010020000_unread_query_performance.sql`

BEGIN/COMMIT internos. Cria helper SECURITY DEFINER sem ID de usuário arbitrário, identidade derivada de auth.uid, lookup de membership e permission; search_path fixo e execução somente authenticated. Altera **a policy de SELECT** das mensagens para o conjunto autorizado calculado por statement. A RPC continua SECURITY INVOKER: RLS não é desativado. ALTER POLICY não muda TO/FOR/permissividade existentes. O retorno mantém as quatro colunas e tipos da migration anterior; agrega somente range não lido com LATERAL. Não há backfill nem novo índice pesado.

Produção já possui `messages_channel_created_idx` (channel_id, created_at DESC), índices/uniqueness de membership/leitura. A policy atual é `has_channel_permission(channel_id, auth.uid(), 'view_channel'::text)`. Capturá-la novamente na janela. Validar propriedade das funções e privilégio do aplicador. Helper definidor exige atenção: equivalência de acesso foi testada localmente, não presumida por ele ser SECURITY DEFINER.

### 3. `20261010030000_performance_monitor_admin.sql`

Cria allowlist vazia, FK para auth.users com cascade; RLS ativo, acesso direto revogado de PUBLIC/anon/authenticated. RPC SECURITY DEFINER retorna apenas boolean do próprio auth.uid; search_path fixo. Não insere nenhum administrador e não concede acesso por cargo/dono de servidor. Não contém BEGIN/COMMIT: aplicar futuramente em transação única externa. O comentário LOCAL ONLY indica preparação ainda não implantada; não é evidência de que já existe em produção.

**Conta principal:** o e-mail informado foi consultado em auth.users; houve um único UUID e e-mail confirmado. Evidência privada em `identity.private.json`. Não há UUID/e-mail pessoal nos scripts compartilháveis nem allowlist criada em produção. Antes de qualquer INSERT: reconfirmar projeto, UUID, e-mail e confirmação; apresentar UUID ao proprietário para confirmação humana e pedir autorização explícita de concessão. Exigir tabela vazia; qualquer entrada inesperada interrompe o processo. Só então inserir uma linha para o UUID confirmado. Verificar count=1 e nenhum outro acesso. Não usar “o primeiro usuário”, profile.name ou cargo de servidor como identidade.

### Aplicação futura controlada

Antes de cada arquivo, conferir SHA256 e catálogo/definições/grants. Como não há ledger remoto, guardar registro privado de hora, hash, aplicador, estado antes/depois e resultado. Não criar/“reparar” histórico de migrations automaticamente. Usar conexão privada já validada para o projeto correto, SSL, nunca senha/URI em argumentos ou logs.

Aplicar **010000 → 020000 → 030000 → 040000**, um arquivo de cada vez, com `psql -X -w -v ON_ERROR_STOP=1`, `lock_timeout=5s` e `statement_timeout=60s` na sessão. 010000/020000/040000 já gerenciam transação: não adicionar wrappers que briguem com seus COMMITs. 030000 requer `--single-transaction`. Erro/time-out: parar, verificar rollback/catálogo antes de repetir; nunca continuar no próximo arquivo. Não chamar os scripts de implantação antigos, que também executam outras ações. Recarregar o schema PostgREST apenas se necessário, com autorização e depois do commit; não publicar clientes até RPCs/grants terem sido verificados.

SQL local passou todos os arquivos históricos + quatro novos e testes de contagem, leitura parcial/total, monotonicidade, menções, não membro, canal restrito, troca de cargos, remoção de membro, anônimo e allowlist/autoconcessão/revogação. Testes usam fixtures e rollback; não comprovaram GoTrue/PostgREST/Realtime hospedados nem cliente antigo contra banco real atualizado.

## Procedimento de publicação — não executado

Proposta: janela de 60–90 minutos para WEB/banco, a confirmar pelo proprietário; sem data marcada automaticamente. Avisar os poucos usuários por iniciativa humana autorizada, pedir encerramento das chamadas e reservar operador durante toda a janela. Caso escritas não sejam suspensas de forma verificável, anotar explicitamente o risco de RPO e preferir rollback de código/DDL à restauração integral.

1. **Gate backup:** conferir recuperação do código independente do GitHub, backups preservados, configs/secrets acessíveis e backup fresco incluindo Storage. Registrar a exceção expressamente aceita para restore integral não comprovado. Guardar manifestos fora do Git. Conferir ponto de retorno WEB/0.1.43 e estado estável.
2. Revisar diff, registrar candidato/SHA exato, locks, hashes SQL, ausência de Progression arquivado e de secrets. Commit/branch de recuperação são locais e já preparados; push exige autorização separada, pois main tem deploy automático. Não executar `git reset --hard`, checkout de stable por cima do workspace, force-push ou rebuild de arquivos antigos.
3. Repetir testes, typecheck, lint, scan e `npm run build:vercel`. Não usar `desktop:dist` nesta fase. Congelar candidato: se código/lock mudar, repetir validação relevante e hashes.
4. Obter autorização explícita das **quatro migrations específicas** e aplicar na ordem acima. Testar acessos permitidos/negados e confirmar que o cliente 0.1.43 continua autenticando, lendo/enviando mensagens e entrando em voz. Não criar usuários de teste automaticamente em produção.
5. Obter autorização WEB e publicar exatamente o SHA validado. Usar um único caminho (integração Git ou CLI); não fazer push main e CLI ao mesmo tempo. Registrar novo deployment ID e aliases. Manter a versão estável disponível para rollback.
6. Smoke WEB com contas reais autorizadas: Google/e-mail, perfil/imagens, servidores, canais, mensagens servidor/PV, histórico, enviar/editar/excluir/reagir, permissões/cargos/categorias, menções online/DND e contagens. Um cliente 0.1.43 e o WEB novo devem coexistir sem quebra. Ver checklist de cenários completos.
7. Depois da confirmação humana do UUID e autorização de INSERT, permitir apenas a conta principal no monitor. Testar sua conta, conta comum, proprietário/ADM de servidor e sessão anônima; verificar negativas por backend. Coleta inicialmente OFF, ativar manualmente por curto ensaio e pausar ao final. Não há telemetria global.
8. Testar voz em servidor e PV com duas contas/redes reais, troca de canais, presença observada sem entrar, mover/mute/deafen autorizado, compartilhar/parar/assistir, áudio, 30 minutos de chamada parada sem reconexão. Não modificar arquitetura ICE/WebRTC como parte desta release.
9. **Gate WEB:** proprietário confirma resultados e autoriza preparar Desktop. Se WEB/banco/voz falhar, não incrementar versão, não empacotar EXE, não iniciar workflow Desktop. Manter/acionar rollback WEB conforme plano.
10. Só depois: escolher versão nova maior que 0.1.43 (0.1.44 apenas candidata, ainda não reservada), atualizar manifest/lock Desktop e produzir NSIS x64 com `npm run desktop:dist` (`--publish never`). Não executar `npm run build:vercel` para gerar o shell Desktop. Validar installer/blockmap/latest.yml, pacote/CSP, abertura sem tela preta, login, protocolos, funcionalidades e atualização da instalação 0.1.43 em máquina de teste.
11. Workflow manual pode preparar draft após confirmação WEB e autorização de preparação. Conferir os assets e obter **outra autorização explícita para publicar/liberar auto-update**. Só então promover draft e marcar Latest. Verificar feed, hashes, download e bloqueio de instalar durante chamada/tela. O script de promoção combinado só deve ser chamado com `--publish-approved` após validações/autorização; para um draft já criado, promover manualmente a release existente aprovada, sem recriá-la.
12. Observar WEB e EXE, manter backups/rollback acessíveis, registrar versão, UTC e horário São Paulo, testes e responsáveis. Nenhuma release automática será liberada nesta preparação.

## Validação desta tarefa

184/184 testes passaram, typecheck e `build:vercel` passaram; `security:db` PASS no banco local isolado. Inclui novo teste das guardas de publicação; ele passou novamente após formatação. Lint: 0 erros/47 avisos. Scanner: 558 arquivos, zero findings. `git diff --check` passou. Snapshot de 592 arquivos conferido por hash. O ensaio local adicional de retorno à policy/RPC original e restauração da versão otimizada passou `tests/unread-counts.sql` nos dois estados, com helper temporariamente mantida sem uso. Isso não valida restore integral nem PostgREST hospedado. O Desktop teve build técnico aprovado na V1.1, mas **não geramos nem validamos um novo instalador nesta tarefa**, para respeitar WEB primeiro.

V1.1 não reproduziu a duplicação antiga de CPU em voz. Com coleta ligada, tela teve +2,01 pontos médios de CPU, com sinais opostos entre pares; WEB/100 perfis teve RAF p95 +2,80 ms. Resultados pequenos/sintéticos não garantem ausência de custo. Manter coleta OFF e repetir teste real curto no WEB e depois EXE antes da liberação. Falha do monitor não deve bloquear mensagens/voz; manter validação de crash/timeout/indisponibilidade.

## Automação e intervenção

Automatizados/local: testes, scan, builds WEB, ensaio SQL, checksums/TOC, download/verificação de backup, guardas e verificador de metadados NSIS. Ainda não automatizados/comprovados: restore Supabase integral/Storage/config externo, suspensão efetiva de escritas, E2E autenticado/multirrede, evidência de audibilidade e instalação real.

Intervenção obrigatória: confirmar disponibilidade dos backups e risco de restore aceito, escolher janela, confirmar UUID e concessão única, autorizar migrations/deploy WEB, confirmar WEB, autorizar gerar EXE, validar instalador e autorizar promoção/auto-update. CI não substitui esses gates. A workflow local agora aceita somente dispatch manual, com declaração WEB validado inicialmente false; seu script deixa draft por padrão e não promove unattended. São mudanças locais; a workflow antiga remota continua como estiver até publicação autorizada, portanto não dispará-la nem empurrar tags agora.

Fontes primárias: [backup/restore Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [rollback Vercel](https://vercel.com/docs/instant-rollback), código atual `desktop/updater.cjs` e scripts de build/release. Dumps não contêm os bytes do Storage nem toda a configuração externa do projeto; estes precisam de recuperação própria. Recuperação completa do banco é último recurso com avaliação de escritas posteriores.

## Finalização — código preservado e Realtime seguro

Fonte estável: commit d33f2021dfe0e9897013e0ae9b6d42c5f6b58d18, tag local codex/recovery-0.1.43-20261010. Fonte nova completa: branch local codex/release-candidate-preserved-20261010 e tag codex/recovery-candidate-20261010. A tag identifica o commit exato; SHA, trees, hashes e contagens ficam no manifesto privado source-preservation-final.json. Não se alterou main, índice original, histórico publicado nem refs remotas.

Backup independente: release-source-final.private.bundle no diretório privado, contendo as duas referências e sua ancestralidade. A verificação inclui git bundle verify, clone a partir SOMENTE desse arquivo, git fsck e recuperação das duas árvores em diretórios novos source-restored-stable/source-restored-candidate, com comparação SHA256 de cada arquivo contra os blobs Git e do candidato contra o workspace. Ambas incluem código WEB/Desktop, scripts, configurações, migrations, package-lock.json, desktop/package-lock.json e .env.example. Isso comprova preservação da fonte, além do instalador. Gerados ignorados (node_modules, WEB empacotado, worklet/RNNoise) são reconstruídos pelos scripts e locks; credenciais externas ficam fora do Git e devem continuar acessíveis privadamente. Um build em máquina limpa de ambas as árvores ainda não foi ensaiado; hashes/checkout não comprovam disponibilidade futura do registry nem configuração externa.

### 4. 20261010040000_private_permission_invalidations.sql

Uma tabela permission_invalidations com apenas user_id e revision, uma linha por destinatário. SELECT authenticated protegido por user_id=auth.uid(); sem INSERT/UPDATE/DELETE ou execução do trigger para clientes/anon. Não contém servidor, nome, cargo, conteúdo, token ou lista de membros. Não tem FK com exclusão em cascata; nenhuma rotina de limpeza ou DELETE publicado é introduzida. Linhas de contas removidas podem permanecer; limpeza futura exige procedimento específico sem publicação de DELETE.

Triggers AFTER INSERT/UPDATE/DELETE em server_members, roles e member_roles atualizam a revisão dos membros dos servidores envolvidos; a exclusão de membership avisa também o próprio usuário removido. Cascatas de cargos são cobertas pelo evento de roles; cascatas de membership pelo evento de server_members. UPDATE sem mudança não gera aviso. Revogações recalculam contadores via RPC com RLS atual, sem enviar resultados antigos no evento. Segurança das tabelas originais permanece intacta. Fanout é proporcional à quantidade de membros em mudanças administrativas, sem varredura de mensagens ou polling; alto volume de alterações de cargos exige benchmark adicional.

Publicação: 010000 adiciona channel_read_states; 040000 adiciona SOMENTE permission_invalidations, sem substituir a lista nem retirar assinaturas existentes. Não acrescentar roles/member_roles/server_members diretamente: Supabase documenta que DELETE não aplica RLS como INSERT/UPDATE ([Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)). O consumidor utiliza apenas INSERT/UPDATE filtrados para o usuário autenticado; debounce de 200 ms agrupa atualização de contadores e caches servers/members/roles/channels. Não adiciona assinaturas duplicadas nem altera sinalização de voz.

A função existente can_use_realtime_topic recebe somente um ramo read-states:<UUID> de leitura para o próprio usuário, sem escrita. CREATE OR REPLACE preserva a definição restante, owner e grants; migration aborta se o marcador esperado estiver ausente ou o ramo já existir. Capturar definição de produção antes de aplicar: drift exige revisão, nunca substituição cega. Política RLS continua sendo a autoridade do payload, mesmo quando o cliente esquece o filtro.

Validação local: execução de todas as migrations em banco vazio isolado; igualdade da lista Realtime antes/depois salvo a única nova tabela; avisos de cargos/cascatas/revogação, nenhum aviso de outro servidor, SELECT somente do próprio destinatário mesmo após remoção, escrita/autoforja negadas, anon negado e topic privado restrito. Os testes de contagens/RLS/allowlist anteriores também passam. Isso não comprova entrega websocket hospedada, latência sob carga nem integração autenticada: validar esses itens após autorização e aplicação SQL, antes de liberar WEB/EXE.

### Próxima autorização

Confirmar janela e disponibilidade das configurações externas; autorizar especificamente aplicação das quatro migrations acima e depois deploy WEB do candidato congelado. Não autorizar push main implicitamente. Após reconfirmar e apresentar UUID da conta principal (já encontrado uma única vez em auth.users, evidência privada), solicitar aprovação do INSERT único do monitor. Coleta permanece OFF. WEB/mensagens/notificações/permissões/voz aprovados precedem qualquer installer. Liberação de auto-update exige autorização posterior separada. Nesta tarefa não houve push, deploy, release, grant nem mudança de produção.
