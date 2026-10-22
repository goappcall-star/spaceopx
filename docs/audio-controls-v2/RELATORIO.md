# LobbyX — Controles de áudio V2

Implementação local na branch `codex/communities-v1`, em 22/10/2026. Nenhuma publicação, push, migration remota, instalador ou atualização automática.

## Implementado

- Setas existentes do microfone e fone abrem popovers ancorados, sem deslocar o layout. Dispositivos em submenu com seleção por rádio e nomes completos, identificação por tipo, padrão do sistema, volume e atalho para voz. O microfone também oferece o modo aberto/PTT existente. Em telas estreitas o submenu abre acima/abaixo, com prevenção de corte lateral.
- Página e diálogo de voz compartilham as mesmas seções: supressão, entrada, saída, teste, efeitos de chamadas e modo de entrada/tecla PTT. Vídeo e câmera do diálogo existente preservados. Nenhum botão duplicado de mute/fone.
- Volume global 0–100% na UI, preferências carregadas, atualizações/persistência, DSP e cálculo de reprodução. `0/50/100` corresponde a ganho `0/0,5/1`. Preferências antigas acima de 100 são limitadas sem apagar hardware, PTT ou outras escolhas; o próximo salvamento normal persiste os valores saneados. Valores negativos e não finitos também são tratados.
- Controles por participante continuam independentes, com sua escala existente. O pedido altera o volume **global** de entrada/saída; não remove ajustes individuais. A reprodução final continua limitada ao intervalo permitido pelo elemento de áudio.
- Retorno desligado inicialmente. “Testar microfone” inicia medidor e reprodução na saída selecionada; há estado de preparação/permissão, indicação ativa, orientação para fones e interrupção imediata. Volume da saída controla também o retorno.
- Durante chamada, o teste empresta somente a saída processada e o analyser existentes. Não modifica tracks, mute, ganho, PTT ou o sender, nem abre outro getUserMedia. Mute/PTT continuam valendo para ouvir o próprio retorno.
- Fora da chamada, uma captura e um pipeline temporários são criados. Encerramento libera tracks próprios, player, temporizador, contexto e processamento. Nunca encerra tracks emprestados. O teste cancela ao fechar/desmontar, trocar conta/dispositivo/supressão, remover hardware ou encerrar o fluxo emprestado.
- Trocas de volume durante o pedido de permissão são aplicadas antes da reprodução. Resultados tardios de getUserMedia, setSinkId ou play não reativam um teste cancelado. Erros de saída são mostrados, sem fallback silencioso.
- Dispositivo removido volta ao padrão quando a enumeração permite confirmar a ausência. Uma lista vazia sem evidência não é tratada como autorização de hardware. Mudanças do microfone padrão do Windows são reconciliadas sem trocar o sender; alterações apenas na saída não recapturam o microfone quando a assinatura padrão permanece igual.
- Ganho de entrada também passa a acompanhar alterações ao vivo nas chamadas privadas/grupos. A hotbar permanece visível enquanto um de seus popovers estiver aberto.
- Medição limitada a 12,5 atualizações/segundo, somente durante teste; nenhum novo efeito contínuo ou animação de áudio. Supressão avançada continua opcional e usa a implementação existente.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| UI | `src/components/settings/AudioSettingsPanel.tsx`, `audio-settings.css` |
| Menus e dispositivos | `src/components/voice/AudioQuickMenu.tsx`, `AudioDeviceSelect.tsx`, `GlobalVolumeSlider.tsx`, `AudioOutputControl.tsx` |
| Integração | `DeviceSettingsDialog.tsx`, `AutoHideVoiceControls.tsx`, `NoiseModeSelect.tsx`, `src/components/ui/slider.tsx` (nome acessível opcional do thumb) |
| Preferências | `src/hooks/audio-settings-context.tsx`, `use-audio-settings.tsx` (mesmo contexto compartilhado; hooks antigos reexportados) |
| Teste de áudio | `src/hooks/use-microphone-test.ts`, `src/services/microphone-test.ts` |
| Limites e captura | `src/lib/audio-volume.ts`, `src/services/audio-processing.ts`, `src/services/voice.ts`, `src/hooks/use-call.tsx` |
| Testes | `tests/audio-controls-v2.test.mjs`, `audio-processing.test.mjs`, `provider-lifecycle.test.mjs`, `audio/pipeline-fixture.mjs` |
| Prévia | `tests/audio-preview/preview.tsx`, integração no preview unificado e teste do grafo de dependências |

O contexto foi separado do provider autenticado para permitir usar os componentes reais na prévia sem importar autenticação, Supabase ou dados de produção. O teste de isolamento permite explicitamente somente os dois serviços locais de áudio, mantendo a proibição de backend.

## Verificações

- Suíte Node completa: **315 aprovados; 0 falhas; 0 ignorados**.
- Inclui 22 novos cenários: limites reais de DSP e reprodução, retorno emprestado/próprio, mute/PTT, preservação do sender, descarte durante permissão/sink/play, erro de saída, fechamento/troca de conta/dispositivo, ganhos durante preparação e mudança do padrão de hardware.
- Preferências: carregamento de valores 180/200, preservação da tecla/modo/dispositivo, persistência saneada, remoção do microfone e cancelamento de gravações ao sair da conta.
- TypeScript aprovado.
- ESLint dos arquivos TS/TSX alterados: sem erros; quatro avisos `react-refresh/only-export-components` nos módulos que compartilham provider/hooks.
- Builds WEB e Desktop executados localmente com placeholders de compilação apontando para loopback. Não incluem autenticação ou publicação. Avisos não fatais do bundler: diretivas `use client` de dependências, tsconfig paths e identificação de grupos de chunks.
- Navegador real, componentes reais e dispositivos **fictícios**: seleção de entrada/saída sincronizada com os selects, 0/50/100% e tentativa de exceder 100 pelo teclado, atalho, PTT, persistência após recarregar, desktop 1366 px e móvel 390 px. Corte lateral encontrado no móvel e corrigido; submenu novamente conferido e capturado.
- As falhas da primeira rodada foram resolvidas: guard para `navigator` ausente no teardown do ambiente Node e atualização dos harnesses para carregar o contexto/utilitário reais após a separação.

## Prévia e evidências

[Abrir prévia](http://127.0.0.1:5213/) → **Áudio**.

A lista inicial é uma fixture identificada. Para testar seu hardware, clique **Usar dispositivos deste computador**, coloque fones e depois **Testar microfone**. O teste é real apenas quando iniciado explicitamente. Mute/fone na faixa de demonstração são simulações identificadas; os menus e o painel são os componentes reais. Preferências da prévia ficam exclusivamente na chave `lobbyx-audio-preview-only` do navegador.

- [Voz e áudio — Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/audio-v2-settings-desktop.png)
- [Menu de entrada](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/audio-v2-input-menu.png)
- [Menu de saída](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/audio-v2-output-menu.png)
- [Página móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/audio-v2-settings-mobile.png)
- [Menu móvel corrigido](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/audio-v2-menu-mobile.png)
- Logs: `outputs/audio-v2-node-tests.txt`, `audio-v2-lint.txt`, `audio-v2-web-build.txt`, `audio-v2-desktop-build.txt` no workspace pai.

## Limitações reais e validação manual pendente

Os testes de processamento, devices e ciclo de vida usam Web Audio/MediaStream simulados. Não comprovam audição física, drivers, Windows, permissões em todos os navegadores, nem uma chamada autenticada WEB↔EXE. Não foram usados usuários ou servidores de produção. Build Desktop não significa instalador distribuído ou teste autenticado no Electron.

A seleção de saída depende de `HTMLMediaElement.setSinkId`; sem suporte, a interface explica que deve ser usada a saída do sistema. Restrições/autoplay/permissões podem impedir o retorno; a interface apresenta o erro. O modo avançado mantém o fallback da implementação anterior. O medidor indica amplitude relativa, não dB calibrado. Em uma chamada silenciada ou aguardando a tecla PTT, o retorno também fica silenciado.

Antes de publicar, conferir com fones e duas contas em ambiente autorizado:

1. WEB e EXE: trocar mic/fone durante chamada, confirmar o hardware usado e testar 0/50/100%.
2. Ouvir o retorno fora e dentro de chamada, confirmar supressão e ausência de uma segunda captura quando emprestado.
3. Mute, deafen, PTT e tecla: confirmar transmissão nos dois clientes sem alterar seu comportamento.
4. Parar teste, fechar diálogo/rota, trocar conta/dispositivo e revogar permissão; conferir indicadores de captura e ausência de retorno residual.
5. Desconectar/reconectar headset e trocar o padrão no Windows; conferir fallback e retomada.
6. Confirmar erros reais de permissão/autoplay/saída não suportada e persistência na conta autorizada.
7. Regressão de voz, vídeo, tela compartilhada/áudio, efeitos e hotbar, com Modo Desempenho ligado/desligado.

Não há migration nesta entrega. XP, comunidades, produção e atualização automática não foram alterados. Instalador estável 0.1.58 preservado: SHA256 `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`.
