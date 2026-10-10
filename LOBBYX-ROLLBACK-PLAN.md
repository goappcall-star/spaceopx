# LobbyX — plano de reversão

10/10/2026, São Paulo. Procedimento preparado, **não executado em produção**. O restore completo ainda não foi validado; o proprietário aceitou esse risco de perda de dados, removendo esse bloqueio absoluto. Publicação e qualquer alteração de produção continuam dependentes de autorização específica. Usar junto ao release plan e checklist. Backups privados devem permanecer disponíveis durante toda a janela.

## Pontos de retorno e limites

WEB: deployment `dpl_ppVMUda9t3fpnUHj4h7RwwhG5QKH`, `https://lobbyx-6giqoib2b-nicolasmaarttins-projects.vercel.app`, alias `https://lobbyx-nine.vercel.app`, SHA `d33f2021dfe0e9897013e0ae9b6d42c5f6b58d18`. EXE: release 0.1.43; não usar 0.1.42, que foi retirada para draft por falha de startup. Tag local `codex/recovery-0.1.43-20261010`; bundle/snapshot/installer no diretório privado indicado no release plan.

O banco atualizado é compartilhado por WEB, clientes antigos e novos EXEs. Voltar o WEB não volta automaticamente o banco, variáveis ou instaladores; retirar uma release não remove instaladores já baixados. Não reescrever Git/Lovable nem recuperar uma branch antiga sobre alterações não commitadas.

RTO ainda não medido: restore integral local abortou por falta de supabase_vault. Não prometer tempo de recuperação. RPO de um restore lógico integral é o snapshot do dump; pode perder **todas as escritas posteriores**, incluindo mensagens, perfis, cargos, invites, leituras, contas e arquivos. Backup Storage fora da transação exige reconciliação adicional. Preferir rollback de código e correção de policy/função, que não apagam essas escritas.

## Critérios para parar imediatamente

Qualquer vazamento de mensagens/servidores, autoconcessão administrativa, acesso indevido ao monitor, falha de integridade/FK, migration parcialmente aplicada, backup inválido ou falta de ponto de retorno: STOP imediato. Não concluir rollout nem liberar EXE. Preservar evidências sem tokens/conteúdo privado e pedir decisão do proprietário.

Para falha funcional: um cenário de autenticação/mensagens/reação/leitura/voz que passe no ponto de retorno e falhe duas vezes no candidato é regressão confirmada para interromper. Reconexão/corte repetido em chamada parada, tela preta, impossibilidade de enviar/ler mensagens ou mover membro autorizado: STOP no primeiro caso reproduzido. Não esperar completar toda a janela.

Para saúde: 5xx/erro de RPC ≥5% em ao menos 20 operações durante 5 min, ou latência p95 de operações equivalentes >2× baseline por 5 min; travamentos novos >1 s repetidos, CPU steady >20% relativo ao baseline por 5 min ou RAM crescendo >100 MiB sem estabilizar em 15 min durante cenário idêntico: parar e investigar. São limites operacionais propostos, não garantias estatísticas. Erros de permission para contas que devem ser negadas não são falha operacional. Baixo tráfego não permite usar ausência de amostras como aprovação.

## Primeiros passos do incidente

1. Parar a sequência, CI/push/deploys e promoção de draft; EXE fica bloqueado se o problema é WEB/banco. Pausar a coleta local do monitor se o problema é seu custo.
2. Registrar versão, deployment, hashes SQL, horário, cenário e erro sanitizado. Não compartilhar logs de mídia, mensagens, tokens, URI do banco, e-mails ou IDs privados.
3. Capturar novo backup privado do estado atual antes de qualquer ação destrutiva. Identificar se a falha está no cliente, policy/RPC, permissões, Auth, Realtime ou rede. Não atribuir automaticamente a WebRTC ou ao Supabase.
4. Obter autorização explícita da ação de reversão. A autorização para publicar não cobre automaticamente restaurar/destruir o banco. Não executar nada automaticamente a partir deste documento.

## Reversão WEB

Quando autorizado, usar Vercel Instant Rollback para o deployment estável acima e conferir aliases/projeto. Alternativa CLI, **comando de produção não executado**:

```powershell
vercel rollback https://lobbyx-6giqoib2b-nicolasmaarttins-projects.vercel.app --yes
```

Verificar a disponibilidade/eligibilidade no plano atual; não assumir que qualquer deployment histórico é elegível. Se Instant Rollback não oferecer esse alvo, decidir promoção/redeploy do SHA estável com configuração correta e autorização. Conferir três aliases, login, assets/CSP, mensagens servidor/PV, imagens, notificações antigas, chamadas e clientes mistos. Reload do browser pode ser necessário para abandonar o bundle novo; manter o banco aditivo durante coexistência.

O rollback usa o build/configuração do deployment anterior; não atualiza o banco nem reconstrói com variáveis novas. Não trocar o Supabase atual pelo projeto antigo. Conferir que URL/project ref/publishable key continuam coerentes. Não executar push main durante o incidente: a integração pode iniciar outro deploy. Vercel pode pausar atribuição automática de domínio após rollback; conferir e retomar somente após correção autorizada. [Documentação oficial](https://vercel.com/docs/instant-rollback).

## Desativar o monitor

O estado padrão é OFF; pausar no painel encerra timer/observer/RAF local. Não há controle remoto de coleta global porque não há telemetria global. Para revogar acesso, SQL privilegiado autorizado pode remover a única linha da allowlist, depois confirmar RPC false, revalidação/reload/logout. A rota revalida em até 60 s quando visível; métricas já agregadas são anônimas e locais, não dados de outros usuários. Não garantir revogação instantânea de uma UI já aberta.

Preservar tabela/RPC/RLS sem derrubar o restante do aplicativo. Se até a instrumentação OFF causar problema, rollback WEB/hotfix desabilitando os pontos de instrumentação exige nova validação. Não conceder acesso ao suporte ou aos admins de servidores como solução temporária.

## Reversão das migrations — sem restaurar dados

Prioridade: **manter as adições compatíveis** após rollback WEB. São quatro mudanças aditivas sem exclusão/backfill de mensagens. Não executar down migrations automaticamente quando existem clientes novos abertos/instalados.

Se a causa for migration 020000, uma correção DDL autorizada pode, numa transação:

1. Restaurar a policy de SELECT para a expressão **capturada em produção**: `has_channel_permission(channel_id, auth.uid(), 'view_channel'::text)`, preservando o restante da policy/TO/FOR. Reconfirmar que não mudou desde o backup.
2. Substituir somente `get_server_unread_counts()` pela definição SECURITY INVOKER original da migration 010000, preservando search_path e grants. Isso remove dependência da helper e mantém a API para clientes novos, com custo anterior de consulta.
3. Verificar dependências pelo catálogo antes de remover `visible_message_channels()`. Usar DROP RESTRICT, jamais CASCADE; pode também manter a helper sem uso temporariamente. Validar RLS/nonmember/roles/anon e contagens antes de commit.

Os dados/cursors não são apagados por esse rollback DDL. O arquivo 020000 não deve ser “executado ao contrário”; não desativar RLS nem tornar função definer para contornar erro. Este caminho foi ensaiado em fixture localhost: policy/RPC originais passaram `tests/unread-counts.sql`; depois restauramos policy/RPC otimizadas e os testes passaram novamente. Mantivemos a helper sem uso durante o down. Evidência privada: `rollback-local-validation.json` e SQLs `*.local.sql`. Não foram executados em produção; não comprovam endpoints hospedados nem eliminação de toda dependência externa. Antes da execução real, recapturar definições/grants atuais e conferir schema drift.

Migration 010000: manter RPCs enquanto existir cliente que as utilize. Se remover futuramente, primeiro migrar todos os clientes para código compatível; remover funções novas com RESTRICT, revogar grants e retirar `channel_read_states` da publicação **somente se adicionada por esta release e nenhum outro recurso depender**. Não apagar tabela/cursors nem retroceder last_read_at. A lista de publicação foi capturada antes da atualização.

Migration 030000: preferir revogar allowlist mantendo tabela/RPC. Não há necessidade de dropar o painel para protegê-lo; backend retorna false. Dropar tabela/função só depois de remover consumidores e avaliar dependências, com autorização. Nenhuma concessão foi feita nesta preparação.

## Reversão Desktop e auto-update

Antes da promoção, a release nova fica draft e o feed continua 0.1.43; parar o rollout não afeta instalações antigas. Depois de promoção problemática, quando autorizado: retirar a release nova de distribuição (draft) e confirmar GitHub Latest/feed aponta ao último instalador aprovado; suspender workflow e conferir o link estável da landing. Não excluir permanentemente artefatos para “resolver” o problema.

O updater atual tem `allowDowngrade=false`, autoDownload=true e autoInstallOnAppQuit=false. Portanto, publicar uma versão menor ou mudar latest.yml **não rebaixa instalações já atualizadas**, nem cancela download/cache já concluído. Não substituir um .exe mantendo a mesma versão/hash. Usuários que já instalaram precisam de hotfix com versão maior aprovado, ou reinstalação manual do 0.1.43 validada e autorizada, preservando dados/perfil. Não apagar `%APPDATA%`, sessão ou userData como primeiro passo.

Para rollback manual, fechar o aplicativo/chamada, confirmar SHA256 do installer preservado, instalar 0.1.43 e testar abertura/login/voz. O comportamento de downgrade NSIS/compatibilidade de userData ainda precisa de ensaio; caso bloqueie, não force flags de downgrade sem validação. Código/config pode voltar, estado local/caches podem exigir tratamento específico. Quem recebeu o download antes da retirada deve ser avisado por ação humana autorizada.

## Restore integral — último recurso

Requisitos obrigatórios: autorização específica com reconhecimento de perda de escritas, backup de agora, preferencialmente backup anterior restaurado com sucesso em ambiente compatível, inventário, estimativa de recuperação com incertezas explícitas e controle efetivo de escritas em **todos os clientes**, jobs e integrações. A tela de manutenção WEB sozinha não impede EXEs antigos de escreverem direto no Supabase. Fechar clientes voluntariamente não prova quiescência; sem controle efetivo, não declarar RPO zero.

1. Congelar escritas de forma explicitamente aprovada, sem revogar RLS indiscriminadamente nem expor tabelas. Confirmar janela e que nenhuma rotina/background/Storage continua escrevendo.
2. Capturar o estado incidente e catalogar intervalo de perda. Escolher restore seletivo/DDL/hotfix se puder preservar escritas.
3. Ensaiar restauração do backup completo em ambiente Supabase compatível descartável, com PG/extensions/roles/owners/ACL. Não usar o ensaio local fracassado como modelo pronto. `roles-no-passwords.private.sql` não reinstala credenciais: administradores devem obter configs existentes no cofre, sem incluir senhas no SQL compartilhado.
4. Aplicar restore aprovado com ferramenta própria ao formato custom (`pg_restore`, não `psql -f database.dump`). O destino real deve ser confirmado antes de conectar; flags de clean/drop não são um procedimento genérico seguro. Definir explicitamente tratamento dos objetos gerenciados Supabase, users/identities/sessions, triggers de Auth, extensions/Vault e publicações. Não carregar um dump completo por cima de produção ativa.
5. Recuperar Storage por API com bytes, bucket, path, mime/cache, ownership e hash. Não confundir linhas de storage.objects com arquivos reais. Comparar DB/Storage, não fazer upsert massivo sem controle de arquivos posteriores. Validar Auth/OAuth/redirects, RLS, grants e as variáveis/chaves externas.
6. Quantificar, comunicar e, quando viável, reaplicar seletivamente escritas posteriores do backup incidente, sem vazar dados nem executar triggers duas vezes. Registrar o que não foi recuperado. Reabrir acesso gradualmente apenas após smoke e aprovação.

Não existe comando de restore de produção liberado por este documento. Fonte técnica: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Os arquivos e scripts locais de auditoria fazem somente leitura de produção; a fixture de restore aceita apenas localhost e não é um restaurador de produção.

## Código/config e evidências

Recuperar o bundle em **novo diretório** e conferir SHA/tag, sem sobrepor o workspace. O snapshot privado preserva arquivos não commitados; seus hashes permitem detectar diferenças. Credenciais/configs externas devem ser recuperadas do cofre/versão de produção, nunca do repositório. Progression arquivado fica arquivado mesmo que apareça em refs históricas do bundle.

Anotar hora de início/fim, versão/deployment, decisão, responsável, testes antes/depois, hashes e perda de dados. Backups atuais estão preservados; confirmar cofre/configurações e segunda cópia protegida antes da janela. O risco do restore não comprovado foi aceito; não converter essa aceitação em permissão de apagar/reiniciar o banco.

## Reversão da correção Realtime 040000

Preferir manter a tabela aditiva durante retorno WEB. Se os triggers provocarem regressão comprovada, autorização DDL específica pode desativar somente os três triggers novos. Isso suspende a atualização de permissões/badges em tempo real: documentar a limitação e orientar recarregamento; não relaxar RLS nem substituir por polling constante. Preservar os demais triggers e publicação.

Antes de remover os novos consumidores, não retirar permission_invalidations do Realtime. Depois de clientes compatíveis e autorização, remover somente essa tabela da publicação se o inventário confirmar que esta release a adicionou. Não remover nenhuma das tabelas anteriores. Restaurar can_use_realtime_topic pela definição capturada antes de 040000, preservando owner/grants/policies, com teste de tópicos antigos e read-states. Não usar DROP CASCADE. Não apagar tabela/linhas preventivamente. Esse down completo de 040000 e sua entrega websocket ainda precisam de ensaio; o caminho da V2 020000 já teve down/up SQL validado.

## Recuperação da fonte independente do GitHub

Usar release-source-final.private.bundle, conferir SHA256/manifesto source-preservation-final.json, clone offline em diretório novo e git fsck. Recuperar a tag codex/recovery-0.1.43-20261010 para estável ou codex/recovery-candidate-20261010 para nova, sem sobrepor workspace/main nem restaurar Progression arquivado. As duas árvores já foram recuperadas e comparadas por arquivo a partir do bundle. Reinstalar dependências pelos dois locks e scripts originais; recuperar configurações externas privadamente. Nenhuma credencial de serviço é necessária para obter a fonte.

## Aceitação de perda não é autorização destrutiva

O proprietário aceita possível perda dos dados atuais, inclusive reinício do projeto se indispensável. Não existe autorização nesta tarefa para reset, DROP, limpeza ou escrita em produção. Restore integral continua último recurso, com avaliação das escritas posteriores e nova decisão específica. Se o dump não puder ser restaurado, começar do zero é alternativa condicionada a essa nova autorização, e não procedimento automático de rollback. RTO não medido; RPO não garantido. Priorizar retorno WEB/correção DDL mantendo os dados atuais.
