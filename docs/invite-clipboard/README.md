# Cópia de convites no Electron

Causas identificadas no código: handlers de permissões rejeitam clipboard pelo navegador; nenhuma API nativa de cópia existia no preload. InviteDialog e SettingsInvites capturavam a rejeição e ainda exibiam sucesso. inviteUrl usava window.location.origin, que no protocolo lobbyx pode ser opaco ou interno e não constitui um link WEB compartilhável.

Correção: IPC desktop:clipboard-write usa electron.clipboard.writeText, exposto por contextBridge somente como escrita de texto. Handler exige webContents autorizado, mainFrame exato, URL confiável e tamanho máximo 65536; não expõe leitura do clipboard ou ipcRenderer genérico. Removido ao fechar janela. Permissões do navegador, sandbox, contextIsolation e webSecurity mantidas. copyText usa ponte nativa quando disponível e mantém API WEB; erros propagados. Convites confirmam sucesso somente após copiar e informam falha. Origem opaca/customizada usa https://lobbyx-nine.vercel.app; WEB mantém sua origem; código codificado para path seguro.

218 testes aprovados, typecheck, lint dos arquivos frontend, sintaxe de main/preload/clipboard e build Desktop aprovados. Novos testes verificam origem pública, prioridade nativa, cópia WEB, falhas, isolamento IPC de janela/frame/origem e limite de payload. Escrita real na área de transferência do Windows e teste manual do novo instalador ainda pendentes; os testes de IPC usam escritor controlado e não modificam a área de transferência do usuário.

Nenhum push, deploy, release, migration ou alteração de produção. Melhorias de @todos/autocomplete preservadas; a migration específica de @todos segue pendente e não é necessária para corrigir a cópia. Código instalado 0.1.52 permanece inalterado até próxima distribuição autorizada.
