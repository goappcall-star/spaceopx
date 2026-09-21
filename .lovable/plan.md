# Estabilizar chamadas do LOBBYX

## Objetivo
Corrigir o ciclo de vida existente de voz, câmera e compartilhamento sem alterar o visual nem criar um sistema paralelo.

## Implementação
- Tornar cada entrada uma sessão isolada, com identidade própria usada também na sinalização WebRTC.
- Serializar entrada e saída para impedir que callbacks, timers ou limpezas antigos alterem uma sessão nova.
- Publicar e remover presença no canal correto, aguardando a remoção na saída e restaurando-a após reconexão.
- Garantir que o estado visual local inclua o próprio usuário imediatamente, sem depender do eco do servidor.
- Fechar todos os pares, canais, listeners, timers, contextos e tracks de áudio, câmera e tela ao sair.
- Impedir sinais de sessões anteriores e callbacks assíncronos de mídia de alcançarem a sessão atual.
- Manter reconexão por participante sem remover presença ou derrubar os demais usuários.

## Validação
- Verificação automatizada do ciclo: entrar, permanecer, sair e repetir várias vezes.
- Cenários autenticados com 2 e 3 participantes: saída e retorno de A sem alterar B/C.
- Confirmar presença visual imediata, novas sessões/conexões a cada entrada e ausência de recursos antigos após saída.
- Executar as verificações de código existentes e remover logs temporários de diagnóstico.

## Fora do escopo
- Mudanças visuais, novas funcionalidades, polling, reload ou substituição da arquitetura atual.
