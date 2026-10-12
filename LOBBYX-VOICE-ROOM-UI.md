# Ajustes da tela de chamada

Implementação local, 2026-10-12. Produção preservada na 0.1.48; sem deploy, release, migrations ou alterações no transporte WebRTC.

- Primeiro clique em um canal entra na voz mantendo o chat selecionado. Clique no canal já conectado abre a tela da chamada. Ao trocar de voz estando na tela anterior, volta ao canal de texto, sem abrir automaticamente a nova sala. Servidores sem texto mantêm a área vazia até o clique explícito no canal conectado.
- Os controles inferiores entram deslizando no mesmo lugar e somem após 2,5 segundos sem interação. Um único timeout, movimento limitado a cinco atualizações por segundo, cleanup no desmontar. Foco de teclado protege os controles; touch permanece visível e prefers-reduced-motion desativa a transição.
- Volume individual removido dos cards e do menu contextual. Slider disponível no perfil rápido e completo de um participante remoto da mesma chamada, mantendo o estado de volume existente. O volume separado da transmissão de tela foi preservado.
- Na lista lateral e nos cards, microfone riscado representa mute; microfone e fone riscados representam deafen, no canto direito. Estados do participante existente, sem nova assinatura de presença.

Validação: typecheck e build WEB passaram; lint sem erros (aviso Fast Refresh existente em ProfileDialog). 207 testes passaram, incluindo quatro novos casos de navegação. A primeira execução teve um EPERM transitório no rename de um arquivo temporário do teste Desktop de permissões; o teste isolado e a suíte completa repetida passaram sem alterar o código de permissões.

Prévia de interface em `tests/voice-room-ui/index.html`: controles presentes, ocultos após timeout (inert e sem elementos acessíveis), reaparecimento com interação e ambos os indicadores à direita confirmados no navegador. Capturas externas ao repositório em `work/voice-room-controls-visible.png` e `work/voice-room-controls-hidden.png`. Esta prévia usa participantes ilustrativos e não é prova de áudio real. Voz entre contas e instalador real não foram revalidados nesta etapa; necessários antes de distribuir uma nova versão Desktop.
