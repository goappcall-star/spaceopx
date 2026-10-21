# Comunidades V1 — Fase 5: consolidação e preparação

Entrega exclusivamente local, em 21/10/2026, na branch `codex/communities-v1`, sobre a 4C (`ac0b6ef`). Não houve publicação, push, migration remota, novo Supabase, Docker, alteração de instalador ou atualizador. Comunidades continuam opt-in; XP coletivo e verificador permanecem desligados. A entrega prepara avaliação manual, não autoriza lançamento.

## 1. Inventário e estado real

| Módulo             | Implementação auditada                                                                         | Estado / dependência pendente                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Conversão          | Mesmo `server_id`, ativação/desativação com revisão, assistente e delegação explícita          | Contratos SQL e preservação aprovados localmente; falta autenticação real              |
| Home               | Banner, apresentação, avisos, canais, voz observada, interesses, eventos, identidade           | Componentes reais na prévia; voz real não montada no harness                           |
| Onboarding         | Etapas configuráveis, regras versionadas, interesses e cargos permitidos                       | Backend revalida cargos sem conceder administração; fluxo visual concluído com fixture |
| Eventos            | Criar/editar/cancelar, canal, fuso, RSVP, notificações persistidas                             | SQL aprovado; worker/scheduler e entrega em clientes reais não habilitados/validados   |
| Descoberta         | Diretório público consentido pelo proprietário, busca, categorias, apresentação e solicitações | Privados não publicados; revisão oficial separada; testes HTTP pendentes               |
| Moderação          | Denúncias, evidências limitadas, advertências, sanções, auditoria, antispam opt-in             | Contratos/RLS locais aprovados; retenção física precisa de operação autorizada         |
| Níveis coletivos   | Carteira, curva backend, ledger imutável, tetos e idempotência                                 | Ganhos desabilitados; sem pontuação por mensagens, RSVP ou duração de voz              |
| Missões/conquistas | Critérios versionados, provas privadas, períodos e desbloqueios únicos                         | Marcos administrativos novos não dão XP; atividade confiável ainda não integrada       |
| Estatísticas       | Nível/XP, série e histórico, conclusões, membros atuais, eventos e intenções visíveis          | Crescimento histórico, realização e presença comprovada continuam indisponíveis        |
| Cosméticos         | Catálogo 4C, propriedade/disponibilidade, prévia, revisão, equipar/remover, auditoria          | Quatro ativos utilizáveis após novos marcos; moldura bloqueada com fonte desligada     |

Foram revisados migrations/contratos, validadores, serviços, hooks, componentes de comunidade, entrada em `src/routes/_authenticated/app.tsx`, configurações de servidor, limpeza de cache na autenticação e relatórios anteriores. Não foram restaurados sistemas arquivados, alteradas fórmulas de XP ou substituídos provedores de mídia.

## 2. Problemas encontrados e correções

1. **Consultas fora de uso na descoberta:** as consultas de lista, destaques, apresentação e recentes continuavam habilitadas quando a Central de Segurança ocupava a tela. Agora ficam desabilitadas durante essa navegação; a verificação da capacidade oficial continua disponível.
2. **Dependência antecipada de moderação:** Home/ferramentas e descoberta importavam estaticamente o console. Passaram a usar `lazy`/`Suspense`; o painel fechado não é montado. Não foi alterada a autorização nem sua rotina de atualização.
3. **Cache de cosméticos não acompanhava invalidações de acesso:** mudanças locais/realtime em cargos, membros e configuração podiam deixar o painel com autorização visual antiga até outro refetch. O hook agora acompanha invalidações do servidor observado, separa conta/servidor e remove a inscrição ao desmontar. `cancelRefetch: false` evita cancelar uma revalidação já em andamento quando existem dois observadores. O backend sempre continuou revalidando a gravação.
4. **Mensagens obsoletas:** assistente/configurações ainda citavam Fases 1/2 e afirmavam que evolução ou aplicação cosmética não existiam. Foram substituídas por instruções funcionais e disponibilidade condicionada ao catálogo/backend.
5. **Acoplamento do formulário ao backend:** o componente puro de personalização estava no mesmo módulo de imports Supabase/upload. Foi movido, sem mudar seus controles, para `CommunityCustomizationForm.tsx`; o controlador mantém serviço, upload, validação e exportação compatível. Assim a prévia reutiliza o formulário real sem importar credenciais/serviços.
6. **Prévias fragmentadas:** pontos de montagem foram separados dos componentes dos harnesses anteriores. A nova prévia os reutiliza sem duplicar roots React. Os endereços/comandos antigos permanecem disponíveis.
7. **CSS da nova prévia:** a folha principal usa `source(none)` e só examina `src`; classes exclusivas do harness não eram geradas, deixando a navegação desktop acima do conteúdo. A folha exclusiva da prévia agora declara suas fontes Tailwind. Isso foi corrigido e conferido por captura, sem incluir fixtures no CSS de produção.

Não foi identificada necessidade de uma nova migration nesta consolidação. Não houve otimização de SQL ou troca de dependência sem evidência de gargalo.

## 3. Cache, consultas e preservação

- Queries comunitárias usam conta/servidor e, conforme o módulo, período/filtro/cursor. `gcTime: 0` nas consultas sensíveis evita retenção desnecessária após desmontagem.
- A autenticação existente limpa o QueryClient no logout/troca de usuário; o workspace, objetivos e painéis usam chaves React por usuário/servidor. Essas proteções foram preservadas, não substituídas por cache global.
- Polling existente: configuração/experiência 15 s, agenda/inbox 20 s, descoberta 15–60 s e moderação 15–20 s apenas nas consultas habilitadas. Inbox permite atualização em segundo plano com o app aberto. Não foram reduzidos intervalos de revalidação de permissões nem criados novos timers. Desabilitar consultas da descoberta durante Segurança remove trabalho comprovadamente fora de uso.
- Estatísticas são administrativas, sob demanda, com intervalo limitado a 93 dias e histórico paginado. A Home compartilha a query de cosméticos com o painel. Não introduzimos coleta de presença ou telemetria.
- Índices existentes cobrem eventos por servidor/estado/início, RSVP e inbox; diretório por publicação/categoria, pesquisa textual GIN e interesses; filas/histórico/retenção; ledger por servidor/ID e data; missões e conquistas. A cadeia completa foi reaplicada em banco novo.
- Não foram medidos planos sob volume representativo, p95 HTTP, CPU/GPU, memória ou duração de sessões. Não é alegado ganho percentual. O tamanho do chunk da Home não foi usado como prova de melhoria: redistribuição de chunks não mede latência/CPU.
- Nenhuma dependência npm nova. Não houve alteração de voz, compartilhamento, mensagens, Central Social, XP individual ou hotbar. Preservação entre desativação/reativação foi reexercitada na suíte SQL; interação com clientes reais segue pendente.

## 4. Segurança e dados

Os testes locais reexercitam proprietário, gestor explicitamente delegado, administrador sem delegação, membro e estranho; atribuição de cargos, revisão/locks, revogação concorrente, repetição, dados privados, opt-in de publicação e separação de equipe oficial. Nenhuma decisão sensível foi deslocada para o frontend.

O catálogo PostgreSQL local confirmou RLS nas 22 tabelas públicas de comunidade. Quatro tabelas privadas da fundação de XP não usam RLS (`community_verified_activities`, curvas, política e sua auditoria); são protegidas pelo schema privado e ACLs, sem SELECT/INSERT/UPDATE/DELETE para `authenticated`. Isso não é apresentado como RLS habilitada nessas quatro tabelas. Os helpers privados e RPCs privilegiadas mantêm caminhos de pesquisa fixos e acesso controlado. As rotinas de notificações/retenção não têm execução para `anon`, `authenticated` ou `PUBLIC`; somente `service_role` entre esses papéis consultados.

Denúncias ocultam identidade do denunciante na fila; retenção de evidência/textos e limites continuam no backend. Orçamentos transacionais de SQL não substituem limitação HTTP durável de tentativas inválidas: exceções podem desfazer o contador. Esse controle externo permanece requisito de lançamento.

Não há backfill de conquistas/recompensas, ativações de verificador, concessão de XP pelo navegador, pagamento ou provisionamento de equipe oficial. Consulta final ao banco sintético confirmou `gain_enabled=false` e `verifier_enabled=false`.

## 5. Prévia unificada

Executar no repositório:

```powershell
npm run preview:communities
```

Endereço: `http://127.0.0.1:5213/`, somente loopback. Navegação: **Home, Eventos, Explorar, Moderação, Evolução, Estatísticas, Personalização e Configurações**. Inclui assistente de ativação e onboarding reais, cenário de servidor comum/comunidade, duas contas fictícias e reinicialização.

Aviso persistente: **PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM SUPABASE**. Fixtures são independentes por módulo; números de estatísticas não são recalculados a partir das ações de outros módulos. A Home encaminha à agenda da prévia; não finge observar participantes reais. Trocar a conta fictícia reinicia o estado da sessão de demonstração, não executa login. A moderação oferece também uma fixture de plataforma explicitamente separada; isso não concede autoridade oficial.

O grafo de imports da prévia é testado para impedir carregamento de SDK Supabase e serviços reais. Banners são ativos locais; upload autenticado não é simulado como aprovado. Estados locais permanecem durante a navegação entre módulos e mudança do cenário de servidor; recarregar/reiniciar ou trocar conta descarta as fixtures. Nenhuma ação dispara RPC ou scheduler real.

### Conferências visuais executadas

- Navegação pelos sete módulos e Configurações; Home com identidade oficial, avisos, interesses e atalhos.
- Onboarding: bloqueio antes do aceite obrigatório, interesse opcional, cargo permitido e conclusão; feedback em memória e Home concluída.
- Agenda: abertura do editor real e fixture de evento; RSVP alterou o estado visual. A automação do campo nativo `datetime-local` não confirmou a criação completa pelo formulário; esse cenário fica na lista manual, sem ser declarado aprovado. Validação de datas/CRUD backend continua coberta por Node/SQL.
- Catálogo: item aplicado aparece na Home; troca de conta fictícia remove o estado anterior. Moldura permanece bloqueada.
- Servidor comum oculta módulos exclusivos; assistente de ativação abre; retorno ao cenário de comunidade.
- Desktop: viewport 1440×1000; móvel: 390×844, área útil 375 px, `scrollWidth=375` em Home/Estatísticas. Overrides foram removidos após a conferência.
- Console capturado sem erros. Não houve sessão EXE autenticada; “desktop” aqui descreve dimensão da interface no navegador, além do build Desktop.

## 6. Testes e ocorrências

| Verificação                      | Resultado                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Baseline Node antes de alterar   | 270 aprovados                                                                                                        |
| Node final                       | 273 aprovados, zero falhas/cancelados/ignorados                                                                      |
| Novos testes                     | Invalidação/cancelamento da inscrição, isolamento do cache e flag desligada; grafo offline da prévia                 |
| PostgreSQL de comunidades        | Aprovado, regressões das Fases 1–4C, preservação, permissões, upgrades e 24 cenários de concorrência                 |
| Banco de upgrade                 | Aprovado, conquistas anteriores preservadas e sem concessão retroativa                                               |
| `security:db`                    | Aprovado, migrations, RLS, orçamentos e fluxos normais                                                               |
| `test:community-http`            | **IGNORADO**: GoTrue local indisponível. Não equivale a aprovação HTTP                                               |
| TypeScript                       | Aprovado                                                                                                             |
| ESLint dos arquivos alterados    | Zero erros e avisos na execução final                                                                                |
| ESLint global                    | **Falha**: 55 erros e 51 avisos fora do escopo alterado; log preservado. Não foi aplicada correção global automática |
| Scanner                          | 750 arquivos verificados, zero achados; resultado em `community-5-security.log`                                      |
| WEB com feature ligada           | Aprovado, configuração fictícia de compilação em loopback                                                            |
| Desktop com feature ligada       | Aprovado, sem empacotar/distribuir instalador                                                                        |
| WEB com feature padrão desligada | Aprovado                                                                                                             |
| Build da prévia unificada        | Aprovado; saída local separada, sem implantação                                                                      |

Primeira tentativa SQL ocorreu enquanto o PostgreSQL recuperava um encerramento anterior e retornou “database system is starting up”; não aplicou fixtures. Após o log de prontidão, a suíte foi repetida e passou. Não houve uso de produção ou reparo destrutivo. Avisos iniciais de Fast Refresh da nova entrada foram resolvidos separando montagem e componente; o lint focado final ficou limpo. A captura inicial expôs o problema de fontes CSS da prévia, corrigido antes das capturas finais.

Bancos descartáveis retidos: `lobbyx_community_test_1792624491378`, seu `_upgrade4b` e `lobbyx_security_test_1792624723695`, em `127.0.0.1:55468`. Claims SQL são sintéticas; **não são GoTrue/PostgREST nem clientes autenticados**. Logs em `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/community-5-*.log`; auditoria de índices em `community-5-schema-audit.txt`.

Ao finalizar, o PostgreSQL exclusivo de testes foi encerrado normalmente após conferir marcador, porta e `data_directory`. Dados e logs foram preservados. A prévia de interface continua disponível sem depender desse banco.

## 7. Capturas reais da renderização

Pasta `C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/`:

| Arquivo                                                                                | Evidência                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `community-5-home.png`                                                                 | Home desktop e navegação unificada após correção CSS    |
| `community-5-events.png`                                                               | Agenda com fixture identificada                         |
| `community-5-explore.png`                                                              | Diretório com apresentação fictícia                     |
| `community-5-moderation.png`                                                           | Fila, evidência e justificativa obrigatória             |
| `community-5-evolution.png`                                                            | Progresso e fonte de atividade desligada                |
| `community-5-statistics.png`                                                           | Métricas demonstrativas e limites explícitos            |
| `community-5-customization.png`                                                        | Catálogo e item de missão bloqueado                     |
| `community-5-mobile-home.png`, `community-5-mobile-statistics.png`                     | Conferência responsiva final                            |
| `community-5-onboarding.png`, `community-5-activation.png`, `community-5-ordinary.png` | Conferências do fluxo e cenário comum durante a revisão |

Imagens são capturas de componentes reais com fixtures, não autenticação, dados reais ou validação de mídia.

## 8. Arquivos e migrations

Produção local: `CommunitySafetyTools.tsx`, `CommunityDiscovery.tsx`, `use-community-cosmetics.ts`; mensagens em `CommunityActivationWizard.tsx`, `CommunityObjectivesView.tsx`, `SettingsCommunity.tsx`; extração de `CommunityCustomizationForm.tsx` com controlador/exportação mantidos em `CommunityCustomization.tsx`.

Avaliação: harness `tests/community-unified-preview/`, entradas separadas dos previews de eventos/descoberta/moderação/evolução, opção de renderização embutida e fixture da agenda; `tests/community-consolidation.test.mjs`, comando em `package.json` e documentação da Fase 5. Não houve alteração em dependências/lockfile.

**Nenhuma migration nova.** Ordem auditada: `20261021010000` fundação → `020000` Home/onboarding → `030000` eventos → `040000` descoberta → `050000` moderação → `060000` XP → `070000` missões/conquistas → `080000` estatísticas/cosméticos, todas com prefixo `20261021`. A aplicação completa local foi testada; isso não autoriza execução remota.

## 9. Pendências e avaliação manual

Checklist completo e plano de operação/implantação: `OPERACAO-E-IMPLANTACAO-V1.md`. Permanecem sem validação: HTTP autenticado, troca de contas reais, duas sessões com revogação, upload/renovação de banner, entrega de notificações WEB/EXE, chamadas, tela/áudio, reconexão e carga representativa. Não se recomenda liberação antes desses cenários críticos.

Prévia e código ficam disponíveis para avaliação do usuário. Ganhos, verificadores, schedulers e pagamentos continuam inativos. A versão estável 0.1.58 foi conferida pelo SHA-256 do instalador: `1747CE503F316689BA82BFBD47093CD1DD730EC9ABC3E9AC810A745384A3831A`. Nenhuma publicação está autorizada por este relatório.
