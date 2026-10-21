# Comunidades LobbyX V1 — Fase 2 local

Data: 21/10/2026. Branch: `codex/communities-v1`.
Ponto de recuperação da Fase 1: `2e01bd903ff8199af076627e8e42a56fadb0e169`.
Versão estável preservada: 0.1.58. Sem alteração de versão ou instalador.

## 1. Revisão da fundação

Foram revisados o relatório, o plano, a migration, os RPCs, os guards de cargos,
os serviços, hooks e configurações da Fase 1. A suíte SQL anterior foi executada
novamente sobre o schema completo, com a migration incremental da Fase 2.
Os contratos anteriores permanecem operacionais: ativar, editar, desativar,
reativar e delegar gestão explicitamente, preservando o mesmo servidor.

A projeção privada da Fase 1 foi estendida para **excluir as novas colunas**.
Assim, os RPCs antigos não passam a expor referências de canais/configurações
novas por efeito de `to_jsonb` sobre o registro ampliado. Nenhuma migration
anterior foi reescrita. Os tipos TypeScript incluem as tabelas e RPCs novos.

Nenhum recurso arquivado foi restaurado. Não houve alteração dos provedores de
voz, captura, sinalização, hotbar, mecanismos de envio de mensagens ou XP.
O banco adiciona somente a restrição específica de texto descrita abaixo.

## 2. Funcionalidades concluídas

### Home exclusiva da comunidade

- Entrada lateral “Início da comunidade” para comunidades ativas.
- Banner próprio opcional; fallback para banner, ícone, nome e descrição existentes.
- Texto de apresentação, interesses da fundação e identificação do servidor.
- Até cinco avisos editoriais fixados, definidos pela administração. Não são cópias
  automáticas de mensagens privadas; o editor informa que serão visíveis aos membros.
- Cards de salas de voz com participantes observados pelo provedor existente.
  Não se inventam ocupação, participantes ou estatísticas; ausência de observação
  é indicada. “Ver sala” abre a visualização existente, sem adicionar autoentrada.
- Até dez canais em destaque, respeitando servidor e permissão de visualização.
- Interesses reais configurados e área de eventos com indisponibilidade explícita.
- Ordem configurável dos cinco módulos. Layout com grade Desktop e coluna móvel.

A Home não substitui canais nem remove a navegação lateral. Links de canal e
retorno à chamada continuam levando ao destino original. A seleção da Home
não inicia uma chamada. O conteúdo usa componentes, tokens e logo existentes.

### Onboarding modular

Mensagem de boas-vindas, regras, interesses opcionais, sugestões de canais,
cargos opcionais e revisão final. Cada etapa de conteúdo pode ser desativada.
“Continuar” salva as escolhas antes de avançar; “Salvar e sair” permite retomada.
As escolhas são recuperadas ao reabrir, começando a revisão pela primeira etapa;
o número exato da etapa interrompida não é persistido.

O aceite referencia a revisão atual das regras. Revisões anteriores são
preservadas como snapshots no banco; a seleção de interesses não altera as
regras aceitas. Mudança de revisão durante um formulário aberto gera conflito,
sem sobrescrita ou atribuição parcial. Erro de rede não é exibido como sucesso.

Cargos são atribuídos **somente ao concluir**, pela RPC. Rascunho não concede
cargos. Repetir a conclusão não duplica associações. O usuário pode escolher
nenhum cargo/interesse. Desmarcar uma escolha posteriormente não remove cargos
que ele já possui, evitando retirar atribuições administrativas legítimas.

Se a Home for desativada, a lateral mantém “Boas-vindas da comunidade”, com
acesso ao onboarding. Assim, desativar a página não impede aceitar regras.

### Personalização

Configurações → Comunidade → Personalizar experiência:

- Ativar/desativar Home; texto e banner HTTPS próprios.
- Upload de banner reutiliza o serviço privado existente e o limite de 8 MB,
  somente quando o usuário já possui a permissão de edição de perfil do servidor.
  A delegação comunitária não amplia permissões do Storage.
- Avisos, canais em destaque e ordem dos módulos.
- Texto e preferências de boas-vindas; etapas e aceite obrigatório.
- Lista de cargos seguros permitidos para seleção.

O proprietário e gestores expressamente delegados podem configurar essa
experiência. Administrador sem delegação comunitária continua sem essa capacidade.

## 3. Migration preparada e segurança

`supabase/migrations/20261021020000_community_home_onboarding.sql`:

- Acrescenta `experience`, `experience_revision` e `screening_since` à extensão
  já existente, com acesso por RPC; clientes não recebem SELECT das colunas brutas.
- Cria `community_rule_revisions`, PK `(server_id, revision)`, para snapshots.
- Cria `community_member_onboarding`, PK pelo vínculo de membro existente,
  FK de aceite para revisão e índice por servidor/membro.
- RLS permite ler somente o próprio progresso. Histórico de regras fica acessível
  ao gestor ou ao membro que aceitou aquela revisão; não há consulta pública.
- Nenhum INSERT/UPDATE/DELETE direto é concedido aos clientes nessas tabelas.
- RPCs `get_community_experience`, `save_community_experience`,
  `save_community_onboarding` e helper `community_text_allowed`.
- Payload com campos exatos, tipos, tamanhos, URLs HTTPS sem credenciais,
  caracteres de controle, limites, duplicações, referências e revisão validados.
- Escritas com limite de frequência, transação, autorização revalidada e locks.
  Mudança administrativa de experiência escreve auditoria na mesma transação.

Leitura de experiência exige membro atual e não banido. Referências de canais
são filtradas no backend para membros comuns, rechecadas pelo servidor e filtradas
novamente na UI. O estado pessoal é separado da configuração compartilhada.

### Cargos seguros

Allowlist por servidor, sem aceitar IDs arbitrários. OWNER, ADMIN, MEMBER e
cargos com marcador de proprietário são inelegíveis. Toda permissão verdadeira
fora de `view_channel`, `read_messages`, `send_messages`, `connect` e `speak`
torna um cargo inelegível, inclusive capacidades futuras/desconhecidas.

Cada atribuição revalida o cargo depois de bloquear sua linha. Um cargo que foi
alterado para privilegiado desaparece das opções e é recusado na conclusão,
mesmo com tela ou payload antigo. Cargos que já foram atribuídos continuam sob
a administração normal do servidor: uma promoção explícita posterior de um
cargo pela administração também afeta seus membros existentes, como antes.

### Escopo exato do aceite obrigatório

Quando habilitado, é necessário aceitar as regras atuais para concluir o
onboarding. Para membros que ingressarem **depois da habilitação**, o banco
também bloqueia INSERT/UPDATE de mensagens e INSERT de reações até o aceite.
Isso usa políticas RLS restritivas adicionais, inclusive contra cliente antigo
ou adulterado. Não substitui as permissões anteriores: aceitar não autoriza
um canal que o membro não pode acessar.

Membros anteriores à habilitação permanecem com o funcionamento atual. As
chamadas de voz/mídia não recebem essa restrição. Convites, ingressos e DMs não
são bloqueados pelo onboarding. A interface informa esse alcance, sem apresentar
o aceite como uma restrição global de toda a comunicação.

Desativar a comunidade desliga a restrição. Na reativação, o marco temporal é
renovado para preservar quem ingressou enquanto o servidor estava desativado.
Desligar e ligar novamente a exigência também inicia um novo marco para novos
ingressos. Uma nova revisão de regras exige renovação para os membros que
permanecem abrangidos pelo marco vigente.

Locks novos de servidor usam `FOR NO KEY UPDATE`, compatível com a verificação
de FK da auditoria de cargos. São compatíveis com a serialização da fundação,
sem provocar ciclo servidor/cargo quando um administrador altera um cargo.

## 4. Testes e resultados

| Verificação                         | Resultado                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Suíte Node completa                 | 241 testes aprovados, 0 falhas; inclui 238 anteriores e três novos testes de experiência                     |
| TypeScript                          | `npm run typecheck` aprovado                                                                                 |
| ESLint dos arquivos alterados/novos | Aprovado                                                                                                     |
| Scanner de segurança                | Sem achados; log local registra o total final                                                                |
| Build WEB com flag ligada           | Aprovado                                                                                                     |
| Build Desktop com flag ligada       | Aprovado; sem empacotar/distribuir EXE                                                                       |
| Build WEB padrão, flag ausente      | Aprovado; recurso desligado                                                                                  |
| PostgreSQL real local               | Todas as migrations, Fase 1, Fase 2 e regressões SQL aprovadas                                               |
| HTTP autenticado                    | **SKIP**, serviço GoTrue isolado indisponível; não declarado aprovado                                        |
| UI no navegador                     | Componentes reais de Home, formulário e onboarding renderizados e operados com fixtures locais identificadas |

Banco exclusivo em `127.0.0.1:55468`, diretório e marcador validados antes de
criar novo banco. Nenhuma conexão de testes com produção. Último banco retido:
`lobbyx_community_test_1792587271061`.

Cobertura SQL: servidor comum/ativado/desativado, proprietário, delegado,
administrador sem delegação, membro, não membro, anônimo (fundação), RLS e grants,
outro servidor, regras inválidas/alteradas, banners indevidos, cargos proibidos,
rascunho e conclusão, repetição, privacidade do progresso, bloqueio de mensagem,
edição e reação, etapas desativadas e reativação preservando membros anteriores.
As trocas de identidade SQL exercitam isolamento por ator e por servidor.

Concorrência real em processos PostgreSQL separados:

1. Ativação simultânea: uma confirma e outra recebe conflito.
2. Revogação enquanto save aguarda: autorização revalidada.
3. Concessão durante autoatribuição: guard do proprietário permanece eficaz.
4. Associação iniciada antes da concessão: sem deadlock na ordem inversa.
5. Cargo promovido enquanto onboarding espera: rechecagem recusa o cargo
   privilegiado, sem deadlock ou concessão parcial.

As regressões de unread-counts, everyone-mentions, write-guards, invalidação de
permissões e Performance Monitor também passaram. A suíte Node inclui regressões
existentes de chamadas/mídia; isso não é teste de voz real entre clientes.

Durante o desenvolvimento, uma execução SQL detectou precedência incorreta de
operadores na validação de aviso, e o TypeScript detectou props opcionais com
`exactOptionalPropertyTypes`. Ambos foram corrigidos antes das verificações finais.
O preview de desenvolvimento também apresentou avisos de `createRoot` em hot
reload do harness; não pertencem ao componente montado no aplicativo nem validam
ou invalidam integração de autenticação. Nenhuma falha foi ocultada como sucesso.

### Evidências

Logs em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/`:
`community-phase2-db.log`, `community-phase2-tests.log`,
`community-phase2-typecheck.log`, `community-phase2-lint.log`,
`community-phase2-security.log`, `community-phase2-web.log`,
`community-phase2-desktop.log`, `community-phase2-web-default.log`,
`community-phase2-http.log`.

Capturas dos componentes reais com dados fictícios e aviso visível:

- [Home](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-phase2-home.png)
- [Onboarding](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-phase2-onboarding.png)
- [Personalização](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-phase2-customization.png)
- [Tela estreita](/C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-phase2-mobile.png)

Na UI foram conferidos: aceite inicialmente desmarcado e avanço bloqueado,
interesses e aceite recuperados após salvar/sair, seleção de cargo, conclusão,
mudança de apresentação e reordenação dos módulos. Na largura de 390px, o
documento mede 390px sem overflow horizontal. Modais e conteúdo usam rolagem.

## 5. Integração HTTP preparada e limites reais

`npm run test:community-http` executa `scripts/test-community-http.mjs`.
O script recusa origem fora de loopback e redirecionamentos. Requer um Supabase
**descartável e isolado**, com migrations aplicadas, GoTrue e PostgREST reais,
mais `COMMUNITY_HTTP_TEST_RUN=1`, `COMMUNITY_HTTP_TEST_URL`,
`COMMUNITY_HTTP_TEST_ANON_KEY` e `COMMUNITY_HTTP_TEST_SERVICE_KEY` desse ambiente.
Nunca utilizar credenciais de produção. Chaves e senha gerada não são logadas.

Quando disponível, cria três identidades novas `example.test`, autentica por
senha via GoTrue, usa JWTs reais em PostgREST, cria servidor sintético, ativa e
configura, ingressa por convite, verifica autorização/RLS, bloqueio anterior ao
aceite, rascunho/conclusão e envio posterior, desativa e reativa. Fixtures ficam
retidas para auditoria, sem apagar usuários existentes. Na ausência do serviço,
o resultado é explicitamente SKIP. Esse roteiro está preparado, **não validado
ponta a ponta neste ambiente**.

As capturas usam callbacks locais; não constituem autenticação ou persistência
HTTP. Os contratos foram exercitados separadamente no PostgreSQL real, com
bootstrap de auth/storage e identidades SQL sintéticas. Não foi feita simulação
de JWT para alegar GoTrue/PostgREST validado.

Não foram validados nesta entrega: clientes WEB e EXE autenticados simultâneos,
troca de conta em aplicativo logado, notificações reais, áudio real, reconexão
Realtime, upload autenticado de banner ou estabilidade de chamada com usuários
reais. Também não houve carga com milhares de membros nem medição CPU/GPU.
Esses pontos permanecem pendentes antes de qualquer publicação.

## 6. Arquivos modificados

Novos:

- Migration `20261021020000_community_home_onboarding.sql`.
- `src/types/community-experience.ts`, `src/lib/community-experience.ts`.
- `src/services/community-experience.ts`, `src/hooks/use-community-experience.ts`.
- `src/components/community/CommunityHome.tsx`, `CommunityOnboarding.tsx`,
  `CommunityCustomization.tsx` e `CommunityWorkspace.tsx`.
- `tests/community-experience.sql`, `tests/community-experience.test.mjs`.
- `scripts/test-community-http.mjs` e este relatório.

Estendidos: `src/routes/_authenticated/app.tsx`, `ChannelSidebar.tsx`,
`SettingsCommunity.tsx`, tipos Supabase, `services/communities.ts`,
`scripts/test-community-db.mjs` e scripts do `package.json`.

O cache novo inclui usuário e servidor, não usa placeholder de outra conta e é
descartado sem observadores. O workspace é recriado por usuário/servidor. A Home
reutiliza presença existente, sem outra conexão WebRTC/Realtime. Servidores comuns
retornam null e não ficam no polling periódico; comunidades são revalidadas a
cada 15s enquanto observadas. Flag desligada não consulta os novos RPCs.

## 7. Riscos, reversão e próximos passos

O recurso continua opt-in pela mesma flag `VITE_COMMUNITIES_V1_ENABLED=true`,
desligada nos builds normais. Nenhum deploy, push, migration em produção,
atualização automática ou distribuição de EXE foi realizado.

Rollback funcional: **primeiro** desativar a comunidade ou a exigência de regras
no banco local; **depois** desligar a flag do cliente. Só ocultar a interface não
remove uma política de texto já configurada no banco. Dados e escolhas são
preservados. Reversão física exige análise própria e backup; não foi incluído
DROP ou script que apague o progresso dos membros.

A edição de um cargo já atribuído continua sendo uma ação administrativa com
efeito em todos os seus membros. URLs de banners podem expirar conforme o serviço
de imagens existente; o componente possui fallback visual. Avisos são conteúdo
compartilhado editorial, portanto o administrador deve evitar transcrever canais
privados. Nenhum conteúdo privado é promovido automaticamente.

Próximos passos: executar o roteiro HTTP no Supabase isolado completo; validar
dois usuários reais em WEB/EXE, revogação/alteração de regras com formulário aberto,
troca de conta/servidor, upload, voz, compartilhamento e notificações. Somente
depois avaliar publicação sob autorização específica. Eventos, descoberta,
métricas e evolução continuam fora desta fase.
