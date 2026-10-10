# Indicadores de mensagens não lidas

Implementação preparada localmente, sem publicação nem alteração do Supabase de produção.

## Comportamento

- Bolinhas vermelhas com quantidade nos servidores, canais de texto e conversas privadas. Acima de 99, exibem `99+`.
- Servidores somam as mensagens não lidas dos canais acessíveis ao usuário. O título do indicador informa também as menções pendentes.
- Mensagens enviadas pelo próprio usuário não aumentam a contagem. Nos servidores, mensagens anteriores à entrada do membro não são contadas.
- A leitura é persistida no banco e sincronizada em tempo real. Recarregar a página não apaga os indicadores.
- A leitura automática exige janela visível, com foco e chat rolado até o final. Marcar manualmente como lido continua disponível.
- Não Perturbe continua controlando os alertas existentes; as contagens visuais permanecem disponíveis.
- Uma assinatura compartilhada atualiza as contagens, agrupando eventos em 200 ms, sem polling periódico ou animações.

## Implantação

Aplicar antes de publicar os clientes:

`supabase/migrations/20261010010000_persistent_unread_badges.sql`

A migration cria três RPCs com identidade derivada de `auth.uid()`, valida o acesso ao canal/conversa e utiliza RLS. Também inclui `channel_read_states` na publicação Realtime quando necessário. Não cria tabelas, não exige novas variáveis de ambiente e não altera configurações de voz.

## Validação

- `npm test`: 163 testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run lint`: sem erros; 44 avisos preexistentes.
- `npm run build:vercel` e `npm run desktop:build`: aprovados, incluindo a verificação de credenciais executada pelos builds.
- Testes SQL locais com rollback: contagem inicial, menções, exclusão de mensagens próprias, leitura parcial, leitura completa, cursor monotônico, privados e rejeição de não membros.
- Prévia dos componentes reais: `npx vite --config tests/unread/vite.config.mjs --host 127.0.0.1 --port 5192`, abrindo `/tests/unread/index.html`.
- A prévia usa dados ilustrativos, sem acesso a contas reais. A validação com múltiplas contas em produção depende da implantação da migration e do cliente.
