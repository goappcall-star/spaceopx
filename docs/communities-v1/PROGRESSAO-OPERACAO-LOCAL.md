# Progressão coletiva 4A — contrato e operação local

Esta documentação não autoriza operação remota ou publicação. Trabalhar apenas no PostgreSQL isolado identificado pelo marcador `lobbyx-local-test-only.json`. O runner cria outro banco a cada execução, sem reaproveitar usuários/credenciais reais.

## Superfície de confiança

O renderer só possui `get_community_progression` e `list_community_xp_history`. A API de consumo não recebe quantidade, tempo, progresso ou pontuação. Mesmo um proprietário ou gestor explicitamente delegado recebe `permission denied` ao tentar consumi-la.

`consume_verified_community_activity(server_id, activity_id)` só está concedida a `service_role` e ao dono SQL. Exige atestação privada previamente registrada para o mesmo servidor e uma política habilitada. `service_role` não recebeu acesso direto às tabelas privadas ou ao saldo/ledger.

Não há endpoint de inscrição de atestações nesta fase. A única inscrição é por operador SQL confiável, exercitada nos testes. Um futuro serviço verificador precisa de caminho privado e mínimo de escrita e deve comprovar a atividade **antes** de gravar. Não expor acesso ao schema privado, credenciais de serviço ou esse consumidor no navegador/Electron.

Registro: UUID próprio, `server_id`, fonte reservada `backend_verified_activity`, `evidence_key` globalmente única, instante de verificação e expiração (até 24h). Os fatos são imutáveis. O mesmo fato não é reemitido após uma reconexão, nem pode ser transferido para outra comunidade. O sistema não aceita fatos expirados/futuros; um replay já consumido apenas devolve a decisão existente, inclusive após desativação, sem novo ganho.

A evidência é opaca; não se grava voz, conteúdo de mensagem nem listas de participantes. Não usar mensagens, quantidade de contas, cliques, RSVP ou duração de chamadas como substituto de comprovação de atividade. A prevenção de fraude/Sybil na futura origem é uma pendência, não uma capacidade alegadamente implementada.

## Balanceamento

Valores da migration: curva 1, base 1000/passo 500; 100 por atividade, 500/dia e 2000/semana; `enabled=false`. Tetos contam o instante de consumo no banco, em UTC, semana de segunda a domingo. Alterações em `community_xp_policy` incrementam revisão e registram estado anterior/posterior e operador.

Para mudar a curva de novas contas, inserir uma versão inédita em `community_xp_curves` e apontar a política para ela, em transação administrativa local. Não atualizar curvas existentes: são imutáveis. Contas existentes mantêm a versão original. Não atualizar saldo nem ledger manualmente; concessões devem seguir a função transacional.

Valor aplicado é `max(0,min(valor da política,restante diário,restante semanal,restante da proteção numérica))`. Parcial positiva é `granted`; zero é `capped`. Ambas decisões são permanentes por evidência. Aumentar o teto posteriormente não reabre decisões antigas.

O limite numérico é 10¹² XP, independente de compra/impulso; não existe pagamento nesta fase. Limites de configuração e validade de evidências são validações do backend, não limitações de chamadas/canais/qualidade de áudio.

## Auditoria e retenção

Ledger mantém saldo posterior, quantidade antes/depois do teto, revisão e referência ao fato. A política auditada permite recuperar o balanceamento usado. UI não exibe evidência ou dados do operador. Desativar a comunidade só bloqueia novos consumos e consultas; não apaga XP/histórico.

O fluxo de excluir explicitamente o servidor conserva a cascata de suas entidades, como no restante das comunidades. Isso não deve ser usado como ferramenta de manutenção do XP. Não há limpeza automática do ledger ou das evidências nesta fase; definir retenção operacional e eventual arquivamento não destrutivo antes de volume alto.

## Reversão conservadora

1. Desligar `VITE_COMMUNITIES_V1_ENABLED` no ambiente local de build (padrão já desligado).
2. Em banco **isolado**, desabilitar a política: `UPDATE security_private.community_xp_policy SET enabled=false WHERE singleton;`.
3. Se houver consumidor confiável instalado no futuro, pará-lo; pode-se revogar `EXECUTE ON FUNCTION public.consume_verified_community_activity(uuid,uuid) FROM service_role`.
4. Preservar as tabelas, versões, contas e histórico. Não apagar a migration aplicada nem fazer down com DROP/TRUNCATE.

Esta entrega não habilita a política, produtor ou atualização automática. Qualquer operação em produção exige nova autorização e validação apropriada; os testes SQL locais não comprovam GoTrue, PostgREST ou sessões reais WEB/EXE.
