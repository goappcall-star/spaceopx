import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
const scratch = process.argv[2];
if (!scratch) throw Error("Provide local measurements directory");
const out = "docs/performance-optimization-v2";
await mkdir(out, { recursive: true });
const names = [
  "v2-db-before",
  "v2-db-after",
  "v2-db-details",
  "v2-web-before",
  "v2-web-after",
  "v2-electron-after",
  "v2-hydration",
];
const raw = {};
for (const name of names) {
  raw[name] = JSON.parse(await readFile(`${scratch}/${name}.json`, "utf8"));
  await copyFile(`${scratch}/${name}.json`, `${out}/${name}.json`);
}
const electronBefore = JSON.parse(
  await readFile("docs/performance-audit-v1/audit-electron-final.json", "utf8"),
);
const stats = (a) => {
  const s = [...a].sort((a, b) => a - b),
    q = (p) => s[Math.ceil(s.length * p) - 1];
  return {
    n: s.length,
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    p50: s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2,
    p95: q(0.95),
    p99: s.length >= 100 ? q(0.99) : null,
    max: s.at(-1),
  };
};
const f = (n) => (n === null ? "—" : n.toFixed(2));
const summary = { sql: [], web: [], electron: [], hydration: [] };
for (let i = 0; i < raw["v2-db-before"].measurements.length; i++) {
  const a = raw["v2-db-before"].measurements[i],
    b = raw["v2-db-after"].measurements[i];
  summary.sql.push({
    operation: a.operation,
    users: a.users,
    before: stats(a.samplesMs),
    after: stats(b.samplesMs),
    errorsBefore: a.errors?.length ?? 0,
    errorsAfter: b.errors?.length ?? 0,
  });
}
for (let i = 0; i < raw["v2-web-before"].samples.length; i++) {
  const a = raw["v2-web-before"].samples[i],
    b = raw["v2-web-after"].samples[i];
  summary.web.push({
    mode: a.mode,
    users: a.users,
    before: {
      render: stats(a.renderMs),
      raf: stats(a.frameIntervalsMs),
      nodes: a.nodes,
      heapMiB: a.heapAfter / 1048576,
      writes: a.pathWrites,
    },
    after: {
      render: stats(b.renderMs),
      raf: stats(b.frameIntervalsMs),
      nodes: b.nodes,
      heapMiB: b.heapAfter / 1048576,
      writes: b.pathWrites,
    },
  });
}
for (const phase of ["visual", "voice", "screen-audio"])
  for (const mode of ["normal", "optimized"]) {
    const get = (d) => {
      const rows = d.metrics.filter((x) => x.phase === phase && x.mode === mode);
      return {
        cpu: stats(rows.map((r) => r.processes.reduce((s, p) => s + p.cpu, 0))),
        peakWorkingMiB: Math.max(
          ...rows.map((r) => r.processes.reduce((s, p) => s + p.workingSetKiB, 0) / 1024),
        ),
      };
    };
    summary.electron.push({
      phase,
      mode,
      before: get(electronBefore),
      after: get(raw["v2-electron-after"]),
    });
  }
for (const r of raw["v2-hydration"].samples)
  summary.hydration.push({
    stage: r.stage,
    kind: r.kind,
    ...stats(r.samplesMs),
    requests: r.requests,
  });
const caught = stats(raw["v2-db-details"].samplesMs);
await writeFile(`${out}/summary.json`, JSON.stringify({ ...summary, caughtUp: caught }, null, 2));
const lines = [
  "# LOBBYX — PERFORMANCE OPTIMIZATION V2",
  "",
  "Data: 09/10/2026. Referência obrigatória: [LOBBYX-PERFORMANCE-AUDIT-V1.md](LOBBYX-PERFORMANCE-AUDIT-V1.md). Alterações e migrations apenas locais. Nenhum push, release ou deploy. Progression V1 permaneceu arquivado.",
  "",
  "## Resultado",
  "",
  "O gargalo principal da contagem de não lidas foi corrigido e validado no banco fictício com RLS: autorização por canal calculada uma vez por statement, em vez de repetir por mensagem. A RPC continua SECURITY INVOKER. No ensaio pareado, seu p95 caiu de " +
    f(summary.sql[1].before.p95) +
    " para " +
    f(summary.sql[1].after.p95) +
    " ms (" +
    f((1 - summary.sql[1].after.p95 / summary.sql[1].before.p95) * 100) +
    "% de redução). Depois de ler tudo, o p95 do corpo SQL ficou em " +
    f(caught.p95) +
    " ms; o histórico já lido deixa de ser varrido.",
  "",
  "As molduras mantêm assets, cores, trajetórias, três rastros de quatro camadas da Corte Flamejante, filtros e frequência de 30 fps. A geometria é compartilhada por tick; React.memo evita reconstruir overlays com propriedades iguais. IllustratedFrame deixa de montar a máscara metálica que só Imperial utiliza. Em 100 perfis, o p95 de atualização React caiu de " +
    f(summary.web[2].before.render.p95) +
    " para " +
    f(summary.web[2].after.render.p95) +
    " ms e o RAF p95 de " +
    f(summary.web[2].before.raf.p95) +
    " para " +
    f(summary.web[2].after.raf.p95) +
    " ms. Com 50 perfis, o RAF ficou praticamente igual. O custo de pintura dos filtros não está completamente resolvido.",
  "",
  "Interface: sweeps de ocupação com conteúdo igual conservam a referência do contexto; nenhuma alteração no transporte, timers de reconexão, ICE ou arquitetura WebRTC. Perfil do usuário usa a mesma query no guard e no AuthProvider, com validade de 30 s; getUser continua sendo verificado em cada navegação. Eventos SIGNED_IN repetidos não invalidam todo o aplicativo. Consultas de autores, replies e reações passam a executar em paralelo em chats públicos e privados.",
  "",
  "## Método e comparação com V1",
  "",
  "- Mesmo computador Windows/Ryzen 5 4500, Node 24.14.1 e runtime Electron 44.4.5. Máquina não dedicada; outras aplicações habituais permaneceram abertas.",
  "- SQL pareado: mesmo banco local " +
    raw["v2-db-before"].database +
    ", 100 usuários fictícios, 10 canais, 10 mil mensagens. Executamos V1, aplicamos somente a nova migration nesse banco e repetimos exatamente as consultas/cargas 10/50/100 do harness. Nenhum serviço hospedado recebeu carga ou escrita.",
  "- WEB pareado: primeiro o build de produção V1 já existente, depois build V2 dos mesmos componentes/harness; mesma janela e cenários. Cada cenário tem 20 atualizações síncronas de contadores e 3 s de RAF. Somente os overlays visíveis animam; 100 montados não significa 100 visíveis.",
  "- Electron: comparação com a coleta V1 arquivada, seguida de nova coleta V2 sequencial. Janela oculta 1280×720, backgroundThrottling false, mídia sintética e sinalização em memória. RAF fica próximo de 1 Hz pelo compositor; não serve para avaliar fluidez em primeiro plano.",
  "- p50 é mediana; p95/p99 usam nearest rank; p99 apenas com n ≥ 100. Frames e amostras CPU 1 Hz são correlacionados. Foram mantidos ordem de execução e aquecimento do harness; A/B alternado com várias repetições continua necessário para estimar variabilidade.",
  "- Os valores pareados V1 desta sessão diferem da primeira auditoria por aquecimento e condições do host. Por exemplo, RPC p95 V1 original 1.109,84 ms; V1 repetido " +
    f(summary.sql[1].before.p95) +
    " ms. Não comparamos seletivamente o pior baseline com o melhor V2.",
  "",
  "## 1. Notificações e RLS",
  "",
  "Migration preparada: `supabase/migrations/20261010020000_unread_query_performance.sql`, depois da `20261010010000_persistent_unread_badges.sql`, também ainda local. Não foi aplicada em produção. Nenhuma tabela de dados/counters ou índice novo foi criado; o range usa messages_channel_created_idx existente.",
  "",
  "`visible_message_channels()` é STABLE SECURITY DEFINER, retorna somente ids permitidos ao auth.uid() corrente, sem argumento que permita escolher outro usuário. Usa has_channel_permission existente, membership e search_path fixo pg_catalog, com referências de schema completas. EXECUTE foi revogado de PUBLIC/anon e concedido somente a authenticated. A regra SELECT messages_select_members continua “view_channel para o ator atual”, mas usa o conjunto autorizado em um subplan. RLS permanece habilitada; outras políticas de leitura/escrita, guardas, limites e triggers não foram removidos.",
  "",
  "A RPC permanece SECURITY INVOKER: PostgreSQL ainda aplica RLS a mensagens, canais, membros e read states. CTEs MATERIALIZED fixam ator/canais nesta consulta; LATERAL parametriza canal + timestamp, excluindo histórico anterior ao last_read_at/joined_at. Somente mensagens de outros autores são contadas, e menções continuam calculadas pelo array real. Há leitura das mensagens efetivamente não lidas; não há promessa de custo constante para milhões de mensagens pendentes.",
  "",
  "| Consulta | Clientes | n antes/depois | Média antes → depois (ms) | p50 antes → depois | p95 antes → depois | p99 antes → depois | Pior antes → depois | Falhas antes/depois |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...summary.sql.map(
    (r) =>
      `| ${r.operation} | ${r.users ?? "—"} | ${r.before.n}/${r.after.n} | ${f(r.before.mean)} → ${f(r.after.mean)} | ${f(r.before.p50)} → ${f(r.after.p50)} | ${f(r.before.p95)} → ${f(r.after.p95)} | ${f(r.before.p99)} → ${f(r.after.p99)} | ${f(r.before.max)} → ${f(r.after.max)} | ${r.errorsBefore}/${r.errorsAfter} |`,
  ),
  "",
  "SQL isolado: EXPLAIN ANALYZE. Concorrência: wall time incluindo pool/transação, SET ROLE e JWT fictício, loopback. Os dois tipos não são diretamente comparáveis. O pool continua max 100/connect_timeout 10 s. V1 desta rodada concluiu todas as 300 tentativas de 100 clientes; os 32 timeouts do V1 original não se repetiram. Não usar esta diferença para anunciar aumento de quota Supabase.",
  "",
  `Tudo lido: n=${caught.n}, média ${f(caught.mean)}, p50 ${f(caught.p50)}, p95 ${f(caught.p95)}, pior ${f(caught.max)} ms; corpo SQL com EXPLAIN, não latência HTTP. V1 original com tudo lido: RPC média 899,13/p95 1.137,69 ms, método diferente e sessão anterior. A comparação é diagnóstica, sem percentual pareado neste caso.`,
  "",
  "Validação SQL: totais, menções, exclusão de mensagens próprias, read-through sem apagar mensagens posteriores, cursor monotônico, não membro, outros servidores, cargo negando view_channel, restauração de acesso e remoção de membro dentro da mesma sessão, nenhum EXECUTE anônimo e RLS habilitada. O runner security:db executou todas as migrations em outra fixture nova, os testes de escrita/limites e os de não lidas: PASS.",
  "",
  "A assinatura de não lidas também invalida em alterações de roles/member_roles, agrupadas pelo scheduler existente de 200 ms. Isso evita depender apenas de nova mensagem para rever as contagens após mudar cargos. Entrega desses eventos no Supabase hospedado ainda precisa de teste em staging/publicação configurada.",
  "",
  "## 2. Molduras",
  "",
  "FlamingCutFrame calcula os mesmos polígonos uma vez por tick e reutiliza strings imutáveis nos cards ativos. Cache limitado ao último tick e um vetor de 12 paths; não acumula histórico de frames. Todos compartilham fase/clock; pausa global conserva tempo e não cria relógios por usuário. Não reduz a qualidade para uma borda simples, não troca assets nem gira o card.",
  "",
  "Memoização conserva IDs SVG e callbacks/ref quando propriedades são iguais. O IntersectionObserver compartilhado, pausa quando fora da tela/document.hidden, preferências e prefers-reduced-motion permanecem. Não houve mudança em IDs de cosméticos, seleção ou banco de perfis.",
  "",
  "| Perfis | Modo | Render p95 antes → depois (ms) | RAF p95 antes → depois (ms) | Nós antes → depois | Escritas SVG antes → depois (3 s) | Heap final antes → depois (MiB) |",
  "|---:|---|---:|---:|---:|---:|---:|",
  ...summary.web.map(
    (r) =>
      `| ${r.users} | ${r.mode} | ${f(r.before.render.p95)} → ${f(r.after.render.p95)} | ${f(r.before.raf.p95)} → ${f(r.after.raf.p95)} | ${r.before.nodes} → ${r.after.nodes} | ${r.before.writes} → ${r.after.writes} | ${f(r.before.heapMiB)} → ${f(r.after.heapMiB)} |`,
  ),
  "",
  "As escritas SVG continuam necessárias para o rastro viajar: não tentamos zerá-las no modo normal. O número pode subir com mais ticks completados. No modo otimizado elas continuam zero em todos os cenários. React.memo ajuda em atualizações de contadores sem mudar cosméticos; não evita renders que realmente alterem theme/animated/visibility. Média/p50/p99/pior e amostras individuais estão em summary.json e JSONs brutos.",
  "",
  "Conferência visual: dez opções (nove ilustradas + Corte Flamejante), visual e overlay presentes. A leitura do path em dois momentos confirmou deslocamento; depois de desativar animações o path permaneceu igual. Cards fora da tela reportaram data-visible=false. Modo Desempenho manteve os overlays estáticos. Não fizemos teste de fidelidade pixel a pixel nem teste manual de preferência reduzida no sistema operacional; o CSS/matchMedia existente foi preservado.",
  "",
  "[Prévia de todas as molduras](docs/performance-optimization-v2/frames-all.png) · [Animadas](docs/performance-optimization-v2/frames-animated.png) · [Estáticas](docs/performance-optimization-v2/frames-static.png)",
  "",
  "## 3. Interface, mensagens e cache",
  "",
  "- Ocupação: retainOccupancy compara canal, ordem, user/session id, mute/deafen/speaking/camera/screen. Sweep igual retorna o objeto anterior, evitando notificar consumidores React. Mudanças reais continuam chegando. O teste de 60 heartbeats/refreshes mantém a mesma referência; suíte cobre recuperação, mudanças de canal e saída de sessão. Heartbeat, grace, sincronização e WebRTC não foram alterados.",
  "- Perfil: guard e AuthProvider compartilham [profile,userId] e staleTime 30 s no mesmo QueryClient. Teste real do guard + QueryClient: guard, AuthProvider e segunda navegação fazem uma leitura de perfil; getUser ocorre nas duas navegações. Invalidação explícita produz nova leitura. Cache é apagado em saída/troca de conta; USER_UPDATED invalida só o perfil correspondente.",
  "- Login: teste confirma que dois SIGNED_IN da mesma conta não invalidam toda a árvore. Isso reduz requests na retomada do foco, sem pular a verificação Auth/RLS do backend.",
  "- Estrutura: canais e categorias recebem staleTime 30 s, e eventos de estrutura são agrupados por 100 ms. SUBSCRIBED continua refrescando para fechar a janela entre query e assinatura; DELETE com payload só de chave continua tratado. Não removemos refetch de reconexão para melhorar artificialmente o benchmark.",
  "- Mensagens públicas/privadas: Promise.all inicia lookup de autores, replies e reações juntos; autores de respostas ainda são buscados depois, se realmente faltarem. Não cria cache global de mensagens/perfis, não altera normalização de attachments/mentions, CRUD ou Realtime. Reações continuam calculando mine por usuário.",
  "",
  "Benchmark controlado das funções reais hydrate (30 amostras após 2 aquecimentos, 10 ms nominais de transporte por request):",
  "",
  "| Chat | Etapa | n | Média | p50 | p95 | Pior (ms) | Requests em 32 execuções |",
  "|---|---|---:|---:|---:|---:|---:|---:|",
  ...summary.hydration.map(
    (r) =>
      `| ${r.kind} | ${r.stage} | ${r.n} | ${f(r.mean)} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.max)} | ${r.requests} |`,
  ),
  "",
  "É um ensaio de dependências/latência simulada usando o código real, não tempo de Supabase, envio até destinatário ou navegação autenticada. Timers Windows podem ultrapassar 10 ms. O número de requests permanece igual neste cenário; o ganho vem da concorrência, não de resultados inventados de cache. Testes com promises bloqueadas verificam que os três requests começaram juntos e validam autores/replies/reação própria. Navegação real e latência Realtime precisam de staging.",
  "",
  "## 4. Electron, CPU, memória e voz",
  "",
  "| Fase | Modo | n antes/depois (1 Hz) | CPU média antes → depois (%) | CPU p95 antes → depois (%) | Pico working sets antes → depois (MiB) |",
  "|---|---|---:|---:|---:|---:|",
  ...summary.electron.map(
    (r) =>
      `| ${r.phase} | ${r.mode} | ${r.before.cpu.n}/${r.after.cpu.n} | ${f(r.before.cpu.mean)} → ${f(r.after.cpu.mean)} | ${f(r.before.cpu.p95)} → ${f(r.after.cpu.p95)} | ${f(r.before.peakWorkingMiB)} → ${f(r.after.peakWorkingMiB)} |`,
  ),
  "",
  "CPU é soma de percentCPUUsage de app.getAppMetrics, não percentual idêntico ao Gerenciador de Tarefas. Os primeiros dados, cold codecs, ordem normal→otimizado, GC e variação de máquina influenciam a comparação. Working sets somados contam páginas compartilhadas; heap JS não é RAM física exclusiva. Não afirmar redução garantida de RAM ou CPU do exe em chamadas reais. GPU percentual/memória dedicada não foram medidos.",
  "",
  `V2 executou ${raw["v2-web-after"].rtc.length} sessões WEB e ${raw["v2-electron-after"].fixture.rtc.length} Electron com o provider real e sinalização em memória, sem erro registrado. Peers abertos após cleanup no Electron: normal=${raw["v2-electron-after"].fixture["openPeersAfterCleanup-normal"]}, otimizado=${raw["v2-electron-after"].fixture["openPeersAfterCleanup-optimized"]}. São apenas duas pontas por sessão e mídias sintéticas; não demonstram estabilidade WAN, saída audível ou chamada longa. Nenhum ajuste em src/services/voice.ts, codecs, ICE/TURN ou reconexão.`,
  "",
  "## Verificação técnica e limites",
  "",
  "- npm test: 167 testes, 167 passaram, zero falhas.",
  "- npm run typecheck: passou. Typecheck da fixture: passou.",
  "- npm run lint: zero erros, 46 avisos (Fast Refresh e avisos existentes); sem desativar regras para esconder erros.",
  "- npm run build: passou. npm run desktop:build: passou; não geramos release/instalador nem modificamos a instalação do usuário.",
  "- Fixture Vite produção: passou; WEB e Electron executaram os mesmos componentes reais de moldura.",
  "- security:db: PASS em PostgreSQL local isolado; migrations e dados fictícios. Build Desktop executou scan com zero findings.",
  "",
  "Concluído tecnicamente no ambiente medido: contagem/range/RLS, cálculo compartilhado e memoização de molduras, igualdade de ocupação, compartilhamento da query de perfil e hidratação paralela. “Concluído” aqui não significa que o aplicativo inteiro está livre de gargalos. Melhora de pintura normal foi parcial; desempenho em primeiro plano do exe, navegação autenticada completa e integrações hospedadas ainda não passaram por validação ponta a ponta.",
  "",
  "Pendente: staging WEB↔EXE com duas contas/redes; mudanças de cargo/membership em Realtime, menções online/DND e leitura sincronizada; perfis/servidores com imagens reais; sessão longa de 30–60 min com heap snapshots; layout mobile completo; cenário de muitos perfis realmente visíveis; A/B com ordem alternada; custo GPU dos filtros da Corte Flamejante; monitorar fan-out/invalidações de presença; virtualização de histórico longo e deduplicação de hidratações concorrentes. Não anunciamos essas otimizações ainda não implementadas.",
  "",
  "## Arquivos desta V2",
  "",
  "Produção modificada:",
  "",
  "- src/components/gamer/FlamingCutFrame.tsx — clock/fase/geometria compartilhada e memo.",
  "- src/components/gamer/IllustratedFrame.tsx — memo e máscara metálica apenas em Imperial.",
  "- src/hooks/use-voice.tsx — referência estável para ocupação sem mudança.",
  "- src/hooks/use-auth.tsx e src/routes/_authenticated/route.tsx — cache de perfil compartilhado e invalidação por identidade.",
  "- src/hooks/use-servers.ts e src/hooks/use-categories.ts — cache de estrutura e agrupamento de eventos.",
  "- src/hooks/use-unread.ts — revisão das contagens após mudanças de cargos.",
  "- src/services/messages.ts e src/services/social.ts — consultas independentes em paralelo.",
  "",
  "Migration nova: supabase/migrations/20261010020000_unread_query_performance.sql.",
  "",
  "Testes/evidências: tests/performance-v2.test.mjs; tests/unread-counts.sql e tests/voice-navigation.test.mjs ampliados; tests/audit/db-benchmark.mjs admite replay no mesmo banco; novos v2-db-details.mjs, v2-hydration-benchmark.mjs, v2-summary.mjs, preview.html/preview.tsx; configuração Vite/tsconfig de testes; docs/performance-optimization-v2 com JSONs, planos e capturas; este relatório. Nenhum arquivo da atualização Progression foi restaurado.",
  "",
  "As mudanças de badges/notificações já presentes antes da V1 foram preservadas e não são contabilizadas como novas otimizações desta V2. Nenhuma variável de ambiente, segredo ou serviço externo novo é exigido pela aplicação. Ao publicar futuramente, a migration de não lidas precisa preceder a V2, com autorização explícita para o banco de produção.",
  "",
  "## Como reproduzir",
  "",
  "1. PostgreSQL local preparado, escutando exclusivamente 127.0.0.1:55448. Scripts não aceitam URL de produção. Para baseline futuro, usar schema anterior à migration V2; o banco pareado desta sessão mantém os dados originais e V2 aplicada.",
  "2. db-benchmark.mjs <output-before.json> --baseline-v1 cria uma fixture nova com o schema anterior à migration V2. db-benchmark.mjs <output-after.json> <output-before.json> aplica a migration V2 somente à fixture local nomeada. Não reaplicar a migration já aplicada. Os JSONs desta sessão eliminam a necessidade de reconstruir o baseline.",
  "3. npm exec vite -- build --config tests/audit/vite.config.mjs; servir vite preview na porta 5193. Abrir /tests/audit/index.html e Executar medições; prévia em /tests/audit/preview.html. Desktop: electron tests/audit/desktop-fixture.cjs <output.json>.",
  "4. npm test; npm run typecheck; npm run lint; npm run build; npm run desktop:build. security:db exige PG_BINDIR e cria outra fixture local isolada.",
  "5. v2-summary.mjs <scratch-directory> consolida os JSONs locais; v2-hydration-benchmark.mjs usa snapshots de código V1 nos arquivos v2-messages-before.ts e v2-social-before.ts, além do código V2 atual.",
  "",
  "A aplicação de migrations e qualquer publicação continuam pendentes de autorização. Nenhuma alteração foi feita no Supabase de produção nesta etapa.",
];
await writeFile("LOBBYX-PERFORMANCE-OPTIMIZATION-V2.md", lines.join("\n") + "\n");
console.log("V2 report and raw evidence saved");
