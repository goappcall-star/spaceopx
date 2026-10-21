# Central Social — layout e privacidade

Implementação local na branch `codex/social-central-layout`, baseada na versão
0.1.57. Sem deploy, push, release, migration ou alteração de dados de produção.

## Interface

- Tela de amigos organizada conforme a referência: título violeta, busca,
  adicionar amigo, filtros com contagens, ordenação e lista/grade.
- Filtros Todos, Online (inclui Ausente e Não perturbe), Em chamada, Jogando e
  Offline. Busca por nome de exibição e @usuário; adicionar pelo @usuário mantém
  o fluxo existente.
- Painel de chamadas/atividades com controle Mostrar/Ocultar ao lado da busca.
  Preferências de painel e visualização ficam no armazenamento local por conta,
  sem armazenar dados dos amigos. Falha de armazenamento não impede o uso.
- Layout com três colunas em janelas amplas; painel abaixo da lista quando não
  há espaço para a coluna direita. Temas claro/escuro e foco de teclado.
- Solicitações recebidas reais ocupam o cartão de conexão social; quando não
  existem, há um convite para adicionar pelo @usuário. Não foram inventadas
  sugestões, contagens de amigos em comum, horários ou atividades.
- Sem botões Entrar/Convidar para jogos ou chamadas nesta implementação.
- Mensagens, solicitações, grupos, perfil resumido e ações existentes preservados.

## Visibilidade das chamadas

Presença global de ocupado **não** é usada como prova de chamada compartilhada.
O recurso apenas lê os snapshots que os provedores atuais já acompanham; não
entra em canais, não publica presença e não cria conexões de áudio/WebRTC.

Para cada canal observado, a consulta autenticada verifica a existência do canal
sob RLS, associação ao servidor, ausência de banimento e permissões
`view_channel` **e** `connect` via RPCs existentes. Participantes devem constar
como membros do servidor. Para grupos, verifica associação do observador e
participantes na conversa. Falhas não autorizam a exibição.

Só amigos com presença visível aparecem nos indicadores, avatares e contagens.
Usuários offline/invisíveis e não amigos não entram nos números. As contagens
são identificadas como amigos visíveis, não como ocupação total da sala.

As invalidações existentes de canais, membros, cargos, servidores e conversas
iniciam nova verificação. Há revalidação a cada 15 segundos enquanto a Central
está montada, e no retorno à janela/conexão. Durante consultas, pausa por rede,
erros ou ausência de presença global conectada, os indicadores são ocultados.
Não há garantia de revogação instantânea se o serviço Realtime perder um evento;
a revalidação periódica é a contingência e falha fechada.

### Limitação de cobertura

O provedor atual acompanha o servidor observado/ativo e o grupo de chamada
ativo. Esta alteração **não descobre todas as chamadas em todos os servidores
ou grupos**. Portanto, a falta de indicador não prova que o amigo não está em
chamada. O painel informa que apresenta chamadas observadas e acessíveis.
Descoberta completa exigiria um registro autorizado de atividade ou gestão
compartilhada de assinaturas; isso deve ser uma evolução separada para evitar
conflitos com os tópicos de presença que sustentam a voz atual.

## Validação

- Suíte completa: 232 testes aprovados (226 existentes + 6 novos).
- Testes novos: exigência simultânea de associação/view/connect, ausência de
  sessão, falha de rede, remoção de membros, isolamento de grupos, presença
  duplicada/não associada, revogação e contagens sem usuários invisíveis.
- Typecheck aprovado. ESLint dos arquivos alterados sem erros; um aviso
  preexistente de Fast Refresh em `SocialSidebar.tsx` (`shortTime`).
- Build WEB e build Desktop aprovados. Nenhum instalador/release distribuído.
- Verificação de segurança: nenhuma ocorrência.
- Prévia isolada com dados fictícios: filtros de chamadas/jogos, busca combinada,
  lista/grade, painel oculto após recarregar, larguras 1672 e 1024, tema claro e
  ausência de erros de console nos fluxos exercitados. Essa prévia não executa
  ações sociais no Supabase e não é prova de autenticação/RLS em produção.
- Captura da prévia: `../../outputs/social-central-preview.png`.

## Pendências antes de publicação

Validar em prévia autenticada com duas contas: mesma chamada permitida, canal
privado negado, grupo sem associação, banimento/saída do servidor, revogação de
view/connect com a tela aberta, invisível/offline e retorno de conexão. Conferir
mensagem direta, solicitação/aceite e perfil real; fazer smoke test de voz no
Desktop e WEB. Não foram declarados testes reais entre contas/clientes como
aprovados nesta tarefa.

Nenhuma alteração em RLS, permissões do banco, migrations, monitor de desempenho,
captura/transmissão de áudio ou mecanismo de atualização automática.
