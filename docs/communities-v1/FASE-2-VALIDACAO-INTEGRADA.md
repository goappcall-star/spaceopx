# Comunidades V1 — validação integrada da Fase 2

Data: 21/10/2026. Fonte: `codex/communities-v1`, commit funcional `f08c38b`.

**Decisão: publicação não recomendada.** A validação autenticada está bloqueada
por infraestrutura. Nenhum cenário WEB/EXE foi considerado aprovado por simulação,
SQL isolado, build ou ausência de erro na execução de um teste ignorado.

## 1. Infraestrutura verificada

| Item                         | Resultado observado nesta execução                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Node / npm                   | Disponíveis: Node 24.14.1, npm 11.11.0                                                                                     |
| Supabase CLI inicial         | Ausente no PATH e nos locais/cache examinados                                                                              |
| Supabase CLI após preparação | **2.121.0 instalada somente na pasta descartável**, versão executada e confirmada                                          |
| Docker Desktop / engine      | Não encontrado no PATH, locais de instalação convencionais/sob usuário, processos, serviços ou inventário de desinstalação |
| Podman / Rancher Desktop     | Não encontrados nos locais/processos/inventário examinados                                                                 |
| GoTrue / PostgREST           | Sem binários standalone encontrados ou serviços disponíveis nos endpoints locais examinados                                |
| WSL                          | Versão 3.0.3.0 instalada; `wsl --list --verbose` informa que não há distribuições instaladas                               |
| PostgreSQL anterior          | Binários locais disponíveis, servidor de testes parado; não reutilizado como substituto da stack                           |
| Portas convencionais         | Sem listeners nas portas examinadas: 54321, 54322, 8000, 9999, 3000, 55468 e 5208                                          |
| Portas do novo laboratório   | 55360–55369 sem listeners após a tentativa de inicialização                                                                |

Isso não equivale a diagnosticar virtualização desabilitada, incompatibilidade
do hardware ou corrupção do Windows. Essas condições não foram verificadas.
Nenhuma instalação de Docker/WSL, alteração de recurso do Windows ou reinicialização
foi realizada.

## 2. Preparação concluída, stack não iniciada

Diretório exclusivo:
`C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/community-phase2-validation-20261021/`.

- CLI fixada em 2.121.0 em `cli/`, com package-lock próprio; sem mudar dependências
  do aplicativo ou instalar CLI global.
- Projeto novo criado pela CLI em `supabase-local/`.
- Identificador **`lobbyx-community-validation-20261021`**, diferente do projeto
  configurado no repositório existente. O arquivo existente permaneceu intacto.
- API planejada em `http://127.0.0.1:55361`, banco 55362, Studio 55363 e Mailpit 55364.
- Redirecionamentos de teste locais, sem copiar `.env`, usuários, banco, dump,
  credenciais, vínculos remotos ou secrets de produção.
- **39 migrations copiadas**, incluindo a base necessária e as Fases 1 e 2, com
  manifesto SHA-256 por arquivo. Copiar arquivos **não significa aplicar SQL**.
- Seed separado preparado para buckets privados de arquivos/imagens com limites
  equivalentes aos esperados pelo aplicativo. Não cria usuários reais ou dados
  de produção. O seed também **não foi executado**.
- Arquivo `discardable-confirmation.json` registra o escopo descartável autorizado
  pelo pedido do usuário, origem local esperada e proibição de produção.
- Analytics e Edge Runtime desativados nessa configuração de laboratório;
  Auth, API, Realtime e Storage permanecem previstos para a validação necessária.

A tentativa real de `supabase start` usou esse diretório novo e um ambiente sem
variáveis herdadas Supabase/Vite, credenciais, tokens ou URLs de banco.

**Falha observada — código de saída da CLI: 1**:

```text
DockerLifecycleInspectError
failed to inspect container health: docker: command not found
(podman also not found) — install Docker Desktop or Podman and ensure it is on PATH
```

Nenhum serviço foi inicializado, nenhum banco local novo ficou disponível e
nenhuma migration foi aplicada nesta validação. Não foram usados `--linked`,
`--project-ref`, `db push`, conexão remota ou `--ignore-health-check`.

## 3. Teste HTTP autenticado

Executado o comando existente `npm run test:community-http`, com:

```text
COMMUNITY_HTTP_TEST_RUN=1
COMMUNITY_HTTP_TEST_URL=http://127.0.0.1:55361
```

A confirmação descartável foi validada pelo wrapper. As variáveis de chave anon
e service_role **não puderam ser preenchidas com credenciais genuínas do novo
ambiente**, pois a stack não iniciou. Não foram inventadas chaves nem reutilizadas
as de outro projeto.

Saída real:

```text
SKIP: isolated GoTrue HTTP service unavailable; SQL results do not validate HTTP authentication.
```

O script npm atual retorna 0 nessa saída de SKIP. Esse código **não foi tratado
como aprovação**: o wrapper do laboratório classificou o resultado como
`BLOCKED_INFRASTRUCTURE`, `authenticatedIntegrationPassed: false`, e terminou
sem sucesso. Portanto, a execução chegou somente ao preflight; nenhum login
GoTrue, JWT real, RPC autenticada ou operação PostgREST foi validado agora.

## 4. Resultados por ambiente e cenário

Legenda: **preparado** = arquivos/ferramentas criados; **bloqueado** = cenário
funcional não executado; **inspeção** = constatação pelo código, sem teste real.

| Ambiente          | Cenário                                                   | Resultado nesta execução / pendência                                         |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Laboratório       | Instalar CLI e inicializar configuração independente      | Preparado e verificado                                                       |
| Stack local       | Iniciar PostgreSQL, GoTrue, PostgREST, Storage e Realtime | Bloqueado: Docker/Podman ausentes                                            |
| Banco da stack    | Aplicar base + migrations Fases 1 e 2                     | Bloqueado; arquivos somente copiados                                         |
| HTTP              | Ativar, desativar e reativar comunidade                   | Bloqueado; nenhuma transação HTTP                                            |
| HTTP              | Proprietário                                              | Bloqueado; nenhuma identidade autenticada criada                             |
| HTTP              | Gestor delegado                                           | Bloqueado; delegação real não executada                                      |
| HTTP              | Administrador sem delegação                               | Bloqueado; recusa real ainda não confirmada                                  |
| HTTP              | Membro comum / outro servidor                             | Bloqueado; RLS via JWT/PostgREST pendente                                    |
| HTTP              | Regras, aceite, rascunho e conclusão                      | Bloqueado                                                                    |
| HTTP              | Cargo seguro, cargo privilegiado e alteração concorrente  | Bloqueado                                                                    |
| WEB, duas sessões | Revogar delegação e alterar regras com formulário aberto  | Bloqueado; não foram abertas sessões artificiais para alegar êxito           |
| Storage / WEB     | Upload autenticado, assinatura e exibição de banner       | Bloqueado; seed de buckets não executado; ver compatibilidade abaixo         |
| WEB               | Login, alternância de conta e servidor                    | Bloqueado; nenhum frontend foi apontado à produção para contornar isso       |
| Desktop           | Login e alternância de conta/servidor em perfil de testes | Bloqueado por stack e preparação específica do Desktop                       |
| WEB ↔ Desktop     | Mensagens e notificações reais                            | Bloqueado                                                                    |
| WEB ↔ WEB         | Voz e compartilhamento com áudio                          | Bloqueado; sem clientes/contas conectados                                    |
| WEB ↔ EXE         | Voz e compartilhamento nos dois sentidos                  | Bloqueado                                                                    |
| EXE ↔ EXE         | Voz e compartilhamento com áudio                          | Bloqueado                                                                    |
| WEB / Desktop     | Reconexão de rede e regressões durante chamada            | Bloqueado; rede do computador não foi interrompida                           |
| Fonte             | Regressões de código causadas por esta execução           | Nenhuma alteração no código do aplicativo; somente este relatório versionado |
| Produção          | Publicação, migration, usuários e atualização automática  | Nenhuma ação realizada                                                       |

Os 241 testes, SQL e builds da entrega anterior continuam sendo evidência
histórica da Fase 2, não resultados de autenticação real desta execução. Não
foram repetidos para substituir os testes críticos solicitados.

## 5. Compatibilidades identificadas por inspeção

Esses pontos são **impedimentos a preparar/verificar**, não falhas observadas
em sessões autenticadas, que ainda não existiram:

1. `desktop/security.cjs` permite `connect-src` apenas para a própria origem e
   HTTPS/WSS `*.supabase.co`. O backend de laboratório HTTP/WS localhost não está
   autorizado. As diretivas de imagem/mídia também não liberam HTTP local.
2. A validação de imagens no cliente e na migration comunitária exige HTTPS.
   URLs assinadas produzidas pelo Storage local HTTP precisam de um endpoint
   HTTPS confiável de laboratório ou de uma adaptação estritamente de teste.
   Não remover a exigência HTTPS do aplicativo estável nem ignorar certificados.
3. O Electron utiliza `persist:lobbyx`, `userData` padrão e bloqueio de instância
   única. Um cliente de teste deve usar perfil/diretório próprios **antes** do
   lock para não compartilhar sessão ou interagir com o aplicativo instalado.
   O updater já não é instalado em execução não empacotada, mas isso deve ser
   conferido no cliente de laboratório antes de abrir sessões.
4. O Storage espera buckets existentes. As migrations ajustam limites e políticas,
   mas não provisionam todos os buckets. O seed local foi preparado para isso.

Nenhuma dessas proteções ou partes do sistema de chamadas foi alterada nesta
execução. Não foi aberto o EXE estável, que pode conter configuração de produção.

## 6. Evidências e integridade

Todos os itens abaixo estão no diretório exclusivo de validação:

- `infrastructure.json`: PATH, locais convencionais e por usuário, serviços,
  registro de programas e listeners examinados.
- `wsl-version.txt`, `wsl-distributions.txt`.
- `cli-install.log`, `cli-init.log`, package-lock da CLI.
- `stack-start.log`: erro real da tentativa de inicializar o projeto novo.
- `migration-manifest.json`: os 39 arquivos e seus hashes.
- `http-test.log`, `http-result.json`: SKIP e classificação sem sucesso.
- `prepare-isolated.mjs`, `run-http-validation.mjs`: preparação e execução com
  ambiente limpo. O preparador só foi executado nesta pasta nova; não é rotina
  de reset ou atualização de ambientes já populados.
- Configuração, migrations copiadas, seed e confirmação em `supabase-local/`.

Não há capturas de interface autenticada nesta rodada, pois não foi possível
estabelecer autenticação. Capturas antigas com fixtures não foram reapresentadas
como se fossem WEB/EXE autenticados.

O instalador estável 0.1.58 mantém SHA-256:
`1747ce503f316689ba82bfbd47093cd1dd730ec9abc3e9ac810a745384a3831a`.
Não foram alterados fonte funcional, versão, instalador, updater, ambiente de
produção ou histórico publicado. Nenhum push foi feito.

## 7. Alternativas e sequência para desbloquear

**Alternativa local:** disponibilizar Docker Desktop ou outro runtime compatível
com Docker, funcionando no Windows, mantendo esta pasta como projeto exclusivo.
A CLI está instalada; o bloqueio restante não se resolve com mais uma instalação
de CLI. A configuração de virtualização/WSL pode exigir ações no Windows, conforme
o backend escolhido; não foi iniciada alteração nem reinicialização automática.

**Alternativa isolada:** uma máquina/VM de testes dedicada com runtime compatível,
ou Linux suportado pelo runtime nativo experimental do Supabase. Isso exige
preparar esse ambiente e seus clientes; não é autorização para acessar um projeto
hospedado existente ou reutilizar dados/credenciais de produção. O runtime nativo
documentado não é um substituto disponível diretamente neste Windows.

Com runtime disponível, a sequência é:

1. Confirmar identidade descartável, diretório e portas; iniciar a stack própria
   com todos os serviços críticos saudáveis, sem ignorar health checks. Verificar
   que serviços não são expostos à rede externa antes de criar contas.
2. Aplicar migrations locais pendentes com `migration up --local` **nesse diretório**;
   não usar flags de projeto vinculado ou URL remota. Conferir e executar o seed
   local de buckets somente na stack recém-criada. Não usar o bootstrap SQL que
   simula Auth/Storage dos testes unitários de banco.
3. Obter as chaves geradas pela stack local, mantê-las privadas e executar o HTTP
   real com os dois valores exigidos. A service_role nunca vai para Vite/Electron.
4. Estender a execução real aos quatro papéis e duas sessões: o script existente
   cobre proprietário/membro/não membro, mas não é, sozinho, toda a matriz pedida.
5. Preparar WEB e cópia Desktop de teste com origem, TLS/CSP e perfil isolados.
   Não usar os helpers de build anteriores que carregam configuração de publicação.
6. Validar banner, notificações, trocas de conta/servidor, chamadas e tela/áudio
   reais. Testar perda de rede somente no cliente de teste, sem interromper a
   conectividade geral do computador. Registrar falhas e reconexão por cenário.

**Critério para recomendar publicação:** HTTP autenticado/RLS e os cenários
críticos WEB/EXE aprovados com evidências reais, sem bloqueios de segurança,
vazamento entre contas, chamadas presas ou regressão de áudio/tela. Esse critério
não foi atingido. A Fase 3 e qualquer publicação permanecem pendentes.

Fontes oficiais consultadas para as alternativas e requisitos:
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started),
[runtimes Docker e nativo](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes),
[configuração de projeto local](https://supabase.com/docs/guides/local-development/cli/config),
[Docker Desktop no Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
