# Comunidades V1 — Fase 4A: fundação da evolução coletiva

Entrega local de 21/10/2026, na branch `codex/communities-v1`, sobre a Fase 3C (`3d9c5c7`). **Sem publicação, push, migrations remotas, Docker, staging ou alteração do atualizador.** Fases 4B/4C não iniciadas. A entrega está pronta para avaliação local; não constitui recomendação de publicação.

## 1. Auditoria e reutilização

Foram examinados o diagnóstico das comunidades, a migration ativa de XP de 16/08, o bloqueio de escrita de 09/10, `src/services/gamer.ts`, `XpBar.tsx`, os relatórios 1–3C e o arquivo `archives/lobbyx-progression-v1-20261008` (relatório, migration e contratos).

| Domínio                                                   | Estado constatado                                                                                       | Decisão 4A                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| XP/nível individual                                       | `user_xp`; triggers de 5 XP por mensagem e 50 por servidor; `award_xp` bloqueado para clientes          | Preservado, sem rebalanceamento ou backfill                |
| Badges individuais                                        | `badges`, `user_badges`, serviço de leitura e perfis                                                    | Preservados                                                |
| Ranks, temporadas, missões e inventário do Progression V1 | Arquivados; migration substituiria a curva e os bônus individuais, com inventário e permissões próprios | Nenhum arquivo, patch, stash, tabela ou rota restaurado    |
| Eventos 3A                                                | RSVP e lembretes; não comprovam realização nem participação                                             | Nenhum XP por RSVP, criação/edição de evento ou lembrete   |
| Voz                                                       | Presença/WebRTC sem autoridade confiável de participação                                                | Nenhum XP por tempo, peers ou duração enviada pelo cliente |
| Comunidades                                               | Mesmo `server_id`, ativação e delegação explícita já existentes                                         | Reutilizados; não criado outro sistema de servidores       |

Reutilizados também Home, componentes de botão/diálogo, identidade visual, TanStack Query, Supabase tipado e a infraestrutura PostgreSQL local. Dos arquivos antigos de progressão foram aproveitados **conceitos**, especialmente concessão idempotente, ledger e restrição ao backend, sem copiar o motor individual arquivado.

## 2. Implementado

- Conta coletiva independente, criada no primeiro consumo de atividade verificada. Antes disso, leitura mostra nível 1 e zero XP, sem escrever dados ao abrir a Home.
- Curvas imutáveis versionadas; versão fixada na conta no primeiro ganho. Mudanças na curva padrão só atingem novas contas; não rebaixam comunidades existentes.
- Política privada de valores e tetos, com revisão automática e registro anterior/posterior, operador SQL e data.
- Registro privado de atestações, unicidade global da evidência e vínculo à comunidade. Atestação não contém pontos, lista de participantes, conteúdo de mensagem ou duração de chamada.
- Consumo exclusivo por função autorizada para `service_role`/operador do banco, recebendo apenas IDs de comunidade/atestação. O frontend não possui método nem permissão de concessão.
- Ledger imutável com quantidade solicitada/aplicada, saldo posterior, revisão da política, data e referência privada à evidência.
- Idempotência, teto diário/semanal, concessão parcial e resultado terminal `capped` de zero XP. Uma repetição não concede de novo nem pode esperar o dia seguinte para recuperar uma concessão já limitada.
- Bloqueio de novas concessões com comunidade desativada. Conta, versão da curva e histórico permanecem na reativação.
- Home com nível, barra, XP permanente, próximo nível e mensagem explícita de ganhos desativados. Histórico administrativo paginado, sem identidades/evidências privadas.
- Estados de carregamento, erro e tentativa de consulta; consultas separadas por conta/servidor, sem polling, nova assinatura Realtime, efeitos ou animações decorativas.

Não foram implementados missões, conquistas, catálogo/inventário coletivo, recompensas, impulsos, pagamentos ou painel estatístico. São escopos posteriores. Nenhum benefício essencial foi condicionado ao nível.

## 3. Modelo de XP

Para nível `L >= 1`, o custo até o próximo nível é `base + passo × (L − 1)`. O limiar acumulado é `base × (L − 1) + passo × (L − 1) × (L − 2) / 2`.

Padrão preparado: base **1.000**, passo **500**. Níveis 1/2/3/4 começam em 0/1.000/2.500/4.500 XP. O backend encontra o nível por busca binária limitada, inclusive para curvas lineares grandes. O cliente apenas apresenta os limiares recebidos.

Política inicial: **desativada**, 100 XP por futura atividade verificada, teto de 500/dia e 2.000/semana por comunidade. São parâmetros de fundação, não recompensas já disponíveis ao usuário. Semana começa segunda-feira, 00h UTC; dia começa 00h UTC. São janelas de calendário, não intervalos móveis. O relógio usado é o do banco, após adquirir o lock; não se aceita timestamp do renderer.

Há proteção numérica de saldo em 10¹² XP; atingir esse teto não reduz XP nem nível. Não há um loop truncando níveis em 100 ou 1.000. O teste com curva linear de base 100 e saldo 10¹² comprovou nível 10.000.000.001.

O consumidor primeiro trava o servidor, serializando com ativação/desativação; depois lê a política sob lock compartilhado e atualiza a conta sob lock. Conta e ledger são gravados na mesma transação. Os tetos usam apenas concessões efetivamente registradas na janela, indexadas por comunidade/data. Não há soma do XP individual.

**Fonte ainda não integrada:** a 4A não possui produtor confiável de participação. `backend_verified_activity` é um contrato reservado, desativado. Um futuro verificador precisa comprovar a atividade, legitimidade e resistência a contas falsas antes de registrar uma evidência única, com validade de até 24 horas. O banco não consegue provar presença legítima a partir de um UUID. Os únicos ganhos exercitados nesta entrega foram fixtures sintéticas em banco descartável local. Não habilitar a política para substituir essa autoridade por afirmações do cliente.

## 4. Banco e permissões

Migration nova: `supabase/migrations/20261021060000_community_progression_foundation.sql`.

| Estrutura                                        | Função / exposição                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `security_private.community_xp_curves`           | Curvas imutáveis; sem acesso de navegador                                     |
| `security_private.community_xp_policy`           | Configuração exclusiva do backend, inicialmente desligada                     |
| `security_private.community_xp_policy_audit`     | Alterações da configuração, anteriores/posteriores                            |
| `security_private.community_verified_activities` | Evidências opacas verificadas, imutáveis e únicas                             |
| `public.community_xp_accounts`                   | Saldo e curva por servidor; RLS sem políticas diretas e sem grants de cliente |
| `public.community_xp_ledger`                     | Histórico imutável; RLS sem políticas diretas e sem grants de cliente         |

RPCs: `get_community_progression` (membro atual de comunidade ativa, não banido), `list_community_xp_history` (proprietário/gestor explicitamente delegado) e `consume_verified_community_activity` (somente backend confiável). Administrador genérico não recebe acesso administrativo por inferência. Nem o proprietário pode conceder XP pelo cliente.

Histórico retorna até 50 registros por página, UI usa 20, cursor numérico bigint transportado como string sem perda de precisão. Ordenação numérica evita o erro lexicográfico de `9 > 10`. Evidência e IDs pessoais não são projetados.

Desativar comunidade preserva todo o domínio. A exclusão explícita do próprio servidor mantém a semântica de cascata existente; esta entrega não altera o fluxo de exclusão nem executa exclusões de dados reais. Não houve coleta de áudio, telemetria pessoal ou conteúdo de mensagens para pontuar.

Reversão conservadora preparada em `PROGRESSAO-OPERACAO-LOCAL.md`: desligar a flag da interface e a política, revogar o consumidor, conservar tabelas e histórico. Não fornecer um down destrutivo é intencional.

## 5. Validação executada

| Ambiente/cenário                           | Resultado e limite                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node `npm test`                            | **257 aprovados, 0 falhas, 0 ignorados**; inclui contratos/parser de XP, cursors bigint e suítes anteriores de comunidades, chat, voz e segurança                                                                                                                                                                                                                                                                |
| PostgreSQL nativo, loopback 55468          | Todas as migrations aplicadas em banco novo descartável; suíte 4A e suítes anteriores completas aprovadas                                                                                                                                                                                                                                                                                                        |
| Banco final retido                         | `lobbyx_community_test_1792608771719`, somente fixtures sintéticas                                                                                                                                                                                                                                                                                                                                               |
| Identidades e RLS                          | Anônimo, estranho, membro, banido, administrador sem delegação e gestor revogado recusados conforme operação; dono/gestor leem histórico; membro lê resumo; escrita/consumo pelo cliente recusados                                                                                                                                                                                                               |
| Integridade/XP                             | Zero inicial, fonte desligada, evidência inexistente/de outro servidor/expirada, replay, teto parcial/zero, limite semanal independente do diário, falha de ledger com rollback do saldo, curvas exatas/grandes e versão fixada aprovados                                                                                                                                                                        |
| Preservação                                | Desativação/reativação mantêm saldo; snapshot de XP individual, badges e mensagens permanece idêntico                                                                                                                                                                                                                                                                                                            |
| Paginação                                  | Limite máximo, cursor exclusivo, ordenação numérica após cruzar ID 9/10 e projeção sem evidência aprovados                                                                                                                                                                                                                                                                                                       |
| Concorrência nova                          | 3 cenários reais entre processos PostgreSQL: mesmo evento, disputa de teto, desativação versus concessão. Um ledger por atestação; total exato 250, nunca acima do teto; nova concessão aguardando desativação recusada                                                                                                                                                                                          |
| Regressões SQL                             | Fundação, onboarding, eventos, descoberta, moderação, notificações, menções e segurança anteriores passaram; mantidos os 15 cenários concorrentes existentes, totalizando 18                                                                                                                                                                                                                                     |
| TypeScript                                 | `npm run typecheck` aprovado                                                                                                                                                                                                                                                                                                                                                                                     |
| Lint dos arquivos 4A/integração alterados  | **Aprovado, zero erros e warnings**                                                                                                                                                                                                                                                                                                                                                                              |
| Lint completo                              | **Não aprovado: 55 erros e 51 warnings**, em conteúdo legado. Os oito arquivos com erros correspondem ao HEAD após normalizar finais de linha; nenhum é alterado nesta entrega. Comparação com blobs Git reproduz 52 erros; três diagnósticos adicionais vêm dos finais de linha existentes no fixture de áudio. A primeira execução também apontou formatação da nova prévia, corrigida antes da execução final |
| Scanner                                    | 699 arquivos, nenhum achado                                                                                                                                                                                                                                                                                                                                                                                      |
| Builds                                     | WEB com flag ligada, Desktop renderer e WEB com flag padrão desligada aprovados. Sem empacotar, instalar ou distribuir EXE                                                                                                                                                                                                                                                                                       |
| Interface real da prévia                   | Home, histórico, página seguinte/última página, zero XP e visão de membro exercitados no navegador. Console sem erros na amostra; viewport útil móvel de 375 px, `scrollWidth = clientWidth`, sem overflow horizontal                                                                                                                                                                                            |
| HTTP autenticado / WEB e EXE autenticados  | **Não executado**: não há GoTrue/PostgREST isolados. Claims/roles SQL não substituem autenticação HTTP                                                                                                                                                                                                                                                                                                           |
| Chamadas e compartilhamento entre clientes | **Não validados manualmente nesta entrega**. Provedores/captura/hotbar não alterados; testes automatizados existentes não são prova de chamadas reais ou ausência de “Conectando”                                                                                                                                                                                                                                |

Erros legados do lint completo: `desktop/clipboard.cjs`, `tests/audio/pipeline-fixture.mjs`, `tests/chat-formatting.test.mjs`, `tests/invite-clipboard.test.mjs`, `tests/mention-completion.test.mjs`, `tests/mentions/fixture.tsx`, `tests/screen-sharing.test.mjs` e `tests/screen-v2/harness.tsx`. Não foi feita reformatação geral de voz/clipboard/testes independentes para esconder essa pendência.

Evidências textuais locais: `vo/work/community-4a-{tests,db,typecheck,lint,lint-focused,security,web,desktop,web-default,preview}.log`, `community-4a-lint.json` e `community-4a-lint-baseline.json`. O log `lint.log` é a primeira execução; o JSON é o diagnóstico completo após corrigir a formatação da prévia. O log `lint-focused.log` fica vazio porque a execução final não encontrou problemas.

## 6. Capturas e prévia

Executar na raiz do checkout: `npm run preview:community-progression`. Endereço local: `http://127.0.0.1:5210/`. Só componentes reais e fixtures em memória, com aviso explícito de dados fictícios, sem cliente Supabase ou credenciais. Não é uma sessão autenticada e a navegação lateral é um contorno demonstrativo; a integração real foi feita na Home existente.

- `vo/outputs/community-4a-home.png` — Home com nível e barra.
- `vo/outputs/community-4a-history.png` — última página do histórico.
- `vo/outputs/community-4a-empty.png` — nível 1, zero XP.
- `vo/outputs/community-4a-mobile.png` — Home responsiva.

![Home — prévia local com dados fictícios](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-4a-home.png)

## 7. Arquivos desta entrega

Novos: migration 060000; `src/types/community-progression.ts`; `src/lib/community-progression.ts`; `src/services/community-progression.ts`; `src/components/community/CommunityProgression.tsx`; `CommunityProgressionView.tsx`; `tests/community-progression.sql`; `tests/community-progression.test.mjs`; `tests/community-progression-preview/{index.html,preview.tsx,vite.config.mjs}`; este relatório e `PROGRESSAO-OPERACAO-LOCAL.md`.

Alterados: `CommunityHome.tsx` (slot opcional), `CommunityWorkspace.tsx` (integração com chave conta/servidor), `src/integrations/supabase/types.ts` (somente contratos de leitura), `scripts/test-community-db.mjs` (suite/races 4A) e `package.json` (comando de prévia).

Não alterados: migration/curva/triggers individuais, código arquivado, providers de voz/compartilhamento, rota principal, mensagens, hotbar, versão e configuração Desktop/updater. O instalador estável 0.1.58 conserva SHA-256 `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`.

## 8. Limitações e próximos passos

1. Avaliação do usuário antes de qualquer 4B. Não há missões/conquistas nem recompensas implementadas por antecipação.
2. Definir uma autoridade de atividade verificável e controles contra fraude/contas falsas antes de ligar ganhos. A política privada não substitui essa autoridade.
3. Validar autenticação e contratos RPC em infraestrutura isolada quando disponível, sem recorrer a produção. O renderer Desktop compilado não equivale a dois clientes EXE autenticados.
4. Realizar testes manuais entre clientes de troca de conta/servidor, perda de permissões, reconexão, mensagens, voz e compartilhamento, com áudio quando suportado.
5. Resolver separadamente o lint legado antes de exigir a pipeline global totalmente verde. Os testes atuais não são teste de carga em comunidade grande nem medição de CPU/GPU/RAM ou latência em chamada.
6. O resumo atualiza ao montar/focar/reconectar; não foi instalado canal Realtime de concessões. Permissões são rechecadas em cada RPC, mas não se promete apagar instantaneamente informação já consultada em outro cliente.
7. Políticas/tetos são globais de backend; curvas já vinculadas são permanentes. Não existe editor administrativo de balanceamento ou migração entre curvas nesta fase.

Nenhum resultado ignorado foi contado como aprovado. A versão estável foi preservada e nenhuma autorização de publicação está presumida.
