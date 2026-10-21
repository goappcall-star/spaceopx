# Comunidades V1 — Fase 4C: estatísticas e personalização

Entrega local em 21/10/2026, branch `codex/communities-v1`, sobre a Fase 4B (`5831720`). Nenhuma publicação, push, migration remota, distribuição de instalador ou alteração no atualizador. Comunidades continuam desligadas por padrão. Ganhos coletivos e verificador de missões não foram habilitados.

## Auditoria e escopo

Foram revisados os contratos das Fases 1–4B, o ledger coletivo, catálogo e desbloqueios imutáveis, permissões explícitas, Home e serviço `src/services/server-images.ts`. O catálogo 4B não continha ativos utilizáveis. A 4C acrescenta cinco ativos próprios em CSS/SVG, vinculados ao contrato de recompensas da comunidade, sem inventário individual paralelo. Não restaura o Progression V1 arquivado, altera XP individual/coletivo nem concede pontuação pelo frontend.

O serviço de imagens existente permanece intacto: bucket privado, URLs assinadas, formatos e permissões atuais. Os cosméticos são sobreposições; aplicar/remover não escreve em banner, experiência ou tema originais do servidor. A paleta cosmética fica limitada à Home, sem trocar o tema global da conta.

## Estatísticas realmente disponíveis

| Métrica                                              | Contrato e limite real                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Nível, XP e próximo limiar                           | Resumo backend existente da 4A; não recalculado pelo cliente                                                 |
| XP recebido no período                               | Soma do ledger imutável, série diária UTC e saldo ao fim do dia                                              |
| Histórico de concessões                              | Paginação por ID, 20 por página, máximo 50 por RPC                                                           |
| Missões concluídas                                   | Conclusões persistidas no intervalo; não contagem de missões preparadas                                      |
| Conquistas desbloqueadas                             | Desbloqueios persistidos no intervalo                                                                        |
| Membros atuais                                       | Contagem atual; não representa crescimento histórico                                                         |
| Eventos criados                                      | `created_at` dentro do intervalo e acesso permitido ao evento                                                |
| Eventos agendados                                    | Estado atual `scheduled` e início no intervalo; pode incluir data passada sem realização comprovada          |
| Eventos cancelados                                   | Estado atual cancelado e atualização no intervalo; não é uma série histórica de transições                   |
| Intenções de participação                            | RSVP atual `going` de eventos agendados visíveis com início no intervalo; não presença nem histórico de RSVP |
| Crescimento, eventos realizados, presença comprovada | Indisponíveis (`null`), pois faltam histórico confiável e autoridade de realização/presença                  |

Filtros de 7, 30 e 90 dias, limite backend de 93 dias, gráficos estáticos compactos, estados vazios/carregamento/erro e retorno à primeira página. Períodos são UTC, incluindo o dia atual. Eventos respeitam `can_view_community_event`: ser gestor da comunidade não permite inferir atividades de canais privados sem acesso. Não há nomes de participantes, rastreamento pessoal ou números estimados apresentados como reais.

## Cosméticos implementados

| Item              | Slot/ativo                     | Desbloqueio novo necessário    | Disponibilidade                                                           |
| ----------------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------- |
| Selo de fundação  | Selo SVG original              | Primeira ativação autorizada   | Utilizável quando efetivamente desbloqueado                               |
| Destaque limão    | Detalhe CSS estático           | Primeira ativação autorizada   | Utilizável quando efetivamente desbloqueado                               |
| Órbita violeta    | Paleta CSS limitada à Home     | Primeira publicação autorizada | Utilizável quando efetivamente desbloqueado                               |
| Horizonte orbital | Banner geométrico CSS original | Primeira publicação autorizada | Utilizável quando efetivamente desbloqueado                               |
| Moldura orbital   | Contorno CSS estático          | Missão semanal verificada      | Preparado, mas bloqueado enquanto ganhos/verificador estiverem desligados |

Não há concessão retroativa: os triggers observam apenas novos desbloqueios/conclusões posteriores à migration. Comunidades que já possuíam conquistas 4B não recebem itens ao instalar a 4C ou repetir ativação/publicação. Não houve backfill. Os marcos administrativos comprovam configuração/publicação autorizada, não qualidade, atividade legítima ou identidade humana. Seus itens são cosméticos comunitários sem XP, transferência ou valor econômico; não foi implementado pagamento/impulso.

A interface permite prévia, equipar e remover. O backend valida item, slot, vínculo do desbloqueio, versão e evidência correspondente; inserir um contrato de recompensa sem o objetivo real não basta. Recompensas de missão também exigem a fonte habilitada. Se ela for pausada, a aparência efetiva suprime a moldura; a seleção permanece preservada e removível.

## Segurança e migração

Migration incremental preparada: `supabase/migrations/20261021080000_community_statistics_cosmetics.sql`, aplicada somente a bancos descartáveis PostgreSQL locais.

- Acrescenta catálogo privado de renderização e seleção cosmética por servidor com RLS e acesso por RPC; reutiliza catálogo/desbloqueios públicos da 4B.
- Remove a restrição antiga que proibia qualquer item utilizável, sem alterar as linhas imutáveis já existentes.
- RPCs: `get_community_cosmetics`, `equip_community_cosmetic`, `get_community_statistics`.
- Estatísticas e alterações requerem proprietário ou cargo explicitamente autorizado com `manage_community`. Administrador genérico sem delegação não basta.
- Leitura da aparência exige comunidade ativa, associação válida e ausência de banimento. O cliente não concede cargos, XP ou desbloqueios.
- Equipar bloqueia servidor e seleção, revalida autoridade após espera, verifica revisão e disponibilidade sob locks de política/verificador. Edições concorrentes não sobrescrevem silenciosamente.
- Limite de alterações administrativas, auditoria atômica e rollback em falha de auditoria. Operação sem mudança não cria revisão artificial.
- Desativação preserva seleção, conquistas, missões e ledger. Não altera provedores de voz/captura.

Não há reversão destrutiva automática. Antes de eventual implantação futura, preparar backup e plano de reversão compatível com quaisquer novos desbloqueios; desligar a feature é o caminho inicial de contenção. Não executar a migration remotamente com base neste relatório.

## Interface e custo

Home preserva nível, missões, conquistas e slots existentes, adicionando identidade/selo e atalhos administrativos. Ferramentas também estão em Configurações da comunidade. Painel administrativo carregado sob demanda; cache de cosméticos compartilhado por usuário/servidor, sem polling, com descarte após desmontagem. Estatísticas consultadas somente ao abrir a aba autorizada, com chave por conta/servidor/período/página. Erros de equipagem provocam revalidação, sem publicar seleção otimista.

Ativos estáticos, sem nova animação, canvas, WebGL, processamento de vídeo ou efeitos dependentes de performance. Não foi medido CPU/GPU/memória, latência HTTP ou custo sob carga; a arquitetura leve não equivale a ganho de desempenho comprovado. Não há integração nova no Modo Desempenho porque os ativos não introduzem efeitos animados a desligar.

## Testes e evidências

| Verificação                             | Resultado                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Node, incluindo regressões existentes   | 270 aprovados; zero falhas, cancelados ou ignorados                                                                                             |
| PostgreSQL local, fases anteriores e 4C | Aprovado; RLS, proprietário/delegado, membro comum, administrador não delegado, estranho, permissões privadas, revisão, auditoria e preservação |
| Concorrência                            | 24 cenários no runner completo: 21 anteriores e 3 novos (revisão, revogação do cargo durante espera, desativação da fonte durante espera)       |
| Upgrade 4B → 4C                         | Conquistas anteriores preservadas; zero cosméticos retroativos                                                                                  |
| TypeScript                              | Aprovado (`npm run typecheck`)                                                                                                                  |
| ESLint dos arquivos alterados           | Zero erros/avisos na execução final                                                                                                             |
| Scanner de segurança                    | 737 arquivos verificados; zero achados                                                                                                          |
| Build WEB habilitado                    | Aprovado, com configuração pública fictícia somente de compilação                                                                               |
| Build Desktop habilitado                | Aprovado; sem empacotar/distribuir instalador                                                                                                   |
| Build WEB com flag padrão desligada     | Aprovado                                                                                                                                        |
| Interface real no navegador             | Home, catálogo, bloqueio, aplicação/remoção em memória, restauração do banner, período e estado vazio                                           |
| Responsividade                          | Capturas desktop e móvel; largura útil móvel 375 px e scrollWidth 375 px                                                                        |
| Console na conferência final            | Nenhum erro capturado                                                                                                                           |

Bancos retidos: `lobbyx_community_test_1792614467088` e `lobbyx_community_test_1792614467088_upgrade4b`, em PostgreSQL nativo exclusivo local. São testes SQL com contexto JWT sintético; **não são login GoTrue/PostgREST nem autenticação HTTP real**. Nenhum dado de produção foi utilizado.

Ocorrências corrigidas: um alias SQL reservado causou rollback da primeira tentativa; foi renomeado. Um teste Node esperava rejeição de um intervalo válido de 92 dias; a fixture foi corrigida para exceder 93 dias. Avisos de exportação mista e formatação foram corrigidos. As suítes finais passaram sem ignorar casos. As expectativas 4B de catálogo vazio foram atualizadas porque agora existem ativos reais; invariantes de missão, limites e autorização continuam verificadas.

Logs locais em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/community-4c-*.log` (SQL, Node, lint, typecheck, scanner e builds). O lint global com pendências legadas não é declarado aprovado; o escopo requerido foi o dos arquivos alterados.

### Capturas e prévia

Prévia funcional: `npm run preview:community-evolution` → `http://127.0.0.1:5212/`. Usa componentes reais, dados fictícios identificados, alterações só em memória, sem Supabase ou autenticação.

Capturas reais da renderização, em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/`:

- `community-4c-home.png`: Home com cosméticos e componentes de missões/conquistas.
- `community-4c-customization.png`: catálogo, quatro itens aplicados e moldura bloqueada.
- `community-4c-statistics.png`: filtro e métricas demonstrativas identificadas.
- `community-4c-empty.png`: período sem registros, preservando XP atual.
- `community-4c-mobile-home.png` e `community-4c-mobile-statistics.png`: layout móvel.
- `community-4c-restored.png`: banner original reaparece após remover seleções.

Essas capturas não comprovam uma sessão autenticada WEB ou EXE. Os números nelas são exclusivamente demonstrativos.

## Arquivos alterados

Novos: tipos/validação/serviço `community-evolution`, utilitário `community-appearance`, hook `use-community-cosmetics`, componentes `CommunityAppearance`, `CommunityEvolutionPanel`, `CommunityEvolutionTools`, `CommunityEvolutionViews`; migration 4C; testes Node/SQL/upgrade e harness `tests/community-evolution-preview/`; este relatório e guia operacional.

Integrações: `CommunityHome.tsx`, `CommunityWorkspace.tsx`, `SettingsCommunity.tsx`, tipos Supabase, `package.json`, runner SQL e expectativas incrementais de `tests/community-objectives.sql`. Nenhum código de voz, mensagens, captura ou atualizador foi modificado nesta entrega.

## Pendências reais para lançamento V1

1. Autenticação HTTP real e sessões WEB/EXE em ambiente isolado, incluindo troca de conta/servidor e revogação entre sessões. Não foram executadas nesta fase, sem GoTrue/PostgREST.
2. Upload autenticado/exibição de banner e renovação da URL assinada; serviço existente auditado, sem validação autenticada ponta a ponta nesta entrega.
3. Chamadas, mensagens, notificações, captura com áudio e reconexão entre clientes reais; testes unitários e builds não substituem esses cenários.
4. Fonte confiável de atividades, avaliação antifraude/Sybil e autorização específica antes de habilitar ganhos/verificador. Nenhuma fonte foi ativada.
5. Testes de carga, sessões prolongadas, perfil de CPU/GPU/memória e latência com comunidades grandes.
6. Avaliação visual/funcional do usuário, revisão de implantação e autorização separada de migrations/publicação. Não há recomendação de liberar produção antes dos testes críticos de integração.

A versão estável 0.1.58 e seus artefatos permanecem preservados. SHA-256 do instalador estável conferido: `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`. Aguardar avaliação da 4C, sem iniciar outra fase ou publicar automaticamente.
