# Eventos 3A — processamento confiável de avisos

Esta documentação prepara uma operação futura. **Não instala cron, não publica
função e não autoriza SQL remoto.** A migration e os testes são locais.

Após aplicar a migration em um ambiente explicitamente autorizado, um worker
confiável pode executar periodicamente:

```sql
SELECT public.dispatch_community_event_notifications(100);
```

Somente owner do banco/service_role pode executar. Nunca conceder à role
authenticated/anon ou disponibilizar chave privilegiada em Vite/Electron.
O retorno é a quantidade de assinaturas processadas, não a quantidade de avisos:
uma assinatura pode gerar atualização e lembrete na mesma passagem.

A rotina considera escolhas interested/going, opt-in, membro atual, comunidade
ativa, ausência de banimento e acesso ao canal. Só cria lembrete quando o início
está no futuro e dentro de 15 minutos. Atualizações/cancelamentos dependem de
revisão ainda não notificada. A assinatura é bloqueada e a entrega possui chave
única; dois workers não criam dois registros iguais. O limite máximo é 500.

Chamadas repetidas esvaziam lotes pendentes. Antes de habilitar um scheduler,
validar volume e cadência, observar erros/atrasos, monitorar pendências e testar
o comportamento quando o evento muda de horário/canal ou é cancelado. Não usar
um timer do cliente como autoridade nem afirmar que o job está ativo só porque
a função foi criada. Nenhum scheduler é necessário para executar os testes SQL.

O cliente lê a caixa com RLS/projeção atual e pode marcar seus registros como
lidos. A API do sistema operacional é opcional, depende de permissão previamente
concedida e de o app estar aberto. Entrega com app fechado exige infraestrutura
própria que não foi instalada nesta fase.

Os testes em `tests/community-events.sql` exercitam o processamento persistido;
o runner também executa duas instâncias concorrentes. Isso valida a função no
PostgreSQL isolado, sem equivaler a validar um serviço cron, GoTrue, push ou um
cliente WEB/EXE autenticado.
