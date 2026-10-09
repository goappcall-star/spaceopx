# Estabilidade das chamadas — 8 de outubro de 2026

Estado: correções locais, ainda não publicadas. Versão de produção analisada: 0.1.40, commit `9e9e83c`.

## Resultado da investigação

Foram reproduzidas cinco falhas no código da versão publicada. Os testes novos foram executados contra os arquivos originais de 0.1.40: os cinco falharam. Com as correções, todos passam. Isso confirma problemas no código; sem um registro da chamada afetada no EXE, não comprova que sejam as únicas causas das quedas observadas em produção.

1. Cada início/fim de fala publicava novamente a presença completa do usuário. Heartbeats e pedidos de atualização também publicavam dados sem alteração. Esses eventos chegam aos observadores e provocam novas sincronizações. A presença global ainda repetia o mesmo status/jogo nos polls e heartbeats.
2. Uma confirmação de Presence que demorasse dois segundos já iniciava recuperação por recriação da inscrição. Isso podia disputar com a recuperação automática do SDK e multiplicar eventos de reconexão.
3. Dez segundos de ausência em Presence encerravam o peer mesmo com WebRTC/ICE conectado e áudio funcionando. A falha de sinalização era transformada pelo aplicativo em uma interrupção de mídia.
4. Snapshots vazios apagavam imediatamente a lista visual de participantes. A recuperação de uma inscrição observadora também zerava a lista durante a remoção do canal anterior.
5. Um pacote atrasado de uma sessão anterior podia substituir o peer de uma sessão nova. Uma saída explícita seguida de uma lista de ocupação ainda antiga também podia tentar recriar a conexão do participante que saiu.

A documentação do Supabase confirma que limites de eventos podem desconectar canais e que Presence deve publicar mudanças reais. Esta investigação não mediu o consumo do projeto de produção; ultrapassar a quota é uma hipótese de agravamento, não uma causa comprovada da chamada do usuário. Referências: [limites](https://supabase.com/docs/guides/realtime/limits), [configuração e contagem de eventos](https://supabase.com/docs/guides/realtime/settings), [limite de Presence por cliente](https://supabase.com/docs/guides/troubleshooting/realtime-client-presence-rate-limit-reached).

## Correções implementadas

- Atividade de fala na chamada vem da análise do áudio recebido, já existente; não publica cada mudança do VAD em Presence.
- Presença de voz e global deduplicam payloads confirmados, excluindo o relógio da comparação. Mudanças reais de sala, mute, som, câmera, tela, status e jogo continuam sendo publicadas. Mudanças durante uma publicação são preservadas.
- O heartbeat da voz republica se o slot próprio estiver realmente ausente. Observadores anunciam uma vez por inscrição.
- Publicações de voz aguardam até dez segundos por confirmação. Uma falha de publicação tenta novamente no mesmo canal; o transporte ganha tempo para a recuperação do SDK antes da substituição. A recuperação global também não recria um canal saudável por confirmação lenta.
- Uma lacuna de Presence não fecha um peer com WebRTC e ICE conectados. ICE morto e saída explícita continuam liberando conexões, tracks e timers.
- A lista visual preserva temporariamente participantes ausentes por até trinta segundos. Mudanças de sala e saída explícita da sessão são aplicadas imediatamente. Uma inscrição observadora substituída preserva a visão de recuperação do mesmo servidor.
- Sessões de sinalização encerradas/substituídas são descartadas, com memória limitada. Uma saída explícita não é desfeita por ocupação antiga; uma nova sessão pode entrar imediatamente.
- Sair da rede invalida o cache global de publicações e confirmações pendentes. Voltar online republica o mesmo status corretamente.
- Mantida a serialização de remoção/inscrição por tópico introduzida anteriormente; nenhuma alteração de schema, TURN, credenciais ou Electron principal.

## Validação

- `npm test`: 150 testes passaram, zero falhas.
- `npm run typecheck`: passou.
- `npm run lint`: zero erros, 44 avisos preexistentes de Fast Refresh.
- `npm run desktop:build` e `npm run build:vercel`: passaram.
- `git diff --check`: passou.
- Teste no navegador com RTCPeerConnection real, áudio sintético e sinalização local simulada: chamada privada e sala de servidor; mesmos streams e estado conectado após doze segundos sem Presence; vinte ciclos de lacuna/recuperação por modalidade; ofertas SDP repetidas; áudio recebido nas duas direções.

Logs estão em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/voice-stability-*.log`. A comparação com a versão antiga está em `voice-stability-baseline.log`. Captura do teste: `voice-stability-webrtc-pass.jpg`.

## Arquivos

Implementação: `src/hooks/use-voice.tsx`, `src/hooks/use-global-presence.tsx`, `src/services/voice.ts`, `src/services/presence-connection.ts`.

Regressões: `tests/voice-navigation.test.mjs`, `tests/voice-negotiation.test.mjs`, `tests/presence-connection.test.mjs`, `tests/audio/negotiation-harness.ts`, `tests/audio/pipeline-fixture.mjs`.

## Limites e próxima validação

### Ordem visual dos participantes

A lista do canal usava diretamente a ordem das chaves do snapshot de Presence. Sincronizações podiam inverter essa ordem; a recuperação local/de mídia também podia acrescentar um usuário ao fim temporariamente. A posição exibida agora é preservada por identidade em cada canal no contexto compartilhado de voz. Metadados de fala, mute, câmera e tela continuam atualizados sem alterar a posição. Novos participantes são acrescentados ao final; saídas/movimentações reais removem a pessoa do canal de origem.

Dois testes de regressão exercitam o provider real com snapshots repetidamente invertidos, fala/mute, ausência temporária do usuário local, nova entrada, movimentação e saída explícita. Suíte atual: 152 testes passaram. Essa correção permanece local até a próxima publicação autorizada.

Não foi realizada uma chamada entre dois EXEs em computadores/redes externas, nem coletado um diagnóstico da falha original em produção. O teste local não exercita o transporte real do Supabase nem NAT/TURN.

Se um processo morrer sem avisar a saída, a lista externa poderá manter seu último participante por até trinta segundos. Esse prazo é uma janela de recuperação limitada, não uma permanência infinita. Se a sinalização ficar indisponível, áudio já conectado é preservado, mas novas entradas/negociações ainda dependem da recuperação dela.

Após publicar WEB e uma nova versão Desktop, validar duas contas em redes diferentes: chamada parada por pelo menos quinze minutos, troca A → B → A, saída/retorno, perda breve de rede, mute e compartilhamento. Se persistir, registrar horário, versão e estados ICE/WebRTC/Realtime da ocorrência para distinguir transporte, limite de eventos e conectividade. Não é correto declarar toda instabilidade de rede resolvida apenas com os testes locais.
