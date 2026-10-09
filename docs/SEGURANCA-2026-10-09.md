# Revisão de segurança do LobbyX — 09/10/2026

Revisão preparada localmente e autorizada para publicação na versão 0.1.42. As duas migrations foram testadas no banco hospedado em uma transação com rollback e depois aplicadas, com backup local prévio. Senhas e configurações de Auth/Realtime não foram alteradas. LobbyX Progression V1 continua arquivado e excluído. O registro final de publicação fica em `PUBLICACAO-0.1.42.md`.

**Transição compatível:** `VITE_PRIVATE_REALTIME_ENABLED` fica desativada nesta publicação para preservar comunicação com desktops 0.1.41. A autorização dos tópicos privados está preparada no banco, mas ainda não protege canais públicos existentes. Ativação exige os testes de chamadas entre clientes descritos abaixo e atualização coordenada. Não foi desativado `Allow public access`.

Segurança não admite garantia de 100%. Esta revisão cobre o código e as migrations disponíveis, builds WEB/Desktop, testes automatizados e uma conferência HTTP pública. Não equivale a um pentest independente nem a uma auditoria completa da infraestrutura das contas.

## Achados e correções

| Prioridade | Achado | Correção preparada |
|---|---|---|
| Alta | Chave `service_role` legada podia ser colocada na configuração pública; o cliente também reconhecia `sb_secret_`. | Validação compartilhada no build e na inicialização: somente `sb_publishable_` ou JWT legado com role `anon`. Credenciais privilegiadas e variáveis `VITE_` com nomes sensíveis interrompem o build. Erros não mostram valores. |
| Alta | UPDATE da própria associação permitia alterar `server_id` ou `conversation_id` mantendo o usuário. | Triggers impedem mudanças de identidade, inclusive em associações, mensagens, canais, categorias, cargos e servidores. Upserts que repetem a identidade continuam permitidos. |
| Alta | Mensagens próprias podiam ser transferidas para outro canal/conversa. | Identidades imutáveis, permissão de acesso/envio também na edição e resposta restrita à mesma conversa. |
| Alta | Broadcast/Presence das chamadas e indicadores usavam canais públicos. | Autorização privada preparada atrás de `VITE_PRIVATE_REALTIME_ENABLED=true`, ainda não ativada na 0.1.42. Migration valida tópicos por usuário, servidor, canal, conversa ou par da chamada. Inbox privado permite receber apenas ao destinatário e enviar apenas a contatos autorizados; o remetente não se inscreve no inbox alheio. |
| Alta | No banco hospedado, a função antiga `award_xp` estava executável por usuários comuns, diferente das permissões esperadas pelo repositório. | A migration reafirma o bloqueio de execução direta para PUBLIC/anon/authenticated. Triggers confiáveis continuam concedendo XP normalmente. Teste hospedado comprovou o bloqueio. Isso não ativa o Progression V1 arquivado. |
| Média | Formulários não tinham validação consistente e o banco aceitava conteúdo/metadados sem limites suficientes. | Validações nos serviços e triggers no banco: textos, URLs HTTPS sem credenciais, anexos, menções, reações e permissões booleanas. Menções precisam pertencer ao servidor. |
| Média | Ausência de limite de envios válido independentemente da interface. | Contadores atômicos privados por usuário: mensagens 10/10 segundos e 60/minuto, edições 120/minuto, reações 120/minuto, criação de servidores 5/hora e convites 30/hora. |
| Média | Limites de arquivo dependiam da interface. | Limites de tamanho e MIME também nos buckets: avatar/banner 4 MB, imagens do servidor 8 MB, anexos 10 MB. Arquivos vazios rejeitados no cliente. |
| Média | Site sem CSP e `nosniff` na conferência pública. | WEB com nonce aleatório por resposta para scripts, proteção de enquadramento, objetos desativados, HSTS, `nosniff`, referrer e permissões. Electron usa hashes dos scripts da shell e regras para origens/rede. |
| Média | Navegação do Electron não tratava explicitamente redirects/WebViews. | Bloqueio de redirects externos no renderer, WebViews desativadas, origem interna exata e links externos somente HTTPS sem credenciais. Sandbox, isolamento, permissões e validação de IPC preservados. |
| Média | Diagnósticos poderiam conter tokens, senhas ou URLs de conexão. | Redação de padrões sensíveis e campos de JSON em erros do servidor e relatórios da interface. |
| Preventiva | Suporte a credencial TURN estática no código público, embora não configurado neste ambiente. | Removido o caminho que empacotava essa credencial; build rejeita `VITE_TURN_CREDENTIAL`. Nenhum relay ativo foi removido: a verificação apontou TURN não configurado. STUN foi preservado. |
| Funcional | Concatenação de dois scripts de inicialização gerava um TypeError. | Terminadores explícitos para tema e qualidade visual, com teste da execução conjunta. |

Não foram introduzidas dependências. As consultas da aplicação usam parâmetros do SDK/RPC, sem concatenar entradas em SQL. O módulo de cliente administrativo não possui consumidores no frontend. A proteção efetiva dos dados continua no backend/RLS, não no fato de esconder botões.

## HTTPS e headers

Conferência somente leitura em `https://lobbyx-nine.vercel.app`:

- HTTP retornou **308** para a mesma URL em HTTPS.
- HTTPS retornou **200** e HSTS da Vercel.
- A versão publicada não retornou CSP ou `X-Content-Type-Options`; as correções ainda precisam ser publicadas.

No build WEB local de produção, `/login` retornou CSP com nonce; todos os quatro scripts inline estavam autorizados pelo mesmo nonce da resposta. Duas requisições receberam nonces diferentes. HTML é `private, no-store` para evitar reutilização de nonce pelo CDN.

Em produção, scripts não usam `unsafe-inline` ou `unsafe-eval`. `wasm-unsafe-eval` é necessário para RNNoise/WebAssembly. Estilos continuam permitindo inline por causa dos componentes, posicionamento e SVGs existentes. Imagens e mídia HTTPS continuam permitidas para os perfis e anexos. Conexões de aplicação ficam limitadas à própria origem e ao Supabase. Um domínio personalizado de API precisará ser incluído explicitamente na política antes de uso.

## Migrations e ordem de ativação

1. `supabase/migrations/20261009010000_security_write_guards.sql`: identidades, validação, limites de escrita e buckets.
2. `supabase/migrations/20261009020000_private_realtime_authorization.sql`: autorização dos canais privados.

Aplicar primeiro em um projeto de homologação. As migrations não desabilitam RLS e não carregam o Progression V1 arquivado. A primeira migration valida campos alterados para evitar bloquear edições não relacionadas em registros legados; conteúdo legado não é automaticamente saneado.

Antes de publicar:

1. Confirmar backup/restauração e aplicar as duas migrations na homologação.
2. Executar uma prévia WEB e um Desktop com as variáveis desse projeto.
3. Testar duas contas: WEB ↔ WEB, WEB ↔ EXE e EXE ↔ EXE; chamadas privadas e de servidor, troca de canal, reconexão, mute e compartilhamento. Confirmar que outra conta sem acesso não consegue se inscrever nos tópicos privados.
4. Só com autorização, aplicar as migrations na produção e coordenar a atualização do WEB e dos desktops.
5. Em **Supabase → Realtime Settings**, desativar **Allow public access** após a transição dos clientes. A alteração desconecta os clientes: usar uma janela combinada, fora de chamadas.
6. Conferir novamente os headers públicos e os fluxos de login/upload/chamadas.

**Compatibilidade:** versões antigas do EXE usam canais públicos e não compartilham sinalização/presença com os novos canais privados. Não publicar esta mudança isoladamente nem desligar canais públicos com usuários em chamadas. Não existe fallback automático para canais públicos.

O motivo da configuração externa é documentado pelo [Supabase Realtime](https://supabase.com/docs/guides/realtime/authorization): a opção `private` do cliente deve ser acompanhada da autorização e da restrição de acesso público no projeto.

## Variáveis e credenciais

- WEB e Desktop: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`, ou os equivalentes `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` já suportados pelo build. Sem novas credenciais obrigatórias. `VITE_PRIVATE_REALTIME_ENABLED` é um parâmetro público de build; somente o texto `true` ativa tópicos privados. Ausência ou `false` mantém compatibilidade nesta release.
- `SUPABASE_SERVICE_ROLE_KEY`, senhas de banco, tokens GitHub/Vercel e secrets de providers: somente no ambiente servidor/implantação apropriado. Nunca usar prefixo `VITE_`.
- `PG_BINDIR` e, opcionalmente, `LOBBYX_TEST_PG_PORT`: somente para os testes locais de banco.
- TURN, se necessário futuramente: usar emissão autenticada de credenciais curtas. O endpoint emissor ainda precisa ser implementado/configurado antes de habilitar um relay; não reutilizar credenciais permanentes em env pública.

A chave publishable/anon do Supabase **é pública por definição**. O token temporário da sessão do próprio usuário também precisa estar acessível ao SDK nesta arquitetura. Isso é diferente de expor uma senha administrativa ou `service_role`. A autorização dos recursos deve ser imposta pelo banco e pelo Realtime. Veja a [documentação oficial das chaves](https://supabase.com/docs/guides/getting-started/api-keys).

## Verificações executadas

- `npm audit --json` e `npm audit --prefix desktop --json`: **zero vulnerabilidades conhecidas apontadas**. Isso não cobre todos os possíveis defeitos das bibliotecas.
- `npm test`: 161 testes passaram, incluindo áudio/negociação, updater, validações, CSP, URLs, redaction, nonce com Request proxy, inicialização de tema/desempenho e ativação explícita de Realtime privado.
- `npm run typecheck`: passou.
- `npm run lint`: zero erros; 44 avisos de Fast Refresh já existentes.
- Builds de produção WEB e Desktop: verificados; a política não exige remover o processamento RNNoise/WASM.
- Banco PostgreSQL local isolado: todas as migrations do repositório, inclusive as duas novas, aplicadas desde o início; testes de acesso, identidade, limites, perfis, mensagens, proprietário, categorias e sucessão do dono do grupo passaram. Nenhuma tabela pública da fixture estava sem RLS.
- Navegador: landing/login renderizam e navegam; inspeção de resposta confirma nonces distintos e autorização dos scripts. O erro antigo dos bootstraps foi corrigido.
- `npm run security:scan -- --history --assets`: nenhum segredo identificado pelos padrões de chave privilegiada Supabase, JWT `service_role`, token GitHub, chave privada e URL de banco com senha. Não é uma prova de ausência de qualquer formato de secret.

Os testes SQL também passaram no Supabase hospedado, com dados sintéticos revertidos. Não foi executada nesta revisão uma chamada entre duas contas com o novo Realtime privado, nem um teste completo do instalador em máquinas diferentes. A fixture SQL local emula Auth/Storage/Realtime; não executa GoTrue, Storage HTTP ou o servidor WebSocket do Supabase. Esses testes de homologação são obrigatórios antes de ativar a flag privada.

## Como repetir os testes

Na pasta do repositório:

```powershell
npm test
npm run typecheck
npm run lint
npm audit
npm audit --prefix desktop
npm run security:scan -- --history --assets
npm run build:vercel
npm run desktop:build
```

Para o banco, com PostgreSQL já iniciado localmente e `PG_BINDIR` configurado:

```powershell
npm run security:db
```

O runner aceita apenas `127.0.0.1`, cria uma base nova com prefixo `lobbyx_security_test_`, ignora variáveis de conexão PostgreSQL herdadas e não aceita URL de produção. As fixtures permanecem locais para inspeção. A varredura de segredos também passa a ser uma etapa obrigatória dos builds WEB/Desktop.

## Pendências e limites de proteção

- Configurar CAPTCHA e limites de Auth no Supabase para cadastro, login e recuperação; o limite de escrita do banco não protege esses endpoints de autenticação. Ativar confirmação de e-mail, senha mínima adequada, URLs de callback exatas e desabilitar autenticação anônima se não utilizada. Não mudar essas configurações sem validar os fluxos existentes.
- Revisar MFA e acessos administrativos de Supabase, GitHub e Vercel; tokens de implantação com menor privilégio e backups recuperáveis.
- Os limites do banco cobrem escritas válidas confirmadas. Falhas de transação são revertidas; bloqueio por IP, requisições inválidas e flood de WebSocket dependem também das proteções e quotas do provedor.
- Realtime restringe quem pode entrar/publicar em um tópico. Metadados de Presence/Broadcast ainda são declarados pelos clientes; membros autorizados maliciosos podem falsificar metadados. Vinculação criptográfica de cada remetente e expulsão imediata de clientes adversariais exigem uma camada de sinalização autoritativa. Em P2P, não há garantia de impor mute/expulsão contra um cliente modificado apenas por comandos da interface. Essa revisão preservou a infraestrutura de voz e não introduziu um SFU/novo servidor.
- Presence global continua visível a usuários autenticados, conforme o recurso existente. Restringir também a amigos/servidores comuns requer reorganizar os tópicos de presença.
- Instalador continua sem assinatura Authenticode. HTTPS e hashes dos assets ajudam a conferir transporte/integridade; não substituem assinatura de editor ou proteção da conta que publica releases.
- Fazer auditoria independente e testes adversariais na homologação. Nenhum código local consegue confirmar por si só todas as configurações e permissões efetivas da infraestrutura hospedada.

Referências: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Realtime settings](https://supabase.com/docs/guides/realtime/settings).
