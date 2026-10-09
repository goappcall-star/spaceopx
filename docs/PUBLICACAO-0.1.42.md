# LobbyX 0.1.42 — publicação de segurança

09/10/2026. LobbyX Progression V1 permanece arquivado e excluído.

- Implementação/Desktop: `a4f75f3a4d02d36c525c27638ad288f4a7e019fa`.
- Ajuste do scanner para builds sem metadata Git: `0e25ac6932740bb8f3658b344f638b292887ee40`.
- WEB: https://lobbyx-nine.vercel.app — Vercel production READY, deploy `dpl_2GnUkmPp9LEjqDT222Moiqoc2Hoh`, commit `0e25ac6932740bb8f3658b344f638b292887ee40`.
- Deploy individual: https://lobbyx-6w67b6dga-nicolasmaarttins-projects.vercel.app.
- GitHub Release: https://github.com/goappcall-star/spaceopx/releases/tag/v0.1.42 — publicada, não draft, Latest.
- Instalador: https://github.com/goappcall-star/spaceopx/releases/download/v0.1.42/LobbyX-Setup-0.1.42-x64.exe.
- Assets completos: instalador versionado, instalador estável `LobbyX-Setup-x64.exe`, blockmap e `latest.yml`.
- SHA-256 de ambos os instaladores: `5d9c5ba4495bbda7a8b966a294d7e2bd39d324c0396dd43a39f2b9e921940f23`; coincide com o digest da API GitHub e o arquivo local.

## Banco

Aplicadas em `lnupoqtaeawwggbwgbuv`:

- `20261009010000_security_write_guards.sql`.
- `20261009020000_private_realtime_authorization.sql`.

Antes da aplicação: backups privados de schema, dados públicos e buckets no diretório local `C:/Users/nicol/Documents/Codex/2026-10-03/vo/work/supabase-migration/security-042-predeploy-1791577720251`.

Ambas as migrations e os testes de segurança foram executados contra o banco hospedado dentro de uma transação com rollback antes da aplicação definitiva. A verificação encontrou uma permissão antiga inadequada de `award_xp`; corrigida pela primeira migration, preservando chamadas internas confiáveis. Depois: RLS dos contadores ativa, dez triggers de identidade e quatro políticas Realtime confirmadas; nenhum dos usuários sintéticos persistiu. Cache de schema PostgREST recarregado.

## Transição das chamadas

`VITE_PRIVATE_REALTIME_ENABLED` não está ativa na produção e vale `false` por padrão. `Allow public access` não foi alterado. A 0.1.42 mantém sinalização/presença compatível com os EXEs anteriores. As políticas privadas estão preparadas; ainda não protegem os tópicos públicos existentes.

Ativar somente após testes reais de duas contas WEB ↔ WEB, WEB ↔ EXE e EXE ↔ EXE e atualização coordenada. Não habilitar uma ponta isolada nem desconectar clientes em chamadas. A instalação usa o updater existente e o botão “Reiniciar e atualizar” fora de chamadas/compartilhamentos.

## Verificação

- 162 testes passaram; typecheck passou; lint sem erros, 44 avisos existentes. O novo teste verifica que builds sem Git ainda bloqueiam secrets e não mostram seus valores.
- Desktop empacotado e validado: versão, updater, feed GitHub, SHA-512/tamanho e blockmap; 53 chunks de JavaScript conferidos sem identificadores da Progression V1 arquivada; `security.cjs` presente no ASAR.
- Varredura local de fonte, histórico e assets sem secrets identificados.
- WEB publicado verificado: HTTP 308 para HTTPS; `/login` HTTP 200, `nosniff`, `DENY`, CSP com nonce distinto por resposta, scripts inline autorizados e HTML `private, no-store`.
- Feed público `latest.yml` coincide exatamente com o arquivo local validado da 0.1.42. API GitHub confirmou release Latest e SHA-256 dos dois instaladores igual ao local.

O primeiro build WEB foi bloqueado porque o scanner exigia metadata Git ausente na Vercel. Corrigido sem desativar a inspeção: ambientes sem `.git` varrem os arquivos-fonte enviados, enquanto `--history` continua exigindo histórico disponível. O novo deploy concluiu com READY; o site anterior permaneceu disponível durante a correção.

As pendências de Auth/CAPTCHA, homologação privada, metadados autodeclarados e assinatura Authenticode continuam documentadas em `SEGURANCA-2026-10-09.md`. Esta publicação não significa garantia de segurança absoluta nem que todas as configurações externas foram ativadas.
