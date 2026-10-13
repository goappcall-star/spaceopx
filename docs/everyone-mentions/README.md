# LobbyX — @todos e navegação de menções

Implementação local. @todos é um marcador reservado que menciona os membros do servidor autorizados a ver o canal; autor excluído das notificações. O banco determina os destinatários a partir da associação real ao servidor. Membros offline mantêm os indicadores persistentes; os avisos instantâneos seguem a regra de status já existente.

## Interface
Digitar @ mostra Todos do servidor e usuários. Busca por username ou nome de exibição. Enter e Tab completam a opção selecionada sem enviar; setas navegam e Escape fecha. Enter seguinte envia normalmente, Shift+Enter preserva a quebra de linha e composição IME não dispara envio. Completar no meio do texto preserva o restante da mensagem e o cursor. Sugestões usam a lista já carregada, sem novas consultas, polling ou assinaturas.

## Backend e publicação
Migration pendente: supabase/migrations/20261013010000_server_everyone_mentions.sql. Acrescenta flag booleana mentions_everyone, calculada pelo trigger do banco, sem uma lista extensa de UUIDs por mensagem. Flag enviada pelo cliente é recalculada: não pode forçar uma menção global sem @todos. Mantém o limite de 50 menções individuais e os limites de envio existentes. Notificações persistentes preservam membership, view_channel e RLS por destinatário. A RPC get_server_unread_counts permanece SECURITY INVOKER, com o conjunto permitido e o recorte de tempo da Performance Optimization V2; conta a flag armazenada, sem analisar o texto durante a consulta de não lidas. Não altera a publicação Realtime, voz, monitor ou dados existentes. Não retroenvia notificações históricas.

A migration deve ser autorizada e aplicada antes de publicar o cliente. Sem ela, @todos não terá a notificação global completa. Nenhuma alteração em produção, push, deploy ou release executada nesta tarefa.

Rollback: docs/everyone-mentions/rollback.sql restaura as duas funções anteriores, remove o trigger e a flag derivada. Não exclui mensagens, usuários nem notificações já criadas. Reverter o cliente também, para retirar a sugestão global. Escritas de mensagens devem ser pausadas brevemente durante aplicação/reversão conforme revisão final do banco real. Commit e backup independente preservam as alterações recentes.

## Validação
215 testes automatizados aprovados, typecheck e build WEB aprovados, lint dos componentes sem erros. PostgreSQL 18 local isolado em 127.0.0.1:55462: todas as migrations, RLS, limites de escrita e fluxos existentes passaram. Teste everyone-mentions.sql verificou 60 destinatários elegíveis, exclusão do autor, bloqueio de membro sem view_channel e isolamento entre servidores e destinatários; RPC de não lidas retornou mention_count=1; flag forjada e tokens parciais/email não geraram menção global. Fixture e dados técnicos foram revertidos por ROLLBACK. Teste integrado ao runner scripts/test-security-db.mjs.

Componente real em prévia local: @ni + Enter virou @nico sem envio; @ + seta + Enter selecionou usuário; @tod + Tab virou @todos; Enter seguinte enviou somente ao stub local; Escape fechou a lista. Console sem erros. IME real, leitores de tela, entrega Realtime no Supabase de produção e clientes WEB/EXE publicados não foram testados nesta etapa. Não afirmar validação em produção.

Reversão local, reaplicação da migration e repetição dos testes de destinatários e isolamento: aprovados.
