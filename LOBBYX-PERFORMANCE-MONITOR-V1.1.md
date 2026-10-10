# LobbyX — Performance Monitor V1.1

10/10/2026. Refinamento local antes da publicação. Referência: `LOBBYX-PERFORMANCE-MONITOR-V1.md`, mantendo Performance Optimization V2.

## Investigação e diagnóstico

O aumento de CPU de voz da V1 (4,46% desligado / 8,43% ligado, apenas quatro amostras) não demonstrava causalidade. Encontramos um defeito verificável na medição: tanto o monitor nativo quanto o wrapper de benchmark chamavam `app.getAppMetrics()`. O `percentCPUUsage` usa o intervalo desde a última chamada dessa API, e qualquer chamador o reinicia. O valor podia representar intervalos diferentes entre braços. A primeira leitura também aparecia como zero, embora não houvesse ainda um intervalo comparável.

Correção: tanto o benchmark quanto o monitor agora calculam diferenças de `cumulativeCPUUsage`, com seus próprios relógios monotônicos. O cálculo do benchmark usa um segundo entre suas leituras; o do monitor usa aproximadamente 60 segundos entre as próprias leituras. A leitura de outro chamador não altera o acumulado. Primeira leitura, acumulado indisponível, reiniciado ou processo encerrado retornam ausência de dado, sem fabricar CPU zero. Um processo comprovadamente criado dentro do intervalo contribui com seu acumulado de vida; a comparação exige relógios coerentes e creationTime conhecido. PIDs/creationTime são apenas chaves transitórias internas; nenhum identificador sai pelo IPC ou entra na telemetria.

Fonte primária: [Electron CPUUsage](https://www.electronjs.org/docs/latest/api/structures/cpu-usage). Isso comprova o defeito de medição, **não comprova que todo o aumento anterior era apenas esse defeito**. Aquecimento, GC, pintura das molduras, captura sintética e variação do Windows continuam hipóteses relevantes.

## Refinamentos implementados

| Operação | V1 | V1.1 |
| --- | --- | --- |
| Coleta CPU/RAM/heap | 30 s | 60 s |
| Cache nativo | 30 s | 30 s; CPU por acumulado, solicitado pelo renderer a cada ~60 s |
| WebRTC getStats | 30 s | 30 s, preservado |
| RAF | 1 s a cada 60 s | 1 s a cada 120 s; sem rajada durante ativação inicial |
| Atualização do painel | 5 s | 10 s |
| Conexão/ICE/Realtime/HTTP/navegação | Eventos existentes | Eventos existentes, preservados |

O sampler impede chamadas concorrentes ao bridge nativo e descarta respostas de outra geração/ocultação. Falhas da instrumentação continuam isoladas. Coleta desativada por padrão; sem alterações em RLS, autorização administrativa, ingestão global ou transporte WebRTC. Nenhum caminho de áudio, SDP, ICE, negociação, compartilhamento, mensagens ou cache V2 foi alterado nesta etapa.

A primeira série refinada detectou uma falha de coordenação: cache nativo de 60 s e cadência de 60 s podiam reutilizar a leitura anterior na fronteira de tempo, descartando a segunda amostra. Essa série foi preservada em `docs/performance-monitor-v1.1/intermediate-cache-boundary/` e excluída da comparação final. A correção mantém cache nativo de 30 s, cadência do renderer de aproximadamente 60 s e tolerância de 1 s na fronteira de agendamento. A série final repete integralmente os quatro ensaios após essa correção.

O percentual de CPU calculado equivale a porcentagem de **um núcleo lógico**, somando os próprios processos; pode ultrapassar 100% e não deve ser comparado diretamente ao percentual total normalizado do Gerenciador de Tarefas. RAM do benchmark é working set somado em MiB, enquanto o painel continua usando memória privada com fallback. Sem GPU%, gravação de mídia ou coleta de usuários.

## Método controlado antes/depois

Foi congelado o bundle V1 e seu coletor nativo em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/monitor-v11-baseline`, antes de mudar o runtime. SHA256 do coletor nativo V1: `F897ED5BBBD16F1F396DCC03DAC6BE82588A419F9315AF26701A06D34849E48E`. É uma cópia para benchmark, não restauração do código da aplicação.

Antes e depois utilizam a mesma fixture, ordem **desligado → ligado → ligado → desligado** (dois pares com ordem invertida), perfil Electron novo por execução, 10/50/100 perfis, 20 atualizações por tamanho, três segundos de RAF e chamadas de duas pontas. Voz permanece 45 segundos e tela/áudio 35 segundos, usando o intervalo real de produção. Não há `sampleMonitorNow()` forçado nesses ensaios. O observador externo coleta uma vez por segundo em ambos os braços e usa acumulados, não o percentual compartilhado.

Para CPU estável de chamada, excluem-se os primeiros cinco segundos de cada fase; o restante é mantido. Cada execução tem o mesmo peso na média, evitando que uma execução mais longa domine. p95 do render/RAF usa nearest rank. Amostras por segundo são correlacionadas; duas execuções por braço não são uma prova estatística universal.

Limitações iguais nos braços: janela Electron oculta 1280×720 com backgroundThrottling false, sinalização em memória, áudio de oscilador e vídeo de canvas, sem Supabase remoto/STUN/TURN/dispositivos reais. A chamada mantém os perfis animados da fixture montados; CPU da fase não é CPU exclusivamente de áudio. O canvas sintético também é desenhado durante a fase de voz, como na V1. Não houve mudança desse cenário entre braços. Compositor oculto não valida fluidez Electron em primeiro plano. Máquina compartilhada com aplicações habituais abertas; builds e suites não executam simultaneamente aos ensaios.

Arquivos brutos, ordem e horários: `docs/performance-monitor-v1.1/*-manifest.json` e `baseline-*-*.json` / `refined-*-*.json`. Agregação reproduzível: `node tests/monitor/summarize-refinement.mjs` → `summary.json`.

## Resultados

Oito execuções Electron válidas, quatro V1 e quatro V1.1, com 94 leituras externas por execução. Valores abaixo são médias das médias das duas execuções por condição, não medições instantâneas. CPU = percentual de um núcleo lógico somado; RAM = working set somado em MiB. O relatório V1 original permanece intacto; seus percentuais antigos não são diretamente comparáveis a esta unidade/método.

| Cenário | V1 CPU off/on | V1.1 CPU off/on | V1 RAM off/on | V1.1 RAM off/on |
| --- | --- | --- | --- | --- |
| 10/50/100 perfis | 9,44 / 9,20 | 9,40 / 8,94 | 383,26 / 382,69 | 384,12 / 382,47 |
| Voz, fase estável | 19,97 / 19,14 | 19,23 / 19,02 | 571,69 / 571,26 | 573,10 / 572,38 |
| Tela + áudio, fase estável | 40,47 / 39,30 | 39,22 / 41,23 | 607,64 / 604,45 | 606,50 / 609,03 |

**Comprovado neste cenário:** a duplicação de CPU da medição antiga não foi reproduzida, nem na V1 congelada usando o método corrigido. Voz V1.1 on − off = −0,22 ponto percentual; RAM = −0,71 MiB. Isso é variação observada, **não ganho de CPU comprovado**. Tela V1.1 on − off = +2,01 pontos (+5,12% relativo) e +2,52 MiB: não ocultar esse resultado nem afirmar overhead zero. GC, compositor, canvas e variação entre execuções são hipóteses; o ensaio não os isolou.

Todas as chamadas sintéticas completaram, AudioContexts ficaram running e todos os peers foram fechados ao terminar. Os snapshots técnicos estão em `summary.json`. Isso confirma conexão/recepção/limpeza na fixture, não audibilidade subjetiva, ausência universal de cortes ou estabilidade entre redes reais.

Renderizações Electron: média do p95 de cada execução (ms):

| Perfis | V1 off/on | V1.1 off/on |
| --- | --- | --- |
| 10 | 0,80 / 0,65 | 0,85 / 0,80 |
| 50 | 1,00 / 1,10 | 1,15 / 0,95 |
| 100 | 1,45 / 1,25 | 1,35 / 1,25 |

São atualizações da fixture com flushSync; não representam o tempo completo de navegação autenticada. Nenhuma regressão consistente de render apareceu nesse cenário. Os componentes das molduras permaneceram idênticos.

RAM/heap do coletor refinado chegaram duas vezes por execução ligada, contra três na V1. As métricas RTC mantiveram suas cadências. CPU nativa do painel ficou ausente no primeiro intervalo nas execuções curtas; essa ausência é apresentada explicitamente e não substituída por zero. A verificação real de IPC sandboxed, separada da comparação, retornou CPU null na primeira leitura e aos 61 s, e CPU válida de 0,083% aos 122 s; memória também chegou nas três leituras. `native-runtime.json` comprova disponibilidade após estabilização, não overhead ou consumo de uma chamada. Isso exige indicar ausência temporária no painel durante inicialização/troca de processos. RAF Electron oculto ficou aproximadamente em 1 s entre frames devido ao compositor: esse valor não comprova fluidez em primeiro plano.

O efeito de CPU de tela compartilhada também mudou de sinal entre os pares refinados: −0,41 ponto no primeiro e +4,42 no segundo. Logo, a média de +2,01 não demonstra causalidade, mas exige ensaios adicionais; reduzir sondagens não autoriza prometer redução equivalente de CPU.

Validações: 183/183 testes, typecheck e build WEB/Desktop passaram; lint sem erros, com 47 avisos existentes. O teste de cadência inclui fronteira de 59,99 s, inatividade/ocultação, exclusão de CPU indisponível e RTC preservado. `git diff --check` passou. Hashes de cinco arquivos críticos da V2 permanecem idênticas. Os logs completos estão no diretório de evidências.

Após acrescentar a fronteira temporal ao teste e formatar as fixtures, a suíte focada passou 16/16 novamente e o lint manteve 0 erros/47 avisos. Scanner de segurança: 554 arquivos examinados, nenhum finding. Isso não equivale a provar ausência de toda vulnerabilidade. Nenhum teste foi omitido por falha conhecida.

### WEB e interface local

Oito execuções WEB adicionais, ABBA em cada versão, iniciadas por clique para permitir AudioContext running; todas concluíram sem rtcError e com zero peers abertos após cleanup. A fixture curta força duas sondagens para exercitar a instrumentação; portanto, serve para render/RAF e contratos, **não para comparar CPU da cadência sustentada de produção**. Não houve medição confiável de CPU/RAM total WEB; heap do navegador não equivale à RAM do aplicativo. As execuções tinham document.hidden false. A verificação adicional de disponibilidade IPC, de baixo trabalho, coincidiu com parte do baseline WEB e não integra a comparação de CPU Electron; a máquina não estava dedicada.

Média dos p95 por execução, em ms:

| Perfis | Render V1 off/on | Render V1.1 off/on | RAF V1 off/on | RAF V1.1 off/on |
| --- | --- | --- | --- | --- |
| 10 | 0,85 / 0,90 | 1,15 / 0,90 | 14,00 / 16,65 | 16,65 / 16,60 |
| 50 | 1,65 / 1,70 | 1,60 / 1,75 | 22,25 / 19,55 | 22,30 / 22,20 |
| 100 | 2,45 / 2,70 | 2,95 / 2,45 | 22,40 / 22,40 | 22,30 / 25,10 |

Com 100 perfis, RAF refinado ligado teve média do p95 2,80 ms maior que desligado; suas duas execuções foram 22,30 e 27,90 ms. Não há base para prometer nenhuma perda de fluidez. Repetições longas em primeiro plano, hardware dedicado e coleta real a cada 30/60/120 s continuam pendentes. Não alteramos as molduras para mascarar resultados. Valores individuais e número de frames estão em `summary.json`, `webGroups`/`webRuns` e JSONs brutos.

Recarregamento da fixture de painel confirmou coleta inicialmente desligada e nenhuma amostra. Após ativar e medir dez requests HTTP reais ao localhost, selecionar backend.request exibiu n=10, média 6,01 ms, erro 0%, P50 ≤10 ms/P95 ≤20 ms (histogramas), máximo 13,60 ms. Filtro e pausa funcionaram; não houve overflow horizontal na viewport observada de 651 px (scrollWidth 636 px). Captura: `docs/performance-monitor-v1.1/panel-v1.1.png`. É a UI do componente real sem login, não o E2E da rota autenticada. A coleta ficou pausada ao concluir.

## Segurança, staging e limites de conclusão

O usuário confirmou que **não existe staging preparado**. Portanto, não foi testado o painel autenticado com contas reais. A rota real mantém RPC de autorização antes de renderizar e revalidação/revogação; testes locais de rota/IPC e SQL da V1 constituem evidência técnica, mas não substituem E2E em Supabase/PostgREST real. Sem autoconcessão por cargo de servidor, sem alteração de allowlist e sem migration nova.

Não foi realizado push, deploy, release ou migration em produção; nenhuma telemetria global foi adicionada. O monitor é opt-in da sessão local do administrador. Históricos, retenção e vocabulário privado da V1 permanecem. Progression continua arquivado.

Pendências: staging autenticado (conta permitida, negada e revogada), janela Electron visível e instalação real, chamada longa entre redes diferentes, reprodução com hardware intermediário dedicado, alternância prolongada de canal/tela, interferência de outras aplicações e intervalos de captura mais longos. Nenhum teste local permite garantir ausência de interrupção em todas as redes ou atribuir uma falha ao servidor.

## Arquivos e reprodução

Runtime modificado nesta etapa: `desktop/performance.cjs`, `src/services/performance/monitor.ts`, `src/services/desktop-activity.ts`, `src/components/performance/PerformanceMonitorPanel.tsx`. Testes: `tests/performance-monitor.test.mjs`, `tests/monitor/harness.tsx`, `tests/monitor/desktop-fixture.cjs`, `tests/monitor/native-runtime-fixture.cjs`, `tests/monitor/run-series.mjs`, `tests/monitor/summarize-refinement.mjs`; relatório e evidências locais. As hashes em `preserved-v2-hashes.json` e `preserved-v2-verification.json` verificam que molduras, mensagens, auth e serviço de voz não foram editados durante este refinamento.

Na raiz do repositório, construir a fixture e iniciar preview local como descrito na V1. Para repetir a comparação, usar um diretório novo de resultados ou preservar/mover os resultados existentes primeiro; o runner recusa sobrescrever amostras. O baseline congelado deve ser servido na porta 5195, o refinado na 5194. `node tests/monitor/run-series.mjs baseline` e depois `node tests/monitor/run-series.mjs refined`, sequencialmente. Nenhum benchmark deve executar junto com build/typecheck/testes ou contra produção.

Não há dependências, serviços pagos, secrets ou variáveis de produção novos. As variáveis `MONITOR_FIXTURE_*` são exclusivas das fixtures locais. Publicação continuará dependente de autorização explícita e das validações pendentes.
