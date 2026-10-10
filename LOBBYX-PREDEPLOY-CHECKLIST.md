# LobbyX — checklist pré-publicação

10/10/2026, São Paulo. **Preparação local finalizada; produção não autorizada. Restore não comprovado: risco aceito pelo proprietário.** Itens marcados são evidência da preparação local/leitura, não autorização de produção. Não marcar um teste como aprovado por ausência de erro aparente ou por existir um script.

## Preparação realizada

- [x] Branch main/HEAD estável e diff existente inventariados, sem reset/checkout sobre alterações.
- [x] Release GitHub 0.1.43/Latest e SHA verificados; 0.1.42 continua draft.
- [x] Deploy Vercel ativo e alias identificados, SHA igual ao ponto estável; Git/main pode autodeploy.
- [x] Tag **local** de recuperação e bundle validado; nenhum push.
- [x] Installer 0.1.43/feed/blockmap preservados; SHA256 confere com digest GitHub.
- [x] Migrations 010000/020000/030000 auditadas: ordem, RLS, grants, dependências e impacto; catálogo de produção lido sem DDL/DML.
- [x] Identificada ausência das três migrations e ausência de ledger no projeto atual.
- [x] Conta principal identificada em auth.users: um match, e-mail confirmado; UUID somente em evidência privada; nenhuma concessão.
- [x] Dump custom completo + roles sem senhas + catálogo/publicações preservados fora do Git.
- [x] TOC/hash do dump e leitura/hash de 47 arquivos Storage verificadas.
- [x] Restauração completa **tentada e rejeitada**, não declarada válida; falta extensão genuína supabase_vault local.
- [x] 184/184 testes, typecheck, build WEB Vercel e testes SQL locais de segurança/migrations aprovados.
- [x] Lint 0 erros/47 avisos, scanner 558 arquivos/zero findings e diff check aprovados; snapshot de 592 arquivos com hashes conferidos.
- [x] Reversão local da policy/RPC V2 e restauração otimizada passaram os testes SQL; sem alterações de produção.
- [x] Monitor permanece OFF por padrão; autorização separada de cargos/ownership; V2 preservada.
- [x] Processo local de release protegido: script draft por padrão, promoção explícita; workflow só manual/declaração WEB validado false por padrão.
- [x] Nenhum deploy, push, release EXE, INSERT de admin ou migration de produção nesta preparação.

## Bloqueios antes de autorizar banco/WEB

- [x] Risco do restore integral não comprovado por falta de supabase_vault registrado como aceito. Dump/Storage mantidos; nenhuma permissão de reset/limpeza/escrita concedida.
- [ ] Ensaio integral Supabase/Storage recomendado; RTO desconhecido e eventual perda registrados, sem alegar sucesso.
- [x] Correção local 040000 + consumidor privado preparados e testes SQL aprovados; não publicar tabelas de cargos/membros diretamente.
- [ ] Reconfirmar publicação e função de autorização de tópicos em produção, autorizar 040000 e testar entrega Realtime autenticada após aplicação.
- [ ] Cofre/criptografia e segunda cópia segura dos backups; confirmar recovery de configs/secrets externos sem exportá-los para arquivos compartilháveis.
- [ ] Revalidar ponto WEB/EXE estável e saúde real, incluindo login e chamada; READY/Latest não é E2E.
- [ ] Definir e confirmar janela/responsável, interromper escritas ou declarar risco de perda; backup fresco com inventários DB/Storage antes/depois.
- [ ] Revisar conjunto completo de arquivos e dependências, congelar SHA candidato/hashes SQL; não restaurar Progression.
- [ ] Repetir testes/build/scan no SHA final se mudar; revisar avisos de lint. Registrar resultados finais.
- [ ] Confirmar variáveis Vercel/GitHub e chave publishable correta, sem service_role em VITE/bundle; não alterar variáveis nesta preparação.
- [ ] Autorizações específicas das quatro migrations e do deploy WEB. Push main também necessita autorização por iniciar deploy.

## Aplicação SQL — execução futura

- [ ] Conferir projeto/ref e SSL sem imprimir URI/senha, catálogo/grants/owners e publicação atuais; backups válidos disponíveis.
- [ ] 010000 transacional: novas RPCs, execution authenticated, anon negado, cursor/RLS preservados; conferir publicação de channel_read_states.
- [ ] 020000 transacional: mesma contagem/canais visíveis, policy intacta para não membros/canal oculto; índices existentes; RPC invoker.
- [ ] 030000 em transação única externa: tabela vazia, RLS ativo, SELECT/INSERT direto negado; RPC bool disponível/false para todos inicialmente.
- [ ] 040000 transacional: avisos INSERT/UPDATE por usuário; RLS/negação de escrita; preservar lista anterior Realtime e tópicos antigos; drift aborta.
- [ ] Stop ao primeiro erro/lock timeout; inspecionar catálogo antes de retry; não continuar nem fazer db push histórico.
- [ ] Validar PostgREST/schema cache e clientes 0.1.43 antes de WEB novo; registrar cada arquivo/hash/horário.

## WEB — primeiro

- [ ] Publicar somente candidato validado, por um único caminho autorizado; registrar deployment/aliases e preservar anterior.
- [ ] Google/e-mail, logout/login/reload, perfil/avatar/banner, server-assets sem 404/erro; preservação de dados e preferências.
- [ ] Entrar/sair/trocar servidor/canal; canais privados e cargos; criar/editar/mover categoria/canal com permissão; não membro negado.
- [ ] Mensagem/reação: servidor e PV, enviar/editar/excluir/responder; picker clicável, updates realtime, histórico com paginação/caches.
- [ ] Badges: mensagem de outro usuário incrementa, própria não; servidor agrega somente canais visíveis; PV também; 99+; menção conta; DND suprime alertas mas mantém contador.
- [ ] Leitura exige foco + janela visível + final do chat; leitura parcial, manual, reload e dois dispositivos/clients sincronizados; cursor não retrocede; hidden/unfocused não marca lido.
- [ ] Troca/revogação de cargo/membership atualiza acesso/contagem; nenhuma mensagem/canal de outro servidor; anônimo negado.
- [ ] Pelo menos 20 operações para baseline operacional; ausência de tráfego não equivale a aprovar notificações/alertas.

## Monitor — somente conta principal

- [ ] Reconfirmar UUID com auth.users no projeto de produção e apresentar ao proprietário para confirmação humana; não basear concessão só no e-mail/nome/cargo.
- [ ] Obter autorização explícita do INSERT. Se houver linha inesperada na allowlist, parar; não apagar/conceder outros admins automaticamente.
- [ ] Inserir **uma única conta** confirmada e verificar count=1. Nenhum grant automático a proprietários/ADM de servidor.
- [ ] Rota + RPC permitem principal e negam comum, dono/ADM de servidor e anônimo; usuário não consegue consultar/editar allowlist; testar revogação com procedimento previamente aprovado.
- [ ] Página real autenticada mostra dados medidos, filtros/histogramas coerentes e indicadores indisponíveis; coleta inicial OFF após reload/logout.
- [ ] Ativar por curto ensaio autorizado, testar falha de bridge/rede e verificar mensagens/voz não bloqueiam; terminar com coleta OFF; sem envio de métricas global.
- [ ] Comparar cenário idêntico on/off; avaliar variações de CPU/RAF já registradas na V1.1; não anunciar ganho garantido.

## Voz e coexistência

- [ ] Duas contas/redes reais: WEB↔WEB, WEB↔0.1.43 e 0.1.43↔0.1.43 com banco atualizado; servidor e PV, ida/volta de áudio.
- [ ] Chamada parada 30 min sem reconexões/cortes; trocar canal várias vezes, observar participantes sem entrar, posições estáveis, mover/mute/deafen/desconectar autorizado.
- [ ] Tela: iniciar/parar/reiniciar, assistir pelo perfil autorizado; indicador limpa ao parar; pessoas sem acesso não assistem.
- [ ] Ausência de regression nas otimizações V2/molduras/mobile/Modo Desempenho e controles existentes; não mexer em ICE/SDP para aprovar esta release.
- [ ] Critérios STOP do rollback plan avaliados; se qualquer gate falhar, **EXE continua bloqueado**.

## Desktop — somente após confirmação WEB

- [ ] Proprietário confirmou WEB funcional e autorizou **preparar** installer. Só agora atualizar versão/lock e executar dist local; não reutilizar 0.1.43 para binário diferente.
- [ ] `npm run desktop:dist` com publish never; `verify-desktop-release` passa installer, SHA512/tamanho, blockmap, latest.yml, app-update.yml, updater/versão empacotada.
- [ ] NSIS em máquina de teste: instalar, abrir sem tela preta, fechar/reabrir, OAuth/deep link, mensagens/notificações, chamada/tela, IPC e monitor somente principal.
- [ ] Upgrade real da 0.1.43 e preservação de sessão/config; medir recursos em chamada; ensaiar retorno manual/compatibilidade userData antes de depender dele.
- [ ] Conferir assinatura: projeto usa `signExecutable=false`; SmartScreen e instalação devem ser testados, não declarar assinatura inexistente. Nenhum custo de certificado foi contratado.
- [ ] Workflow manual/draft autorizado, assets completos e hashes conferidos. CI antiga remota não deve ser disparada por tags nesta preparação.
- [ ] **Nova autorização explícita** de publicar e liberar auto-update após installer validado; draft sem autorização fica draft. Não confundir autorização de gerar installer com promoção Latest.
- [ ] Feed/download/hash reais, atualização de client0.1.43, progresso, pronto/reiniciar, não instala em chamada/tela nem no quit comum, erro não impede app abrir.
- [ ] Observação pós-release e backups disponíveis; plano para quem já baixou/instalou candidato defeituoso. allowDowngrade=false: retirar release não rebaixa automaticamente.

## Encerramento/decisão

- [ ] Todos os gates comprovados e assinados pelo responsável, com horários/artefatos; anexar só evidências sanitizadas.
- [ ] Manter backup fresco, SHA/deploy anterior, instalador e rollback acessíveis até encerrar observação.
- [x] Restore não comprovado isoladamente deixou de ser bloqueio absoluto por decisão explícita do proprietário; isso não aprova nenhuma operação de produção.

Automação cobre testes/build/checksums/SQL local e preparação de draft. Confirmação de identidade, janela/risco de perda, permissões de produção, E2E real e liberação auto-update exigem intervenção humana. Nenhum checkbox pendente será preenchido por inferência ou por executar somente uma fixture.

## Evidências finais de preservação

- [x] Fonte completa 0.1.43 e nova preservadas em referências distintas, com commits/tags locais verificáveis; main/índice não sobrescritos.
- [x] Bundle independente do GitHub e árvores recuperadas em diretórios novos, verificados por git fsck e hashes por arquivo; manifesto privado source-preservation-final.json.
- [x] Configurações versionáveis, scripts, migrations e ambos os locks preservados nas duas árvores. Credenciais externas não copiadas ao Git/backup compartilhável.
- [x] 184 testes automatizados, typecheck, lint (0 erros/47 avisos), SQL local das quatro migrations e build WEB passaram. Scanner final e hashes registrados na evidência privada.
- [ ] Build de ambas as fontes em máquina limpa, configuração externa disponível e segunda cópia criptografada em outro dispositivo; não confundir backup local independente com redundância física.
- [ ] Realtime hospedado (INSERT/UPDATE, cascatas/remoção, reconnect e isolamento) e chamada multirrede com clientes antigos/WEB novo.
- [ ] Autorizar explicitamente banco e WEB; UUID confirmado antes do INSERT único de monitor. Nenhum installer/release automática antes de WEB aprovado e nova autorização.
