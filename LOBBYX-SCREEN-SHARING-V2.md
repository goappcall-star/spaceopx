# LobbyX — Compartilhamento de Tela V2

Implementação local em `codex/screen-share-v2`, na pasta `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/screen-share-v2`, baseada exclusivamente no código publicado `701438641be503869d6db8c5434e3fd28ee54a69` (0.1.45). Não houve push, deploy, release, migration, alteração de usuários ou atualização automática. Produção e pontos de recuperação permanecem intactos. Progression arquivado não foi incluído.

## Arquitetura analisada e preservada

MeshVoiceProvider atende servidor e chamadas privadas/grupos. Cada destinatário tem uma RTCPeerConnection. Sinalização Supabase Broadcast, presence, ICE recovery e perfect negotiation permanecem existentes. Ordem das m-lines preservada: microfone, câmera, tela, áudio da tela. Nenhuma transceiver de áudio recebe parâmetros de vídeo. STUN/TURN, permissões, autenticação, notificações, RLS e banco não foram modificados.

WEB usa getDisplayMedia e o seletor nativo. Electron 44.4.5 também usa getDisplayMedia, autorizado pelo setDisplayMediaRequestHandler existente; seu seletor seguro usa desktopCapturer para telas/janelas, com loopback opcional no Windows. As miniaturas do seletor não definem a resolução transmitida.

## Funcionalidades

- Painel anterior à seleção da fonte: 15/30/60 FPS; 720p/1080p/1440p; Automático, Desempenho e Qualidade; áudio opcional.
- Botões de compartilhamento em servidor, barra persistente e chamadas privadas abrem o mesmo painel. Durante a transmissão, oferecem configuração e parada.
- Preferência de qualidade salva localmente. Sem preferência anterior, normal inicia em 1080p/30; Modo Desempenho recomenda/inicia em 720p/30 e modo Desempenho. Todas as opções continuam disponíveis; não há bloqueio comercial de qualidade.
- Ajustes ao vivo usam applyConstraints na mesma faixa, sem recapturar nem interromper voz. Mudança de fonte/áudio exige encerrar a transmissão e selecionar novamente, com consentimento nativo.
- Constraints iniciais usam ideal/max, sem min/exact proibidos na solicitação de display. Não se promete aumentar uma fonte menor nem entregar a resolução/FPS desejados.
- RTCRtpSender usa seus próprios getParameters/setParameters, preservando transactionId, encodings, RID, SSRC e codecs. Ajustes serializados com proteção contra encerramento e geração obsoleta. Nenhum SDP completo é manipulado para aumentar qualidade.
- Caso hints opcionais de degradação/escala sejam rejeitados, tenta somente orçamento/FPS com uma nova transação. Falhas continuam isoladas da voz e são indicadas no painel.
- Orçamento inicial de bitrate deriva do preset (base de 3 Mbps em 720p/30), ajustado por destinatário. São tetos técnicos de envio, não bitrate garantido. Não alteram o limite do microfone. Essa curva ainda precisa de calibração com jogos reais.
- Controle de congestionamento nativo continua ativo. O controlador adicional considera perda, RTT e qualityLimitationReason: dois sinais ruins para reduzir, três bons para recuperar, cooldown de 12 segundos, redução gradual do orçamento e da escala de vídeo. Ausência de dados não é tratada como rede boa. Não há oscilação a cada frame.
- Automático/Desempenho priorizam movimento e preservação do FPS com redução de resolução. Qualidade prioriza detalhes/resolução, permitindo redução do FPS.
- O navegador negocia codecs compatíveis na arquitetura atual. Mantivemos a ordem e fallback nativos para não forçar AV1/software ou quebrar clientes antigos. A aceleração de hardware fica a cargo do Chromium, drivers e codec negociado; nenhuma flag a desativa. Sua utilização não foi comprovada pelo teste deste computador.
- Estatísticas opcionais mostram captura reportada por getSettings, saída codificada por destinatário, bitrate, perda, RTT, codec, codificador e limitação quando disponíveis. FPS reportado pela captura não comprova frames efetivamente produzidos; FPS codificado também não comprova FPS exibido pelo receptor.

## Desempenho e privacidade

Sem canvas/GIF/vídeo intermediário na implementação do produto. O canvas existe somente na fixture de testes. Sem novas dependências ou infraestrutura paga.

Sondagens apenas com captura ativa e destinatários: 4 segundos normalmente, 8 segundos em Desempenho, 10 segundos com página oculta. Um getStats por sender de tela, de forma sequencial e sem intervalos sobrepostos; não sonda microfones. A interface assina estatísticas só quando aberta. Encerramento da transmissão e saída da chamada invalidam o controlador e liberam o timer. Codificação/captura seguem ativas com o aplicativo oculto porque ainda há transmissão real.

Dados técnicos ficam na memória local e não são enviados ao Supabase. Não guardamos IP, SDP, conteúdo de tela, áudio ou IDs de participantes nas estatísticas mostradas. Preferências locais contêm somente qualidade e áudio desejado. Performance Monitor permanece desativado por padrão, sem concessão administrativa.

## Validação técnica

- 203 testes automatizados aprovados: regressões de áudio, presença/sinalização/negociação/encerramento e novos testes de presets, bitrate, cancelamento, mudanças serializadas, counters reais, tolerância a APIs indisponíveis/fallback de parâmetros e adaptação com histerese.
- Typecheck e varredura de segurança aprovados; 572 arquivos examinados, zero achados.
- Lint dos quatro módulos/componentes novos aprovado. A revisão dos hooks existentes encontrou quatro avisos de Fast Refresh já associados ao padrão de exportação de contextos; não foi alterada essa arquitetura.
- Build WEB/Vercel aprovado. Build SPA/Desktop aprovado. A primeira tentativa de build Desktop herdou o preset Vercel do ambiente do teste; o wrapper foi corrigido para passar somente configuração pública ao build Desktop. Não foi necessária alteração da configuração do produto.
- Runtime Desktop com código/build novo, perfil isolado e atualizador inativo: uma janela, tela de login carregada, zero erros do renderer ou carregamento. Não houve instalação NSIS nem login real nesse ensaio; resultado em `desktop-runtime.json`.
- Painel conferido nos temas claro/escuro; seleção de 1440p/60 exercitada. Captura em `docs/screen-share-v2/panel-light.png`.
- Teste real de APIs WebRTC locais com canvas sintético: ajuste de 1080p/30 para 720p/15 manteve conexão connected, a mesma faixa live e uma transceiver, sem reconexão. getSettings reportou 1280×720/15; saída no instante observado foi 480×270/16, VP8. O arredondamento/janela de stats pode diferir pontualmente do teto solicitado. Dados em `live-update.json`.

## Medições obtidas — não equivalem a testes entre usuários

Máquina de teste: Windows, 12 CPUs lógicas, aproximadamente 31,8 GiB de RAM. Não é evidência de comportamento em computador fraco.

Duas RTCPeerConnections no mesmo renderer, fonte canvas animada por timer, recepção local, sem microfone ou áudio do sistema. WEB e Electron executados separadamente. Três pares de 8,5 s: desligado→ligado, ligado→desligado, desligado→ligado. Codificador previamente inicializado. A comparação inclui atuação adaptativa, aquecimento e scheduling; não isola causalmente o overhead do controlador.

| Plataforma / métrica | Controlador desligado | Controlador ligado |
|---|---:|---:|
| Electron: soma %CPU dos processos | 12,09 | 8,65 |
| Electron: soma working sets, MiB | 572,69 | 551,26 |
| Electron: intervalo de desenho p50, ms | 21,67 | 26,20 |
| Electron: intervalo de desenho p95, ms | 26,90 | 32,27 |
| WEB: heap JavaScript, MiB | 26,876 | 27,001 |
| WEB: intervalo de desenho p50, ms | 21,27 | 20,83 |
| WEB: intervalo de desenho p95, ms | 106,07 | 43,17 |

CPU Electron foi lida por app.getAppMetrics a cada 2 s (13 amostras desligado, 12 ligado). Working sets são somados e podem contar memória compartilhada mais de uma vez. Heap WEB é estimativa Chromium e não memória total do aplicativo; CPU WEB e utilização de GPU não foram disponibilizadas. Intervalos medem cadência do desenho sintético, não renderização da UI ou áudio.

**Não há comprovação de ganho de CPU ou ausência de regressão.** A cadência p95 piorou no Electron, e a variabilidade WEB foi grande. Precisamos de rodadas mais longas e chamadas reais para avaliar causalidade e fluidez. Não liberar produção com base nesses números.

A primeira execução recarregou com HMR e outra usou requestAnimationFrame oculto, reduzido para cerca de 1 FPS. Ambas foram descartadas. A medição acima usa fonte por timer, arquivos estáveis e fases de CPU separadas corretamente.

### Partida da transmissão sintética — última amostra após aproximadamente 3,6 s

| Pedido | WEB: saída / FPS | Electron: saída / FPS |
|---|---|---|
| 720p / 15 | 480×270 / 15 | 320×180 / 15 |
| 720p / 30 | 960×540 / 9 | 320×180 / 30 |
| 720p / 60 | 480×270 / 44 | 960×540 / 36 |
| 1080p / 15 | 480×270 / 16 | 640×360 / 15 |
| 1080p / 30 | 480×270 / 29 | 320×180 / 30 |
| 1080p / 60 | 640×360 / 39 | 960×540 / 33 |
| 1440p / 15 | 960×540 / 15 | 480×270 / 16 |
| 1440p / 30 | 960×540 / 28 | 480×270 / 30 |
| 1440p / 60 | 640×360 / 41 | 1280×720 / 37 |

VP8 negociado, perda reportada 0 nessas amostras locais. qualityLimitationReason reportou bandwidth durante a partida, mesmo no loopback; não prova deficiência da internet. Fonte/cadência e estimativa inicial de congestionamento influenciam fortemente os resultados. Não houve observação de 60 FPS codificados sustentados. As nove combinações produziram vídeo, mas resolução/FPS máximos não estão homologados. Consulte os JSON completos para bitrate/RTT/counters.

## Matriz obrigatória e pendências antes de publicar

| Cenário | Situação |
|---|---|
| WEB → WEB entre duas contas/dispositivos | Pendente; peers locais no mesmo renderer não equivalem a dois clientes |
| WEB → EXE | Pendente |
| EXE → WEB | Pendente |
| EXE → EXE | Pendente |
| Hardware de baixo desempenho | Pendente |
| Rede instável real / perda e recuperação | Pendente; histerese/falhas somente em testes controlados simulados |
| Jogo real de alto movimento | Pendente; canvas não equivale a jogo capturado |
| Áudio do sistema/aba audível e voz simultânea | Pendente; preservação estrutural/automática não comprova áudio audível |
| Seleção nativa, captura encerrada pelo sistema e trocas em sessões reais | Pendente; encerramento/races cobertos por testes unitários |
| Hardware encoder e qualidade sustentada 1080p/1440p a 60 FPS | Pendente |

Para homologar: usar duas contas autorizadas em prévia local conectada ao Supabase, canais técnicos, sem mensagens reais; capturar tela/janela e áudio com consentimento. Aquecer cada configuração por pelo menos 20–30 s e observar por vários minutos. Repetir entrada/saída, mudança de qualidade, suspensão e queda de rede, parada pelo seletor, participante tardio e cliente estável recebendo do novo cliente. Medir áudio audível, FPS recebidos, RTT, perda, CPU e RAM por cliente. A disponibilidade atual de um só computador limita o ensaio de redes/dispositivos diferentes.

Critérios para interromper homologação: voz reconectando após ajuste de qualidade, áudio cortado, faixa duplicada, vídeo congelado após parar, escalada contínua de RAM/CPU, perda sustentada ou promessa de FPS divergente das métricas. Não reescrever arquitetura de voz como solução automática.

## Arquivos principais

- `src/services/screen-share.ts`: opções, medição e controle por sender.
- `src/services/screen-share-panel.ts`: abertura do painel por contexto.
- `src/services/voice.ts`: integração restrita aos slots de tela.
- `src/hooks/use-voice.tsx`, `src/hooks/use-call.tsx`: opções e acesso ao controlador.
- `ScreenShareDialog.tsx`, `ScreenShareSettings.tsx`: configuração e estatísticas.
- VoiceBar, VoiceControlBar, CallOverlay, SessionCommunications: acesso ao painel.
- `tests/screen-share-v2.test.mjs`, `tests/screen-sharing.test.mjs`, fixture de áudio e `tests/screen-v2`: validação e reprodução.
- `docs/screen-share-v2`: resultados técnicos sem conteúdo privado.

## Referências técnicas

- https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters
- https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/getParameters
- https://www.electronjs.org/docs/latest/api/desktop-capturer

Essas APIs oferecem mecanismos de ajuste e negociação, não garantias de hardware, 60 FPS, resolução ou áudio do sistema.
