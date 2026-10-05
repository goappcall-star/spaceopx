# LobbyX — melhorias para validação local

Data: 5 de outubro de 2026. Código implementado localmente, sem push, deploy, aplicação de migration em produção ou publicação de instalador.

## 1. Temas

Claro, Escuro e Sistema/Automático em Configurações → Aparência. Preferência local persistida; o modo automático observa mudanças de `prefers-color-scheme`. Bootstrap antes da primeira pintura, tokens semânticos para superfícies, textos, controles, bordas, sidebar, menus e notificações. Cores de destaque existentes preservadas, com contraste ajustado no tema claro. Sobreposições sobre vídeo continuam escuras para manter legibilidade.

Novos arquivos: `src/lib/theme.ts`, `src/hooks/use-theme.ts`, `src/components/settings/ThemeSelector.tsx`.

Alterados: `src/hooks/use-appearance.tsx`, `src/routes/__root.tsx`, `src/routes/_authenticated/settings_.profile.tsx`, `src/styles.css`. O seletor nativo do desktop também recebe o tema resolvido.

Validado no navegador: alternância claro/escuro/automático e persistência do claro após recarregar. Testes unitários cobrem resolução da preferência do sistema, valores inválidos e indisponibilidade de armazenamento. Não foi alterado o tema do Windows para testar uma mudança real do sistema.

## 2. Categorias

Gestão de categorias na sidebar para quem possui `manage_channels`: criar, renomear, excluir e associar canais existentes. A criação de canal permite escolher categoria. Categorias recolhíveis; canais sem categoria continuam acessíveis. Não existia drag-and-drop: `position` prepara a ordenação futura.

Novos arquivos: `src/services/categories.ts`, `src/hooks/use-categories.ts`, `src/components/app/CategoryManager.tsx`.

Alterados: `src/components/app/ChannelSidebar.tsx`, `src/components/app/CreateChannelDialog.tsx`, `src/services/channels.ts`, `src/types/index.ts`, `src/integrations/supabase/types.ts`, `src/routes/_authenticated/app.tsx`.

Migration exata a aplicar **somente após aprovação**:

`supabase/migrations/20261005040000_server_categories.sql`

Cria `server_categories`, acrescenta `channels.category_id`, índices e políticas RLS. A chave estrangeira composta impede usar categoria de outro servidor; apagar categoria limpa a associação e preserva canais. Estrutura só pode ser alterada com `has_server_permission(..., 'manage_channels')`. Leitura permanece restrita aos membros. Inclui ambas as tabelas na publicação `supabase_realtime`, reaproveitando a sincronização atual; invalida consultas após INSERT/UPDATE/DELETE e reconexão.

Teste local com PostgreSQL 18.6 e fixtures mínimas: leitura de membro, bloqueio de membro comum/estranho, CRUD autorizado, associação, rejeição de categoria de outro servidor, nomes vazios, exclusão preservando canais e presença na publicação — passaram. Arquivos: `tests/categories-fixture.sql`, `tests/categories-rls.sql`. As funções de membership/permissão são modeladas pelas fixtures; não é um teste com dados reais de produção. O transporte Supabase Realtime entre dois navegadores ainda precisa ser validado em banco de homologação com a migration aplicada.

Não executar os arquivos de fixture no Supabase: são exclusivos do banco temporário local.

## 3. Banners

Banners de perfil maiores no resumo, perfil completo e prévia de edição; avatar sobreposto com imagem estendida abaixo dele. Imagem com `cover`, alturas responsivas e espaçamento ajustado. Banner do servidor maior na sidebar e na edição, com fundo de contraste no cabeçalho.

Alterados: `src/components/gamer/QuickProfile.tsx`, `src/components/gamer/ProfileDialog.tsx`, `src/routes/_authenticated/settings_.profile.tsx`, `src/components/server-settings/SettingsProfile.tsx`, `src/components/app/ChannelSidebar.tsx`.

Prévia de edição conferida visualmente no navegador com banner real. Sem migration ou alteração de dados de perfil.

## 4. Compartilhamento com áudio

Mantido o MeshVoiceProvider usado por chamadas de servidor e privadas/grupo. Uma quarta transceiver, de áudio, transmite a track retornada pelo compartilhamento; slots anteriores de microfone/câmera/tela permanecem. Não há mistura ou troca da track do microfone. Novos participantes recebem a track ativa ao criar a conexão. Captura sem áudio continua com vídeo e mostra aviso. Encerramento remove as duas tracks da tela; sinais explícitos de início/fim também impedem manter o último quadro congelado quando o navegador não dispara `mute` imediatamente.

Reprodução usa sinks separados com a mesma política de volume do participante e deaf. Vídeo permanece mudo para não duplicar áudio. O microfone continua usando o pipeline de supressão existente. São solicitados `restrictOwnAudio` e exclusão da própria aba quando suportados; não reproduzimos o compartilhamento localmente.

Alterados: `src/services/voice.ts`, `src/services/remote-track.ts`, `src/components/voice/RemoteAudio.tsx`, `src/components/call/CallOverlay.tsx`, `src/hooks/use-voice.tsx`, `src/hooks/use-call.tsx`.

Novo: `src/lib/audio-volume.ts`.

Desktop: `desktop/main.cjs`, `desktop/screen-picker.cjs`, `desktop/picker-preload.cjs`, `desktop/picker.html`, `desktop/picker.js`, `desktop/picker.css`. O seletor Windows oferece checkbox de áudio do sistema, desligado inicialmente. Usa loopback somente quando solicitado e disponível; valida origem IPC, frame e fonte selecionada. Tema claro/escuro no seletor.

### Limites da plataforma

- WEB: obter áudio depende do navegador, sistema e seleção de aba/tela/janela. Solicitar áudio não garante que o navegador retorne uma track. Em Chrome/Edge, o usuário precisa habilitar o compartilhamento de áudio no seletor quando disponível. Uma janela pode não oferecer áudio.
- Electron/Windows: loopback é áudio do sistema, podendo incluir outros aplicativos mesmo ao selecionar uma janela. A interface informa isso. A exclusão do próprio LobbyX depende do suporte do Chromium/Windows.
- Outros sistemas: não foi implementada captura nativa de áudio do sistema; permanece fallback de vídeo.
- Participantes com builds antigos não possuem o novo slot de áudio da tela: para usar o recurso completo, atualizar WEB e EXE quando a publicação for aprovada.
- Captura real de áudio do Windows, teste entre PCs e WEB ↔ EXE precisam de validação manual. Build desktop não substitui esse teste.

Referências: [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [Electron session/loopback](https://www.electronjs.org/docs/latest/api/session), [correção restrictOwnAudio](https://releases.electronjs.org/pr/52455).

## Testes e checks

- `node --test tests/*.test.mjs`: **56 testes passaram, zero falhas**. Inclui temas, tracks separadas, mute/deaf/volume, liberação de captura tardia e reinício do compartilhamento com as mesmas tracks remotas.
- TypeScript: `tsc --noEmit` passou.
- ESLint nos arquivos funcionais alterados, novos testes e seletor desktop: **zero erros, seis warnings de hooks/fast refresh já existentes**. Tipos Supabase e routeTree gerados ficam fora dessa checagem específica. O lint geral, excluindo artefatos de build, falha com milhares de pendências, principalmente de formatação em arquivos existentes; não foi feita uma reformatação global.
- Build WEB: `npm run build:vercel` passou.
- Build desktop: `npm run desktop:build` passou. Não foi gerado/publicado novo instalador nesta etapa.
- Teste de navegador `tests/audio/screen-harness.ts`: conexões RTCPeerConnection reais, sinalização em memória e áudio/vídeo sintéticos, sem acesso ao microfone ou Supabase real. Chrome 154 no navegador integrado Windows: chamada de dois participantes, microfone recebido, tela sem áudio, tela com áudio e microfone simultâneos, mute independente, terceiro participante entrando durante compartilhamento, encerramento mantendo chamada/microfone e limpeza — passaram. RMS recebido do microfone ~0,073, acima do limiar 0,01; áudio de tela recebido também medido, não apenas presença da track. Volume/deaf validados pela política compartilhada de reprodução; não por escuta humana.
- LobbyX Music não foi testado porque a opção de bots foi cancelada anteriormente e não está presente nesta base. Não foi reintroduzida.

Arquivos de teste novos: `tests/theme.test.mjs`, `tests/screen-sharing.test.mjs`, `tests/audio/screen-harness.ts`, `tests/categories-fixture.sql`, `tests/categories-rls.sql`. Alterados: `tests/audio/pipeline-fixture.mjs`, `scripts/serve-audio-tests.mjs`.

Para repetir WebRTC localmente: executar `node scripts/serve-audio-tests.mjs --screen` na raiz do repositório, abrir `http://127.0.0.1:5182` e clicar em **Iniciar teste**. Usa sons de teste e nenhuma credencial real. Parar com Ctrl+C.

## Próxima validação manual

1. Revisar esta alteração e a migration. Aplicá-la em homologação antes de publicar; produção permanece intacta.
2. Em dois usuários/membros de um servidor de homologação, criar/renomear/remover categoria; verificar atualização nos dois clientes e negativa para membro sem `manage_channels`.
3. Conferir temas, perfis e banners em tela pequena e grande.
4. No Chrome/Edge, compartilhar uma aba com áudio habilitado; outro participante deve escutar tela e microfone. Testar mute, deaf, volume, entrada tardia e parar/retomar tela.
5. No desktop Windows com build atualizado, testar checkbox de áudio do sistema e conexão WEB ↔ EXE. Usar fones; verificar áudio de outros aplicativos e ausência de retorno do próprio LobbyX.
6. Somente após aprovação: publicar WEB, gerar novo instalador e atualizar link de download.

Nenhuma nova variável de ambiente ou serviço externo é necessária. Continuam as configurações existentes de Supabase e ICE/TURN. Esta alteração não muda a infraestrutura das chamadas.
