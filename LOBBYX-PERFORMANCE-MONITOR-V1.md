# LobbyX — Performance Monitor V1

Data: 10/10/2026. Implementação local, sem deploy e sem migration em produção.

## Escopo e análise da arquitetura

Referências obrigatórias: `LOBBYX-PERFORMANCE-AUDIT-V1.md` e `LOBBYX-PERFORMANCE-OPTIMIZATION-V2.md`. A aplicação usa React/TanStack Router e Query, Supabase para autenticação, banco e Realtime, MeshVoiceProvider para WebRTC e Electron com preload isolado. As otimizações V2, as molduras existentes e o recurso Progression arquivado foram preservados. Não foram alterados protocolos, negociação, transporte, temporizadores ICE ou processamento de mídia.

Não existia autorização administrativa global nem infraestrutura de ingestão de telemetria. A V1 segura implementa **diagnóstico agregado da sessão local do administrador**, desativado por padrão. Ela não é ainda uma central de métricas de todos os usuários. Não há upload de métricas, endpoint de ingestão, armazenamento persistente ou nova infraestrutura paga. Histórico centralizado, comparações automáticas entre releases e monitoramento de outros dispositivos ficam pendentes.

## Arquitetura implementada

- Coletor separado em `src/services/performance`: vocabulário fechado, histogramas por minuto, plataforma, versão e Modo Desempenho. Sem atualização React a cada amostra.
- Interface em `src/components/performance`, rota `/performance-monitor`, link nas configurações de desempenho somente após autorização.
- Hooks leves nas operações já existentes de navegação, perfis, mensagens, notificações e cliente Supabase. Realtime usa a assinatura existente, preservando callbacks e encadeamento.
- WebRTC: sondagem somente de leitura via `getStats()` nas conexões existentes; nenhuma mídia ou sinalização é enviada ao monitor.
- Electron: `desktop/performance.cjs`, canal IPC limitado ao frame principal da janela confiável, cache de 30 segundos e identificação de amostra para evitar duplicatas. O preload não expõe Node nem acesso genérico ao processo.
- Supabase: somente RPC de autorização. Vercel continua utilizando a aplicação e configuração existentes.

O coletor amostra a cada 30 segundos enquanto habilitado e com documento visível. O RAF usa rajadas de um segundo aproximadamente a cada minuto. Long tasks usam PerformanceObserver quando suportado. Probes concorrentes do mesmo coletor são evitados; falhas são isoladas e não interrompem fetch, mensagens ou chamadas. Operações de uma geração anterior de coleta são descartadas após pausa, limpeza ou mudança de sessão.

## Definições das métricas e seus limites

| Grupo | Medição real | Limitação |
| --- | --- | --- |
| Navegação | beforeLoad até resolução do Router; troca de servidor até canais/membros disponíveis; canal até mensagens disponíveis; perfil até dados disponíveis | Não representa necessariamente pintura final da interface |
| Inicialização | entrada histórica DOMContentLoaded da Performance API | Não é o tempo até todo o LobbyX estar utilizável |
| Renderização | intervalos RAF amostrados e long tasks | Não é CPU/GPU por componente nem duração de cada commit React |
| Backend | fetch até headers de resposta, erros HTTP/rede; RPC unread completo incluindo leitura/normalização | Rede e serviço estão combinados; sem Server-Timing não há atribuição de processamento ao servidor |
| Notificações | invalidação/revalidação do cache de não lidas | Não é o tempo de entrega ponta a ponta de uma mensagem |
| Realtime | falha/timed out e ressubscrição depois de interrupção | SUBSCRIBED repetido não conta como reconexão; fechamento intencional não é erro |
| Autenticação | requisições HTTP de auth durante coleta | Não armazena tokens; não oferece auditoria global de logins |
| WebRTC | conexão iniciada com monitor habilitado, RTT do par selecionado, jitter de áudio, perda incremental, falhas ICE/desconexões, direto/relay, FPS outbound de tela | Ausência de stats é ausência de dado; não prova falha do servidor. Contadores de pacotes são reiniciados após pausa |
| Recursos | Electron soma CPU dos próprios processos e memória privada, com fallback working set; WEB heap JS quando disponível | Heap não é RAM total do navegador. GPU% não está disponível nesta V1 |
| Molduras/modos | comparação dos mesmos indicadores por modo normal/optimized/maximum | Não atribui automaticamente custo a uma moldura específica; benchmarks isolados dão esse contexto |

Histogramas limitados: valores finitos entre 0 e 1.000.000, no máximo 1.000.000 amostras por bucket; 2.048 linhas e sete dias, prevalecendo o limite atingido primeiro. P50/P95 são **limites superiores aproximados dos buckets**, não percentis exatos. Média, máximo, contagem e taxa de erros vêm das amostras agregadas. Gráficos mostram apenas minutos observados, sem inventar preenchimento. Filtros incluem funcionalidade, plataforma, versão e modo. WEB sem `VITE_APP_VERSION` aparece como unknown; Electron usa a versão real do aplicativo.

As janelas 5 minutos, 1 hora, 24 horas e 7 dias consultam somente dados disponíveis desta sessão. Recarregar, sair ou mudar de conta limpa a coleta. Pausar interrompe sondagens; limpar também redefine a deduplicação de alertas.

## Alertas

Limites configuráveis por sessão. Defaults: unread 1.500 ms, navegação 700 ms, RAF 50 ms, RTT 250 ms, memória 1.000 MiB. Necessitam cinco amostras e pelo menos dois minutos realmente problemáticos nos últimos três minutos. Erros repetidos também disparam com taxa ≥10%, mesmo sem limite de latência. Cooldown de cinco minutos por métrica; a tela mantém até 20 alertas.

Ainda não implementados: detecção automática de crescimento de memória, desvio contra baseline histórico e regressão entre releases. Limite absoluto de memória e filtro por versão não equivalem a esses algoritmos. Alertas são avaliados quando o painel está aberto e visível; não há serviço de alertas em segundo plano ou notificações externas.

## Segurança, acesso e privacidade

Migration preparada: **`supabase/migrations/20261010030000_performance_monitor_admin.sql`**, aplicada somente em PostgreSQL local descartável durante os testes. A tabela `performance_admins` começa vazia, com RLS e sem SELECT/INSERT/UPDATE/DELETE para anon/authenticated. Não há autoconcessão a donos ou administradores de servidores.

A RPC `is_performance_admin()` não recebe UUID arbitrário, usa auth.uid(), SECURITY DEFINER e search_path fixo. Só retorna booleano para o próprio usuário autenticado. A rota verifica o backend antes de renderizar; ausência da RPC, resposta inválida ou erro negam acesso. Autorização é revalidada a cada minuto visível durante coleta; revogação desativa e limpa o monitor. Nenhum dado centralizado é acessível por outro endpoint.

Provisionamento futuro, exclusivamente por SQL privilegiado e após aprovação:

```sql
insert into public.performance_admins(user_id)
values ('UUID_AUTORIZADO') on conflict do nothing;
-- Revogação:
delete from public.performance_admins where user_id = 'UUID_AUTORIZADO';
```

Não se retêm nomes, e-mails, IDs de usuário/servidor/canal/peer/processo, URLs de requests, IPs, cabeçalhos, corpos, tokens, mensagens, SDP, áudio, vídeo ou conteúdo de tela. Os identificadores das métricas são técnicos e predefinidos; versões precisam de formato válido. Exceções do monitor são descartadas. As fixtures usam participantes e mídia sintéticos sem Supabase remoto; seus arquivos de benchmark são locais e não representam uma exportação de dados de usuários.

## Validação e resultados

Resultados finais e metodologia constam também em `docs/performance-monitor-v1/summary.json`; arquivos brutos nessa pasta e `tests/monitor/summarize.mjs` permitem repetir os cálculos. Percentis abaixo são nearest-rank exatos dos ensaios, diferentes dos limites aproximados do painel.

### WEB — coleta desligada / ligada

| Perfis | Render p95 desligado / ligado (ms) | RAF p95 desligado / ligado (ms) |
| --- | --- | --- |
| 10 | 3,4 / 8,4 | 39,3 / 33,4 |
| 50 | 9,8 / 10,2 | 66,5 / 44,7 |
| 100 | 12,3 / 17,0 | 83,4 / 155,6 |

Cada render tem 20 amostras. Conexão de voz: 974,5 / 992,4 ms; conexão do cenário com tela: 974,3 / 1.092,5 ms; ativação da tela: 57,4 / 46,7 ms. AudioContexts running em ambos os braços; zero erros RTC registrados e zero peers abertos após cleanup. Desligado: zero agregados. Ligado: 4 conexões, 8 RTT, 8 amostras direto, 9 jitter, 4 perda e 1 FPS de tela, além de heap/long tasks/RAF. Os 100 perfis pioraram no ensaio ligado: **não se considera validado baixo overhead total no WEB** com esse único par.

### Electron — coleta desligada / ligada

| Fase | n desligado / ligado | CPU média desligado / ligado (%) | Working set médio desligado / ligado (MiB) |
| --- | --- | --- | --- |
| Visual | 14 / 14 | 1,50 / 2,11 | 380,71 / 380,75 |
| Voz | 4 / 4 | 4,46 / 8,43 | 552,08 / 570,63 |
| Tela + áudio | 2 / 2 | 4,24 / 4,15 | 595,95 / 604,55 |

CPU p95, desligado / ligado: visual 5,37 / 10,20%; voz 7,88 / 17,20%; tela 4,47 / 4,29%. Working set p95: visual 413,52 / 410,65 MiB; voz 573,52 / 582,55 MiB; tela 601,21 / 605,29 MiB. A primeira conexão de voz levou 1.998,6 / 2.391,8 ms; o cenário posterior com tela, 150,7 / 111,1 ms. As diferenças entre primeira e segunda conexão mostram forte efeito de aquecimento. Todos os AudioContexts running, nenhum erro RTC e zero peers após cleanup. Uma amostra CPU/RAM nativa única foi registrada pelo monitor, sem duplicar o cache de 30 segundos. Versão do wrapper é a do runtime Electron, não uma nova release LobbyX.

**Overhead total inconclusivo:** CPU de voz foi maior no braço ligado; n=4 e sondagens aceleradas não permitem excluir regressão nem atribuir causalidade. O observador externo e o monitor usam getAppMetrics no braço ligado, podendo influenciar os intervalos de medição. Requer execuções alternadas repetidas, janela visível e chamadas longas com intervalo de produção antes de liberar coleta global. A funcionalidade permanece opt-in, local e desativada por padrão.

### Verificações técnicas

- Suite completa: **180/180 testes passaram**. Após os últimos ajustes, 13/13 testes específicos do monitor passaram novamente.
- Typecheck: passou. Lint: zero erros, 47 avisos (inclui avisos de fast refresh em fixtures).
- Builds WEB e Electron (`desktop:build`): passaram. Security scan do build: 523 arquivos, zero findings. Build não é teste do instalador `.exe`. Testes SQL com todas as migrations em banco local novo: passaram, incluindo administrador autorizado, usuário comum/dono de servidor negado, autoconcessão/leitura de allowlist negadas, revogação e anon negado.
- IPC, preservação de fetch/callback Realtime, vocabulário privado, limites, retenção, alertas persistentes/cooldown e geração de operações: testes passaram.
- Fixture visual: dez GETs locais reais, n=10, média 44,53 ms, p50 ≤50 e p95 ≤100 ms; nenhum dado inventado. Temas claro/escuro conferidos, filtro Electron vazio no WEB e pausa funcionais. Viewports 390 e 320 px sem overflow horizontal (scrollWidth ≤ innerWidth). Capturas em `docs/performance-monitor-v1/panel-{dark,light,mobile,mobile-320}.png`.
- Não foi feita validação E2E do painel com conta real via Supabase/PostgREST, nem atualização do instalador. Autorização foi validada tecnicamente em SQL e na rota real com mocks de respostas.

O microbenchmark do núcleo alterna seis execuções desligadas e seis ligadas, com 50.000 registros por execução. Mediana ligada: 80,37 ms, aproximadamente **1,61 µs por registro**; desligada: 2,08 ms, aproximadamente 0,042 µs. Isso mede somente o núcleo em Node e um bucket, não overhead total do aplicativo nem capacidade máxima.

Fixtures WEB/Electron compiladas para produção usam os componentes reais IllustratedFrame/FlamingCutFrame e MeshVoiceProvider, sinalização em memória e mídia sintética local. Mesmo cenário normal com 10/50/100 perfis, 20 atualizações cada, três segundos de RAF e chamada de duas pontas com e sem tela. As fixtures aceleram algumas sondagens para obter stats dentro do ensaio curto; a aplicação continua com intervalo de 30 segundos. Electron usa janela oculta com backgroundThrottling false; isso não substitui ensaio de janela visível, WAN ou chamada longa. O wrapper externo mede CPU/working set a cada segundo em ambos os braços; não faz parte da coleta de produção.

O primeiro WEB automático teve AudioContexts suspensos por autoplay e foi excluído da comparação, preservado em `web-off-initial-autoplay-blocked.json`. Os ensaios válidos WEB partem de clique explícito, com AudioContexts running. Um problema inicial do wrapper Electron com userData relativo foi corrigido para diretório temporário absoluto; não afetava o LobbyX instalado. Os perfis temporários permanecem locais.

Não há alegação de ganho causal com um único par: GC, aquecimento, janela oculta e variação de carga do Windows podem dominar diferenças pequenas. Não foram executadas chamadas reais entre usuários de outras redes, benchmark GPU, teste prolongado de vazamento ou instalador atualizado.

## Arquivos desta implementação

Criados: `desktop/performance.cjs`; `src/services/performance/{core.mjs,core.d.mts,monitor.ts,access.ts}`; `src/components/performance/{PerformanceMonitorPanel.tsx,PerformanceInstrumentation.tsx,AdminMonitorLink.tsx}`; `src/routes/_authenticated/performance-monitor.tsx`; migration administrativa; `tests/performance-monitor.test.mjs`; `tests/performance-monitor-access.sql`; `tests/monitor/` (fixtures, benchmark do núcleo e wrapper Electron); este relatório e evidências em `docs/performance-monitor-v1/`.

Modificados para integração: `desktop/main.cjs`, `desktop/preload.cjs`, `src/services/desktop-activity.ts`, `src/services/voice.ts`, `src/services/unread.ts`, `src/integrations/supabase/client.ts`, `src/hooks/use-unread.ts`, `src/routes/__root.tsx`, `src/routes/_authenticated/app.tsx`, `src/routeTree.gen.ts`, `src/components/settings/PerformanceSettings.tsx`, `src/components/chat/ChatView.tsx`, `src/components/gamer/ProfileDialog.tsx`; mocks em `tests/audio/pipeline-fixture.mjs` e `tests/voice-negotiation.test.mjs`; `scripts/test-security-db.mjs`; `eslint.config.js` para excluir outputs gerados das fixtures. Outros arquivos alterados no checkout pertencem às notificações/V2 anteriores e não foram revertidos.

## Reproduzir localmente e preparar publicação

Na raiz do repositório:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run desktop:build
npx vite build --config tests/monitor/vite.config.mjs
npx vite preview --config tests/monitor/vite.config.mjs --host 127.0.0.1 --port 5194 --strictPort
```

Abrir `/tests/monitor/panel.html` nesse localhost para a fixture visual (sem autenticação e explicitamente identificada; não faz parte do build publicado). Ativar coleta e clicar “Medir 10 requests locais reais”. `/tests/monitor/index.html?monitor=on` e `?monitor=off` executam os cenários; clicar Executar medições e aguardar o JSON. O painel real `/performance-monitor` exige autenticação, migration em ambiente autorizado e UUID previamente autorizado no backend.

```powershell
node tests/monitor/overhead.mjs
& ./node_modules/electron/dist/electron.exe tests/monitor/desktop-fixture.cjs docs/performance-monitor-v1/electron-off.json off
& ./node_modules/electron/dist/electron.exe tests/monitor/desktop-fixture.cjs docs/performance-monitor-v1/electron-on.json on
```

Executar os braços sequencialmente, sem build/testes simultâneos. `npm run security:db` requer PG_BINDIR de PostgreSQL local e porta 55448; o script aceita somente host local e cria banco de teste novo. A simulação SQL de auth não substitui E2E com autenticação real e PostgREST em staging.

Sem variáveis secretas novas e sem dependências novas. `VITE_APP_VERSION` é opcional e público, somente para rotular a versão WEB. Electron deve ser recompilado para disponibilizar CPU/RAM; versões anteriores mostram indisponibilidade sem erro. Custos adicionais V1: uma RPC booleana por minuto enquanto coleta administrativa estiver visível e consulta de autorização nas configurações; nenhum armazenamento de telemetria.

Antes de publicar: aprovação explícita da migration e dos administradores autorizados; teste da rota com contas reais autorizada/não autorizada/revogada; validação WEB e instalador Electron visível em staging, chamada longa e WAN; definição de versão WEB. Frota centralizada exigirá ingestão autenticada com validação/rate limit, agregação, retenção/purga, orçamento de storage e política de coleta aprovada. Nada disso foi introduzido silenciosamente nesta V1.
