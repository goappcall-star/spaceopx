# Estatísticas e cosméticos — operação local 4C

Este guia não autoriza produção, publicação, push ou habilitação de ganhos. Usar a branch `codex/communities-v1`; a feature permanece desligada por padrão.

## Conferência visual sem backend

Executar `npm run preview:community-evolution` no repositório e abrir `http://127.0.0.1:5212/`. O aviso permanente identifica dados fictícios. Equipar/remover altera apenas memória da página; recarregar reinicia o cenário. Conferir Home, Estatísticas, Personalização, quatro itens disponíveis, moldura bloqueada e período sem registros. A prévia não equivale a autenticação real nem concede recompensas.

## Banco descartável

O runner `npm run test:community-db` aceita o runtime nativo indicado por `PG_BINDIR` e usa exclusivamente a infraestrutura local reconhecida pelo marcador `lobbyx-local-test-only.json`, porta 55468 em loopback. Consulte as validações de destino em `scripts/test-community-db.mjs` antes de executar. Não apontar variáveis para projeto remoto ou banco real. O runner cria bancos novos, aplica a cadeia incremental e executa fixtures sintéticas; não apaga os bancos de evidência.

A migration 4C deve vir após a 4B. Não repetir a migration sobre banco já migrado. Ela é transacional, não preenche recompensas antigas e não habilita políticas de ganho. Os testes de concorrência habilitam fontes apenas dentro de bancos sintéticos e restauram as flags ao fim.

## Contratos e recuperação

- Leitura visual: `get_community_cosmetics(server)`; acesso de membro válido a comunidade ativa.
- Estatísticas: `get_community_statistics(server, from, to, before, limit)`, datas UTC e fim exclusivo; somente proprietário/gestor explícito.
- Equipar/remover: `equip_community_cosmetic(server, slot, reward ou null, expected_revision)`; usar a revisão mais recente do backend.
- Após erro de revisão/permissão/disponibilidade, recarregar o estado e deixar a pessoa revisar a nova seleção. Não repetir gravações cegamente.
- Pausar a fonte de missão retira sua aparência efetiva, preservando a seleção para remoção. Desativar Comunidade preserva o histórico.
- Remover cosmético revela a configuração original; não recuperar banner copiando URLs antigas, pois o serviço existente usa URLs assinadas.

Não conceder contratos manualmente em produção, inserir atividades para simular usuários reais ou ativar fontes para liberar a moldura. Não usar testes SQL com claims sintéticas como evidência de autenticação HTTP.

Para contenção futura, desligar a feature e manter dados; uma reversão de schema requer análise própria e autorização, sobretudo após novos desbloqueios. Não foi fornecido script automático de exclusão.
