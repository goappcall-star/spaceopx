# LobbyX — relatório de auditoria técnica

Data: 7 de outubro de 2026 (America/Sao_Paulo). Base: código local posterior à versão publicada 0.1.38, commit `acdaf4f`.

Foram corrigidos os problemas confirmados abaixo. As alterações estão locais: não houve publicação, alteração de dados de usuários ou aplicação de migrations no Supabase de produção. Esta auditoria amplia a cobertura de regressão; não representa garantia de ausência de qualquer bug em todas as redes, dispositivos ou contas.

## Problemas encontrados e correções

| Nº | Prioridade | Problema e causa | Correção e evidência |
|---|---|---|---|
| 1 | Alta | Mensagens podiam aparecer no chat errado após navegação rápida. INSERT de Realtime, envio e paginação continuavam escrevendo no estado após mudar de canal/conversa. | Histórico limpo ao mudar o contexto; respostas atrasadas descartadas. Testes reproduzem navegação durante hidratação, envio e paginação, nos chats de servidor e privado. |
| 2 | Alta | Uma mensagem recebida enquanto o histórico inicial carregava podia desaparecer quando a consulta terminava. | A consulta inicial é combinada com as mensagens recebidas, sem repetir IDs. Dois testes preservam a mensagem de Realtime recebida durante o carregamento. |
| 3 | Média | Sair do chat durante carregamento podia deixar indicadores de carregamento/paginação antigos. | Estado reiniciado ao trocar/desativar o contexto; operações antigas não alteram os indicadores da nova conversa. |
| 4 | Média | Falha no histórico privado rejeitava uma Promise sem tratamento e a tela aparentava uma conversa vazia. O chat de servidor também não apresentava o erro que seu hook já armazenava. | Erro tratado, carregamento encerrado e aviso acessível exibido em ambos os chats. Testes simulam falha de rede. |
| 5 | Média | Falha ao carregar mensagens antigas produzia rejeição sem tratamento. Páginas sobrepostas também podiam repetir mensagens. | Aviso de erro local, descarte de respostas fora do contexto e deduplicação por ID ao adicionar páginas. |
| 6 | Média | Respostas a mensagens antigas podiam aparecer sem o autor, porque só os autores da página atual eram buscados. | Busca complementar dos autores citados fora da página atual. Dois testes confirmam o autor da resposta em servidor e privado. |
| 7 | Alta | Selecionar novamente a saída padrão não mudava o dispositivo de áudio que já estava ativo. | `setSinkId("")` aplicado também quando a seleção vira padrão, em chamadas privadas e de servidor. Teste confirma a sequência headset → padrão. |
| 8 | Alta | Um áudio que reproduzia normalmente podia esconder o botão de desbloqueio de outro participante cujo áudio estava bloqueado pelo navegador. | Bloqueio acompanhado por stream/participante; o botão só desaparece quando todos foram liberados. Teste com dois participantes. |
| 9 | Média | Elementos de áudio remoto não tinham limpeza explícita de reprodução e `srcObject` ao serem removidos. | Reprodução pausada e associação ao stream liberada no cleanup, sem parar tracks pertencentes ao provedor WebRTC. Teste verifica pausa e `srcObject=null`. |
| 10 | Alta | Uma leitura inicial atrasada da sessão podia sobrescrever um evento mais recente de logout. Falhas nessa leitura podiam manter o login carregando. | Eventos de autenticação prevalecem sobre a leitura inicial; respostas após desmontagem são ignoradas e falhas encerram o loading. Dois testes de regressão. |
| 11 | Média | Preferências de áudio e timers de salvamento podiam sobreviver à troca de conta/logout; uma rejeição antiga podia marcar a nova conta como carregada. | Preferências reiniciadas por ID de usuário, respostas antigas ignoradas e salvamentos pendentes cancelados no cleanup. Teste troca contas com respostas atrasadas e faz logout durante um salvamento agendado. |
| 12 | Alta | Após falhar a captura de um novo microfone, o provedor guardava esse dispositivo como selecionado e não tentava capturá-lo novamente. | Falha restaura o dispositivo anterior quando a operação ainda é a atual. Track transmitida permanece estável; tentar o mesmo dispositivo novamente funciona. Teste com primeira captura rejeitada e segunda bem-sucedida. |
| 13 | Alta — backend | O schema versionado permitia associar um cargo a um membro de outro servidor. As funções de permissão também aceitavam essa associação. | Migration adiciona trigger de integridade e impede que associações inválidas antigas concedam permissões. PostgreSQL local bloqueou INSERT/UPDATE cruzados e ignorou um vínculo inválido previamente inserido. **Pendente aplicar em produção.** |
| 14 | Alta — backend | Uma negação explícita de permissão básica podia ser contornada por outro cargo sem configuração para aquela permissão, divergindo do frontend. | Função SQL agrega os cargos: administrador/proprietário ou concessão explícita permitem; na ausência disso, negação explícita impede o acesso básico. Testes cobrem negação + cargo neutro, concessão explícita, proprietário, não membro e membro sem cargos. **Pendente aplicar em produção.** |
| 15 | Baixa | Lint examinava artefatos de build; finais de linha Windows causavam milhares de erros; havia erros de tipos nos testes e dependências de hooks causando recomputações desnecessárias. | Artefatos gerados excluídos do lint, finais de linha aceitos de forma portável, formatação corrigida em arquivos versionados, `any` substituídos nos harnesses e dependências dos hooks corrigidas. Lint final: zero erros; 44 avisos de Fast Refresh. |
| 16 | Alta/Média — ferramentas | `npm audit` completo encontrou 13 alertas nas dependências de desenvolvimento/empacotamento: 1 alto e 12 moderados. | Atualizações compatíveis corrigiram o cache vulnerável; overrides específicos retiraram as cadeias antigas de `global-agent` e `esbuild`. Auditoria completa final: **zero vulnerabilidades conhecidas**. Bootstrap do agente de proxy e `drizzle-kit check` passaram. |

## Validação executada

| Verificação | Resultado e alcance |
|---|---|
| `npm test` | **129 testes passaram; zero falhas.** Foram acrescentados 18 testes de regressão. Concorrência limitada a quatro para tornar a execução previsível no Windows. |
| `npm run typecheck` | Passou, sem erros TypeScript. |
| `npm run lint` | Passou, zero erros; 44 avisos de Fast Refresh em componentes/hooks/harnesses. Esses avisos afetam o desenvolvimento, não indicam falha de chamada em produção. |
| `npm run build` | Build WEB/SSR concluído. |
| `npm run build:vercel` | Build de saída Vercel concluído, sem publicar. |
| `npm run desktop:build` | Build estático WEB utilizado pelo Electron concluído, inclusive após as atualizações de dependências. |
| Electron Builder `--dir --publish never` | Empacotamento local Windows verificado separadamente; não gera nem publica uma nova release. |
| WebRTC no navegador | Chamadas privadas e de servidor conectadas, com áudio nas duas direções, mesmo duplicando ofertas SDP. Usou RTCPeerConnection real, sinalização simulada localmente e áudio sintético, sem microfone real. |
| Interface de reações | Emojis selecionados no servidor e no privado no navegador local; seleção exibida sem piscar/fechar antes do clique. |
| Layout de chat mobile | Harness dos componentes reais testado em 390 × 844; largura do documento = largura do viewport, sem overflow horizontal nessa tela. |
| SQL | Migration executada em PostgreSQL local isolado com fixtures mínimos e `ON_ERROR_STOP=1`; verificações passaram e a transação terminou com ROLLBACK. Nenhuma conexão a produção. |
| Dependências | `npm audit --json` completo, WEB de produção e Desktop de produção: zero vulnerabilidades conhecidas no momento da consulta. |
| Ferramentas atualizadas | Agente de proxy inicializa com a API utilizada pelo downloader do Electron; `drizzle-kit check` passou. |

Os testes existentes também exercitam negociação WebRTC, detecção de fala, áudio processado/RNNoise e fallback, encerramento durante carregamento do modelo, troca de dispositivos, compartilhamento de tela, AFK, movimentação e moderação de voz, presença/reconexão, sons de chamada, reações, menções/DND, drag de canais/membros, perfis/cosméticos, temas, desempenho visual e segurança do atualizador Desktop.

Uma execução com todos os arquivos de teste em paralelo terminou com uma falha de processo no arquivo de preferências, embora seus testes individuais tivessem passado. O arquivo passou isoladamente; a suíte completa passou com concorrência quatro. O novo comando `npm test` mantém essa configuração. Um erro TypeScript introduzido durante a correção do dispositivo opcional foi encontrado e corrigido antes da validação final.

## Arquivos com alterações funcionais

- `src/hooks/use-messages.ts` e `src/hooks/use-dm-messages.ts`: isolamento de contexto, combinação de histórico, paginação e erros.
- `src/components/chat/ChatView.tsx` e `src/components/social/DirectChatView.tsx`: avisos de falha no carregamento.
- `src/services/messages.ts` e `src/services/social.ts`: autores das mensagens citadas.
- `src/components/voice/RemoteAudio.tsx` e `src/components/call/CallOverlay.tsx`: dispositivo padrão, desbloqueio por stream e cleanup.
- `src/hooks/use-auth.tsx`: inicialização de sessão protegida contra eventos/respostas atrasados.
- `src/hooks/use-audio-settings.tsx`: preferências por conta e cleanup de salvamentos.
- `src/services/voice.ts`: recuperação após falha de troca de microfone.
- `src/components/gamer/LiveGameActivity.tsx`, `src/components/voice/VoiceRoom.tsx`, `src/hooks/use-voice.tsx` e `src/hooks/use-social.ts`: dependências e estabilidade das memoizações.
- `eslint.config.js`: escopo do lint e finais de linha portáveis.
- `package.json` e `package-lock.json`: comandos de verificação, versões atualizadas e overrides das ferramentas vulneráveis.

Também houve ajustes de formatação em arquivos versionados para corrigir o lint existente. Os arquivos de teste de áudio tiveram tipos explícitos adicionados, e `previewAuthStorage.ts` recebeu um ajuste `let` → `const`. As alterações preexistentes em `src/routeTree.gen.ts` e a pasta não versionada `.github/` não foram incorporadas à auditoria nem publicadas.

## Novos arquivos e testes

- `tests/provider-lifecycle.test.mjs`: autenticação e preferências de áudio.
- `tests/audio-playback.test.mjs`: saída padrão, bloqueio por participante e cleanup de áudio.
- `tests/audit-permissions.sql`: testes isolados das funções e do trigger de permissão.
- `supabase/migrations/20261007010000_audit_role_permission_integrity.sql`: correção de integridade e resolução de permissões.
- Este relatório.

`tests/message-reactions.test.mjs` e `tests/audio-processing.test.mjs` foram ampliados com os demais cenários de regressão.

## Pendências e limites

1. **Publicação:** o site e o instalador público continuam na versão anteriormente publicada. As correções desta auditoria precisam de uma nova publicação.
2. **Supabase:** a migration `20261007010000_audit_role_permission_integrity.sql` está preparada e testada localmente. Sua aplicação em produção depende de confirmação. O estado atual das políticas do banco publicado não foi consultado; os problemas de backend foram confirmados no schema versionado.
3. **Validação de rede:** não foi executada uma chamada entre dois computadores/redes externas nem medido o comportamento de TURN em NAT restritivo. O teste WebRTC local não prova conectividade em todas as redes.
4. **Hardware e EXE:** não foram testados microfones/headsets físicos diferentes, permissões reais de câmera, execução do novo pacote em duas máquinas ou instalação automática de ponta a ponta. As verificações de Desktop incluem compilação, empacotamento e testes dos controladores.
5. **Mobile:** o teste de 390 px cobre o harness do chat e reações. Não equivale a verificar todas as telas em Android/iPhone reais, teclado virtual, orientação e safe areas.
6. **Dados reais:** não foram feitos uploads, exclusões, banimentos ou alterações de perfis de usuários em produção. Esses fluxos têm cobertura parcial pelo código/testes existentes, sem uma campanha autenticada de ponta a ponta com contas descartáveis.
7. **SQL completo:** o teste local usa um schema mínimo para verificar as funções/trigger novos. Não reproduz todo o ambiente Supabase/Auth/Storage/RLS de produção. A migration não apaga associações inválidas antigas; elas deixam de conceder permissões nas funções corrigidas.
8. **Desempenho:** houve revisão de cleanup/memoização e testes dos mecanismos de animação; não foi feito benchmark de CPU/GPU com várias chamadas e perfis em hardware variado.

## Evidências

Capturas locais dos testes:

![Reação selecionada no chat em viewport mobile](C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/audit-mobile-chat.png)

![WebRTC real com áudio nas duas direções e ofertas duplicadas](C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/audit-webrtc-pass.png)

Logs e resultados estão em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/`, nos arquivos `audit-verified-tests.log`, `audit-verified-types.log`, `audit-verified-lint.log`, `audit-final-build.log`, `audit-vercel-build.log`, `audit-desktop-final-build.log`, `audit-electron-package.log`, `audit-db-tests.log` e `audit-all-dependencies-final.json`.

Fontes consultadas para os alertas de dependências: [cache HTTP](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99), [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) e [API oficial do global-agent](https://github.com/gajus/global-agent). As versões efetivamente instaladas e o resultado final foram conferidos pelo npm/lockfile, porque páginas de advisory podem ter informações de patch defasadas.
