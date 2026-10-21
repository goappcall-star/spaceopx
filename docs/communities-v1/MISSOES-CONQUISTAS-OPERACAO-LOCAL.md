# Missões e conquistas 4B — contrato e operação local

Complementa `PROGRESSAO-OPERACAO-LOCAL.md`. Não autoriza publicação ou operação em produção. Usar apenas o PostgreSQL nativo isolado com marcador `lobbyx-local-test-only.json`, na porta 55468.

## Fontes e habilitação

Dois marcos usam operações autorizadas do banco: primeira inserção ativa da configuração de comunidade e primeira publicação consentida/elegível pelo proprietário. São conquistas sem XP, sem backfill, uma vez por servidor/ID. Republicação, reativação, edição de catálogo ou ações de moderação não concedem novamente.

O critério `verified_activity` depende de um produtor confiável **ainda não integrado**. Seu verificador privado inicia falso, e a política de XP da 4A também continua falsa. Não ligar nenhum deles para usar mensagens, RSVP, peers ou duração de chamada como atalho.

Não há RPC pública de inscrição de fatos, contagem ou conclusão. Uma futura autoridade deve comprovar a atividade e controlar abuso/Sybil antes de registrar a atestação privada da 4A. Não aceitar pontos, progresso, horários ou conclusão afirmados pelo frontend. Não distribuir chave de serviço ao Electron/browser.

## Fluxo transacional

1. O consumidor 4A, exclusivo do backend, valida atestação/servidor/validade, trava o servidor e aplica XP conforme a política e os tetos existentes.
2. O trigger do ledger aceita como progresso apenas a fonte `backend_verified_activity`; trava/recheca o verificador e as versões ativas.
3. Cria/reutiliza uma instância por comunidade/ID/período UTC. A versão fica fixada na primeira contribuição.
4. Registra a evidência exata, única por instância/atestação, e incrementa até a meta. Não agrega dados privados de participantes.
5. Na conclusão, registra o contrato cosmético quando configurado e uma atestação interna de recompensa, vinculada à instância.
6. A recompensa passa pelo mesmo consumidor/conta/ledger/tetos. Seu valor vem da versão da missão. Pode ser integral, parcial ou zero; a decisão é idempotente e não reabre quando o teto muda.

Eventos `community_mission_reward` não progridem missões. Mesmo `service_role` não pode trocar o valor nem contornar limites; um fato de recompensa sem missão concluída vinculada falha. Qualquer falha desfaz toda a transação do consumo original, permitindo repetir o **mesmo ID** após correção.

## Catálogos e versões

`community_objective_keys` fixa ID, tipo, critério e cadência. `community_objective_versions` fixa meta, nome, descrição, categoria, raridade e recompensa para uma versão. UPDATE/DELETE são bloqueados. Para mudar uma missão futura, criar versão nova e alterar o ponteiro privado; não mudar instância/histórico existente.

O ponteiro não pode mudar de ID nem ser excluído; mudanças de versão e verificador são auditadas com operador/data. Máximo de oito missões ativas por cadência; uma conclusão por servidor/ID/período. Conquistas têm target 1 e XP zero nesta fase, independentemente de quem tente configurar a versão.

O catálogo cosmético começa vazio, tem apenas os tipos `seal`, `theme`, `banner`, `frame` e `highlight`, e exige `usable=false`. Desbloqueios são da comunidade, únicos por ID de recompensa, com origem/versão/data. Não há inventário de usuário ou ativo visual fictício.

## Consulta, expiração e privacidade

RPCs de leitura exigem membro atual de comunidade ativa e não banido. Galeria e histórico são paginados; payload não contém participantes, atores, evidências ou operadores. Clientes não recebem acesso bruto às tabelas.

Expiração é calculada pelo banco ao consultar, sem scheduler. Só há histórico de instâncias realmente iniciadas; períodos vazios não são fabricados. Completar não exige clicar em “resgatar”. Desativar conserva contas, evidências, progresso e desbloqueios; o calendário dos períodos continua correndo.

O resumo atualiza por montagem/foco/reconexão, sem nova assinatura Realtime ou polling. O SQL de testes usa roles/claims sintéticas; não comprova autenticação GoTrue/PostgREST nem chamada real WEB/EXE.

## Reversão conservadora e testes

Desligar a flag local de comunidades e manter `community_xp_policy.enabled=false` e `community_objective_verifiers.enabled=false`. Parar qualquer produtor futuramente instalado. Não apagar tabelas, ledger, versões, evidências ou histórico; não remover a migration aplicada como forma de rollback.

`npm run test:community-db` exige `PG_BINDIR`, recusa host/diretório sem o marcador local e cria bancos novos, sem DROP. O upgrade usa banco separado para não contaminar os invariantes globais da fixture antiga. O teste de cascata apaga somente o servidor sintético dentro de uma transação revertida, provando compatibilidade com a exclusão existente sem apagar dados reais.

A política/verificador só podem ser habilitados após validar uma autoridade real e obter as autorizações necessárias para qualquer operação fora do ambiente local. Esta fase não habilita ganhos automaticamente e não inicia personalização 4C.
