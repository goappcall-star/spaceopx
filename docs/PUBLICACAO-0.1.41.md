# LobbyX 0.1.41 — publicação verificada

Publicado em 08/10/2026 (Brasil), 09/10/2026 UTC.

- Commit de implementação/release: `7a8f80cdc6de37144f078315860376ac18f4f7fc`.
- WEB: https://lobbyx-nine.vercel.app — Vercel production READY, deploy `dpl_82p2TTNHjhfEDCxz6NkRUbjqyCPS`.
- Deploy individual: https://lobbyx-4ofl3vdqu-nicolasmaarttins-projects.vercel.app.
- GitHub Releases: https://github.com/goappcall-star/spaceopx/releases/tag/v0.1.41 — publicado, não draft, marcado Latest, target no commit acima.
- Instalador: https://github.com/goappcall-star/spaceopx/releases/download/v0.1.41/LobbyX-Setup-0.1.41-x64.exe.
- Arquivos adicionais publicados: `LobbyX-Setup-x64.exe` (URL estável), `LobbyX-Setup-0.1.41-x64.exe.blockmap`, `latest.yml`.

## Conteúdo

Recuperação de presença sem reiniciar mídia saudável, redução de publicações repetidas, tratamento de mensagens de sessões encerradas, preservação da exibição de participantes em trocas/retorno/sincronização e ordem fixa dos usuários em cada canal. Novas entradas vão ao final sem reposicionar quem já está presente.

**LobbyX Progression V1 está arquivado e excluído da publicação.** Nenhuma migration foi aplicada nesta publicação. O sistema anterior de perfil/XP permanece intacto; detalhes de recuperação estão em `docs/ATUALIZACOES-ARQUIVADAS.md`.

## Validação

- 152 testes passaram; typecheck passou; lint sem erros (44 warnings existentes).
- Build WEB na Vercel e empacotamento `desktop:dist` passaram.
- Verificador de release confirmou versão 0.1.41 no `app.asar`, instalação de electron-updater, feed GitHub, checksum SHA-512/tamanho do instalador e blockmap.
- Homepage e bundle remoto `app-CpAvpeVK.js` responderam HTTP 200. Bundle remoto não contém referências ao recurso arquivado.
- 52 assets JavaScript extraídos do `app.asar` verificados sem os identificadores/rota da nova Progressão.
- SHA-256 dos dois instaladores publicados corresponde ao instalador local: `cca96421ca80f031f97cd73438f4d68e8074d85b71bcaeec32fcee46058ed1fd`.
- Feed público `latest.yml` baixado da release corresponde exatamente ao arquivo local validado.

O usuário pode atualizar pelo mecanismo existente do Desktop e reiniciar pelo botão de atualização quando estiver fora de chamada/compartilhamento. Instalação e chamada prolongada entre duas máquinas em redes distintas não foram executadas nesta etapa de publicação; verificação funcional de produção ainda deve observar os limites descritos no relatório de estabilidade.
