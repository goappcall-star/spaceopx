# Eventos — seleção de capa por arquivo

22/10/2026 · branch `codex/communities-v1` · desenvolvimento local.

O campo de link foi substituído por seletor PNG/JPG/JPEG de até 4 MB, com prévia local, nome do arquivo e remoção da capa. Imagens antigas permanecem visíveis e podem ser substituídas ou removidas. O upload ocorre somente ao salvar, após validar os demais campos. Falhas preservam o rascunho; um upload concluído é reutilizado se a gravação do evento falhar. Object URLs são liberadas ao trocar/remover o arquivo ou desmontar o editor.

## Integração

Reutiliza `profileImagesService.upload("banners", userId, file)` exclusivamente para armazenar o arquivo: não atualiza o perfil. O bucket privado existente já permite escrever somente sob o identificador do usuário autenticado e limita imagens a 4 MB. Nenhuma política foi ampliada. O backend de eventos continua verificando autorização, canal e revisão ao salvar. A capa continua armazenada como URL HTTPS assinada, conforme o padrão existente (validade de um ano); o usuário não precisa fornecer URL. O proprietário do arquivo mantém os controles de Storage existentes. Não há nova promessa de confidencialidade de capas: elas seguem o modelo atual de imagens/URLs assinadas do aplicativo.

Não requer migration, novo bucket, Docker, novo Supabase ou alterações em voz, permissões e atualizador. A validação do cliente verifica tipo, tamanho e assinatura inicial PNG/JPEG; não é análise antivírus nem decodificação completa do arquivo. O Storage também aplica seus limites existentes. Nenhum upload real foi executado contra produção.

## Código

- `src/lib/event-cover.ts`: tipo/tamanho e assinatura do arquivo.
- `src/services/event-cover-images.ts`: adaptação do serviço de imagens existente.
- `src/components/community/CommunityEvents.tsx`: callback real de upload.
- `src/components/community/CommunityEventEditor.tsx`: seleção, prévia, remoção e envio ao salvar.
- `src/components/community/CommunityUI.tsx`: conteúdo de imagem de prévia fornecido pelo componente, mantendo validação HTTPS do campo persistido.
- `tests/community-event-cover.test.mjs` e `tests/community-visual.test.mjs`: validação, adaptação de Storage, upload somente ao salvar e reuso após erro.

## Validação

- Suíte Node: **286 aprovados, 0 falhas/ignorados**; quatro novos cenários específicos.
- TypeScript e ESLint dos arquivos alterados aprovados.
- Scanner de segurança sem achados.
- Builds WEB e Desktop locais aprovados, com configuração não operacional de compilação; sem instalador ou publicação.
- Na interface real da prévia, arquivo PNG selecionado pelo seletor nativo e renderizado via Blob URL; remoção e nova seleção conferidas. Layout observado em janela estreita e em 1366×768.
- A prévia sem Supabase permite selecionar/ver a imagem, mas bloqueia salvar uma imagem nova e identifica a ausência de autenticação. Não simula upload bem-sucedido.
- Envio e persistência reais no Storage, expiração/renovação da URL e teste manual autenticado no Electron permanecem pendentes. Testes com mocks não equivalem a validação HTTP autenticada.

[Prévia](http://127.0.0.1:5213/) · [Captura do seletor](C:/Users/nicol/Documents/Codex/2026-10-03/vo/outputs/community-event-cover-file-preview.png).

Este relatório atualiza a pendência de implementação do upload de eventos registrada na revisão visual anterior. A validação autenticada continua pendente. Nenhuma publicação, push, migration remota ou alteração da versão estável foi realizada.
