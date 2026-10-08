# Reconexões repetidas — diagnóstico e correção

Estado: correções locais, ainda não publicadas. Inclui a correção anterior da troca direta entre canais.

## Regressão confirmada no código

A versão 0.1.37 (`2902909`) acrescentou recuperação da presença por recriação do efeito React. O cleanup antigo removia o canal assincronamente, enquanto o efeito novo chamava `supabase.channel()` com o mesmo tópico imediatamente. O SDK instalado reutiliza o objeto registrado para aquele tópico enquanto a remoção não termina. Portanto, a inscrição nova podia usar o canal antigo, e o cleanup pendente podia fechar o objeto reutilizado. Eventos atrasados e novas tentativas mantinham a recuperação instável. Isso pode levar outros participantes a desfazer e recriar seus peers quando a presença não volta.

O teste de regressão foi executado contra o código de 0.1.37 e falhou exatamente na tentativa de inscrever novamente o objeto antigo antes da remoção. O mesmo teste passa com a correção. Um teste separado usa o SDK Supabase realmente instalado para confirmar a reutilização do tópico durante a remoção. Nenhuma conexão a produção foi utilizada nesses testes.

Também foi confirmado que uma publicação bem-sucedida não cancelava a tentativa de recuperação já agendada por uma falha anterior. Uma chamada recuperada podia continuar recriando sua inscrição sem necessidade.

## Correção

- Serialização por tópico: a inscrição nova espera a remoção da anterior, inclusive na passagem de observador para participante e em remontagens.
- Callbacks descartados após cleanup; eventos antigos não mudam a inscrição atual.
- Confirmação de publicação cancela a recuperação pendente.
- Falhas repetidas aguardam 2, 4, 8, 16 e até 30 segundos, em vez de recriar o canal a cada 2 segundos indefinidamente. O contador só é reiniciado após confirmação de publicação.
- Confirmações de saída limitadas; sem desconectar o cliente Realtime compartilhado ou o canal de sinalização WebRTC.
- Mantidas as correções da troca direta: posição local imediata, descarte de snapshots antigos e isolamento das entradas supersedidas.

## Validação

143 testes passaram, zero falhas. TypeScript e build Desktop passaram. Lint: zero erros, 44 avisos preexistentes de Fast Refresh.

Teste no navegador: RTCPeerConnection real, áudio sintético e sinalização local simulada. Chamadas privadas e de servidor passaram com áudio nas duas direções após 20 oscilações temporárias de presença cada, mantendo os mesmos streams e o estado conectado; ofertas SDP duplicadas também estavam habilitadas.

![Validação local de recuperação WebRTC](C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/presence-root-webrtc-pass.png)

Os testes cobrem remoção demorada com cache de tópicos, evento CLOSED antigo, passagem de observador para participante, publicação recuperada antes da tentativa pendente, backoff e troca rápida A → B → A. O teste da versão antiga está registrado em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/presence-baseline-regression.log`.

## Limite da conclusão

A regressão está reproduzida e corrigida no código. Ainda não foi capturado um diagnóstico da chamada no EXE do usuário com essa correção nem realizada uma chamada entre dois computadores em redes externas. O teste local não comprova que essa regressão é a única causa das reconexões observadas em produção. As correções precisam ser publicadas e validadas na chamada real.
