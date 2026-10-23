# Transmissões e entrega de solicitações de amizade

22/10/2026 · implementação local em `codex/communities-v1`, posterior à versão publicada 0.1.60. Alterações locais anteriores preservadas. Sem publicação, push, migration, alteração do atualizador ou incremento de versão.

## Controles na hotbar

- Canal de voz: botão direto **Parar transmissão** enquanto a captura local estiver ativa. O botão atual de configurar/compartilhar permanece disponível.
- Quem recebe uma tela tem **Sair da transmissão** e, depois, **Voltar à transmissão**.
- Mesmos atalhos disponíveis no painel de chamadas privadas e grupos.
- Sair interrompe a apresentação local do vídeo e a reprodução do áudio das telas recebidas naquele contexto. Mantém microfones, câmeras, ligação e envio da própria tela. Se várias pessoas transmitem, o comando atua sobre as telas recebidas da chamada.
- As tracks compartilhadas não são paradas nem renegociadas para sair da reprodução. O elemento de vídeo libera seu `srcObject` e pausa ao desmontar; o áudio do servidor remove seus sinks de tela e o privado remove o stream do player. Não foi implementada economia de tráfego por desativação de transceivers.
- Estado separado entre voz e chamada privada, com escopo por conta e sala; ao terminar a transmissão remota, o estado de saída é limpo. Nenhuma preferência é gravada no banco.
- Provider de visualização mantém callbacks/valor memorizados, evitando propagar mudanças de fala como mudanças de preferência de visualização.

## Sons para os participantes

O código anterior observava somente `localScreen`; por isso os demais participantes não recebiam a confirmação de início. Agora o provider emite um callback ao receber os sinais existentes `screenStarted`/`screenStopped`, e os contextos ativos encaminham a confirmação ao player global.

- O estado por remetente já mantido pelo provider elimina sinais repetidos (incluindo alterações de qualidade/áudio sem iniciar outra captura).
- Mensagens de sessões antigas continuam sendo rejeitadas antes do callback.
- O transmissor ouve a confirmação pela mudança de captura local; os outros clientes atualizados ouvem pelos sinais recebidos.
- Novo WAV original curto de parada, com as notas de início em ordem inversa. Nenhum áudio de terceiros utilizado.
- Sons continuam sujeitos à preferência de efeitos sonoros, saída selecionada, volume global e fone silenciado. Falha de autoplay não interfere na chamada.
- Sair apenas da reprodução local não anuncia que o transmissor parou. Nenhum som é misturado ao microfone ou retransmitido pela captura de áudio.

## Solicitações de amizade: diagnóstico e correção

Inspeção de catálogo em produção realizada em transação **READ ONLY**, sem consultar linhas de usuários: `friendships` já está em `supabase_realtime`; RLS habilitada e SELECT restrito ao solicitante/destinatário. Não faltava habilitar a tabela no Realtime.

Problemas identificados no cliente:

1. A primeira leitura HTTP podia ocorrer antes da inscrição e perder uma mudança nesse intervalo. `subscribe()` não tinha callback para reconciliar o estado ao conectar/reconectar.
2. Erro/timeout do canal deixava a tela sem mecanismo próprio de recuperação de pedidos perdidos.
3. O loader aguardava também a presença em jogos para disponibilizar amigos e pedidos. Uma falha/lentidão nessa consulta opcional podia atrasar ou impedir a lista inteira.

Correções:

- Inscrições filtradas por `requester_id` e `addressee_id` da conta atual.
- Releitura ao receber SUBSCRIBED, inclusive após reconexão.
- Reconciliação HTTP enquanto visível: a cada 5 s quando o socket não está inscrito e 15 s quando saudável, para recuperar eventos perdidos. Isso é intervalo de agendamento, não garantia de latência em rede indisponível.
- Releitura ao recuperar conexão ou foco; sem polling de segundo plano.
- Presença em jogos consultada separadamente, somente para amigos aceitos. Sua falha não bloqueia pedidos. Eventos de jogos de usuários alheios à lista não recarregam amizades.
- Cache por conta; callbacks da inscrição antiga são ignorados após cleanup. Serviços/RPCs e autorização do banco preservados.

Esses mecanismos foram reproduzidos com fixtures determinísticas. Não foi medida uma latência real entre duas contas em produção, portanto não se atribui um número de milissegundos nem se afirma que todas as possíveis causas de atraso externo foram eliminadas.

## Validação

- **337 testes Node aprovados, zero falhas, zero ignorados** (`outputs/transmission-social-tests-delivery.txt`).
- TypeScript aprovado (`transmission-social-typecheck-final.txt`).
- ESLint dos arquivos alterados: zero erros; avisos de Fast Refresh em módulos que compartilham hooks/componentes e na entrada da prévia. Logs `transmission-social-lint-final.txt` e `transmission-social-lint-last.txt`.
- Builds WEB/Desktop aprovados, usando configuração local de compilação, sem deploy (`transmission-social-web-build-final.txt`, `transmission-social-desktop-build-final.txt`).
- Testes novos cobrem entrega de sons/cleanup, sinais repetidos/sessão antiga, saída e retorno dos players sem remover microfones, isolamento por conta/sala, limpeza do vídeo sem parar tracks, recuperação Realtime e consulta real do serviço sem depender de presença.
- Na primeira rodada, fixtures antigas precisaram reconhecer as novas dependências e a expectativa anterior de parada silenciosa foi atualizada para o comportamento solicitado. Todas as verificações finais passaram.
- Capturas reais da prévia: `outputs/transmission-controls-full.png`, `transmission-controls-stopped.png` e `transmission-hotbar.png`.
- Prévia navegável em http://127.0.0.1:5221/ e opção **Transmissão** na prévia unificada. Usa as hotbars/painel reais com adaptadores locais, dados fictícios e streams vazios; não captura microfone, tela ou áudio e não conecta ao backend.

## Arquivos principais

- `src/components/call/ScreenViewingProvider.tsx` (novo) e `SessionCommunications.tsx`.
- `src/components/call/CallOverlay.tsx`, `CallSoundEffects.tsx`.
- `src/components/voice/VoiceControlBar.tsx`, `VoiceRoom.tsx`, `RemoteAudio.tsx`, `VideoSurface.tsx`.
- `src/hooks/use-call.tsx`, `use-voice.tsx`, `use-social.ts`.
- `src/services/voice.ts`, `call-sounds.ts`, `social.ts`.
- `scripts/generate-call-sounds.mjs`, `public/sounds/call-screen-stop.wav`.
- Testes de áudio/sinais/navegação e novos `screen-viewing.test.mjs`, `screen-video-cleanup.test.mjs`, `social-delivery.test.mjs`; `tests/transmission-controls-preview/*` e atalho na prévia unificada.

## Pendências reais

Conferir antes de publicação: duas contas WEB/EXE na mesma chamada, iniciar/parar pelo app e pelo botão do sistema, ouvir ambos os sons nos participantes, sair/voltar com áudio compartilhado sem perder voz, tela cheia, múltiplas telas simultâneas e envio/aceitação/cancelamento de amizade com reconexão. Não houve teste autenticado de duas contas nem audição física. Build Desktop não equivale a executar um instalador. A versão pública 0.1.60 permanece intacta.
