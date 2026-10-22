# Criar / entrar em servidor — redesign local

22/10/2026 · branch `codex/communities-v1` · base `43796de`.

## Implementação

A referência foi usada para a composição com painel de identidade à esquerda, escolhas Criar/Entrar no topo e formulário compacto à direita. A identidade oficial, componentes Button/Input/Dialog/Tooltip e tokens atuais foram preservados. O acabamento usa grafite, verde-limão nas ações principais e roxo nos elementos secundários. A ilustração é feita com ícones vetoriais existentes e CSS estático, sem novas dependências ou efeitos animados.

- Botão novo com ícone de pessoas e convite, acabamento sólido e tooltip com título/explicação. Fica como último item **dentro** da lista rolável, logo após os servidores, com espaço consistente. Não é fixo no fundo. Social continua na posição existente.
- Criar: nome (2–60 caracteres), descrição opcional (até 200), ícone PNG/JPG/WEBP/GIF (até 4 MB), categoria Gaming/Tecnologia/Estudos/Arte/Outro e visibilidade Público/Privado. A visibilidade inicial permanece privada.
- Entrar: código, link HTTP/HTTPS com `/invite/<código>` ou link desktop `lobbyx://invite/<código>`. Nenhuma navegação para o domínio colado: só o código é enviado ao backend atual. Consulta opcional do convite mostra dados devolvidos pela RPC; entrada continua sendo confirmada pelo backend.
- Rascunhos são mantidos ao alternar Criar/Entrar. Erros não limpam os campos, solicitações repetidas são bloqueadas enquanto pendentes e respostas antigas de consulta não substituem um código novo.
- Ícone: prévia local com Blob URL e liberação da URL ao trocar/remover/desmontar. Envio usa o serviço existente de imagens no espaço privado do usuário, sem modificar o perfil. Upload concluído é reutilizado em nova tentativa de criação com o mesmo arquivo.
- Sucesso seleciona o servidor e volta à área de servidores, inclusive quando o modal foi aberto pela Central Social. Não altera a chamada de voz ativa. Entrada mantém a invalidação de caches já usada pelo fluxo anterior.
- Criação não ativa Comunidade; visibilidade pública **não** publica no Explorar e não libera canais privados. A publicação continua sendo uma escolha separada.

## Banco e preservação da lógica

Migration preparada: `supabase/migrations/20261022010000_server_creation_options.sql`.

Adiciona somente `servers.theme` com valor inicial `other` e restrição das cinco categorias. A RPC nova `create_server_with_options` valida as opções, chama a criação transacional existente (`create_server`) e grava categoria/visibilidade na mesma transação, sob RLS do chamador. Preserva IDs, cargos OWNER/ADMIN/MEMBER, associação do proprietário e canal #geral. Uma falha na etapa adicional desfaz a criação inteira. A RPC original e seus defaults continuam compatíveis com clientes antigos.

A nova função é SECURITY INVOKER, com caminho de busca explícito, sem acesso de anon/PUBLIC e sem nova entidade paralela. Não há alteração das permissões de Storage, voz, chat ou comunidade. A reversão exige primeiro voltar os clientes ao contrato antigo e preservar os metadados de categoria antes de remover a coluna; nenhuma reversão destrutiva foi executada.

**Migration aplicada somente em PostgreSQL local isolado, em banco descartável novo. Não foi aplicada em produção. O novo fluxo de criação exige essa migration antes de uma futura publicação.**

## Arquivos principais

- `src/components/app/ServerAccessButton.tsx`, `ServerAccessDialog.tsx`, `ServerAccessDialogView.tsx` e `server-access.css`.
- `ServerRail.tsx`: posição do botão e limite da rolagem.
- `CreateServerDialog.tsx` / `JoinServerDialog.tsx`: entradas compatíveis que reutilizam o novo controlador/modal.
- `src/lib/server-access.ts`: validação e leitura de convites.
- `src/services/servers.ts`: RPC nova quando há opções; caminho legado preservado.
- `src/integrations/supabase/types.ts`: coluna e contrato RPC.
- `src/routes/_authenticated/app.tsx`: retorno para a área de servidores após criar/entrar; nenhum provedor de voz alterado.
- `tests/server-access-preview/preview.tsx` e prévia unificada: componentes reais com callbacks em memória, identificados como fictícios.
- `tests/server-access.test.mjs`, `tests/community-visual.test.mjs`, `tests/server-access.sql` e inclusão no runner SQL local.

## Testes

| Verificação                   | Resultado                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node completo                 | **293 aprovados, 0 falhas, 0 ignorados**.                                                                                                                                                                                                                                                                                     |
| Novos cenários Node           | Campos/categorias/visibilidade/ícone; extração de códigos e URLs; RPC antiga versus nova; preservação de rascunhos entre modos; envio duplicado e erro; resposta atrasada de convite; botão no fim da lista com 0/1/20 servidores.                                                                                            |
| TypeScript                    | Aprovado.                                                                                                                                                                                                                                                                                                                     |
| ESLint dos arquivos alterados | Aprovado, incluindo controlador e callbacks da rota.                                                                                                                                                                                                                                                                          |
| Scanner                       | Sem achados (769 arquivos verificados na execução registrada).                                                                                                                                                                                                                                                                |
| SQL local                     | Cadeia completa de migrations e suites anteriores aprovadas, incluindo concorrência e RLS; testes novos de criação com opções, defaults legados, cargos/canal/proprietário, opções inválidas, anonimato, privacidade de canais e rollback integral após falha sintética. Banco retido: `lobbyx_community_test_1792644816170`. |
| Build WEB                     | Aprovado com configuração local de compilação sem credenciais operacionais.                                                                                                                                                                                                                                                   |
| Build Desktop                 | Aprovado; nenhum instalador gerado/distribuído.                                                                                                                                                                                                                                                                               |
| Build da prévia               | Aprovado, saída local em `vo/work/server-access-preview-build`.                                                                                                                                                                                                                                                               |

Durante o acabamento, foi identificado e corrigido o rodapé cortado na primeira composição do modal: agora a altura é limitada e só o conteúdo interno rola. Uma falha de teste veio da comparação de Error entre contextos VM distintos; o harness foi ajustado para representar o mesmo contexto de erros do navegador, sem afrouxar o comportamento da interface. Achados iniciais de lint foram corrigidos.

Logs em `vo/work/server-access-{all-tests,tests,typecheck,lint,controller-lint,security,db,web,desktop,preview-build}.log`.

## Validação da interface

Na prévia real foram conferidos: upload/preview local de PNG, troca Criar/Entrar mantendo texto e arquivo, criação fictícia acrescentando o item à barra, convite inválido mantendo o campo, consulta e ingresso por `lobbyx-demo`, lista vazia e lista com 20 itens.

No teste da lista curta, o último servidor terminava em Y=572 e o botão começava em Y=584. Na lista longa, a área tinha 352 px de altura e 1176 px de conteúdo; Tab a partir do servidor 20 levou ao botão, rolando-o para dentro da área. O tooltip também apareceu pelo foco de teclado.

Verificações responsivas: 1366×768, janela Full HD e 390×844. Em 1366×768 o botão principal terminou em Y≈720, dentro do modal (limite Y≈737). Em 390×844 o modal ficou entre Y=42 e Y=802 e o botão terminou em Y=785, sem rolagem horizontal na amostra verificada. Opções de modo ficam mais compactas no móvel e o formulário mantém rolagem interna.

Não se trata de certificação completa de acessibilidade nem teste de DPI/zoom do Windows.

## Prévia e capturas

[Abrir prévia local](http://127.0.0.1:5213/) → **Servidores**.

A prévia monta a barra e o modal reais. Criar/entrar altera apenas uma lista fictícia na memória; imagens não são enviadas. O convite de demonstração é `lobbyx-demo`. As funções reais de backend não são importadas nessa árvore, conforme teste de isolamento.

- [Criar — Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-create-1366.png)
- [Entrar — Desktop](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-join-1366.png)
- [Criar — Full HD](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-create-1920.png)
- [Criar — móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-create-mobile.png)
- [Entrar — móvel](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-join-mobile.png)
- [Barra com lista longa e tooltip](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/server-access-rail-long.png)

## Limitações e próxima avaliação

Testes SQL usam roles e `auth.uid()` sintéticos no PostgreSQL local; não equivalem a JWT/GoTrue/PostgREST autenticados. Upload e criação/entrada reais com contas WEB/EXE continuam pendentes de ambiente autorizado apropriado. O limite de 4 MB acompanha o Storage existente, em vez dos 5 MB ilustrativos do mockup. Imagens seguem o padrão atual de URL assinada, com validade de um ano; arquivos enviados antes de uma criação cancelada/falha podem permanecer como ativos sem referência, sem limpeza automática nesta entrega.

Público não significa entrada irrestrita: convites, banimentos, regras e publicação no diretório mantêm seus mecanismos existentes. Não foram adicionadas estatísticas inventadas ou descoberta automática.

Nenhum Docker, novo Supabase, migration remota, publicação, push ou atualização automática. Versão estável 0.1.58 preservada, SHA256 do instalador: `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`. Banco local de evidência preservado. Aguardar avaliação antes de qualquer implantação.
