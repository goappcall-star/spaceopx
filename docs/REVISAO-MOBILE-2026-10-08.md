# Revisão mobile — 08/10/2026

## Correções
- Navegação e lista de membros usam o mesmo breakpoint (1024 px). Antes, entre 768 e 1023 px, os membros estavam ocultos e não havia botão para abrir o painel.
- Painel de canais se adapta à largura disponível; navegação fecha ao abrir início, área social ou conversa.
- Configurações do servidor oferecem seleção de todas as seções no celular. Antes, o menu era ocultado sem alternativa.
- Configurações pessoais usam seletor compacto; o menu desktop não ocupa o conteúdo no celular. A grade deixa de esticar o cabeçalho quando a página é curta.
- Diálogos e confirmações respeitam largura/altura disponíveis, com rolagem para alcançar as ações finais.
- Perfis rápidos têm largura limitada e rolagem baseada no espaço disponível; perfis completos deixam margem para a moldura.
- Seletor de aparência permite quebra de linha no card inicial.
- Lista de amigos permite que ações fiquem abaixo da identificação, sem comprimir nomes e controles.
- Chat tem área de mensagens e workspace com altura mínima zero; campo de escrita encolhe corretamente e botões não se comprimem. Emojis usam grade no celular.
- Chamada com vários participantes usa uma coluna em telas estreitas; volume de participantes aparece sem depender de hover. Faixa horizontal da chamada privada não perde os primeiros participantes por centralização.
- Viewport pede redimensionamento do conteúdo ao abrir teclado nos navegadores que suportam interactive-widget.
- Layout desktop continua com painéis lado a lado a partir de 1024 px. Não foram alterados schema, permissões ou protocolo de chamadas nesta revisão.

## Validação
- Navegador em 320×640, 390×844, 768×1024 e 1280×800.
- Componentes reais: AppSidebarDrawer, Dialog, ProfileCosmeticPicker, ServerSettingsDialog e SettingsShell.
- Seleção/aplicação de Aurora, acesso a membros em celular/tablet, confirmação ao final de card longo e troca de seção de configurações.
- Seletor a 320 px: largura 296 px, sem overflow horizontal; configurações a 390 px: largura 366 px, sem overflow horizontal.
- Fixture de configurações do servidor substitui os conteúdos de seção por dados locais; verifica navegação/layout, não persistência no Supabase. Fixture pessoal usa usuário local e rotas reais, sem modificar produção.
- 143 testes automatizados passaram. Typecheck passou. Lint sem erros (avisos Fast Refresh preexistentes). Build desktop passou.

## Arquivos
Componentes modificados: app/AppSidebarDrawer, call/CallOverlay, chat/ChatView e MessageComposer, gamer/ProfileDialog e QuickProfile, server-settings/ServerSettingsDialog e SettingsRoles, settings/SettingsShell e ProfileCosmeticPicker, social/SocialHome e DirectChatView, ui/dialog, alert-dialog e popover, voice/VoiceRoom e VideoTile.
Rotas: __root.tsx, _authenticated/app.tsx. CSS: src/styles.css.
Fixtures de validação: tests/mobile/*.

## Reproduzir
Executar `npx vite --config tests/mobile/vite.config.mjs --host 127.0.0.1 --port 5186` na raiz do projeto.
Abrir /tests/mobile/index.html e /tests/mobile/settings.html no servidor local.

## Limites
Validação responsiva no Chromium; não houve teste em Android/iPhone físicos, Safari ou teclado virtual real. Compartilhamento de tela, escolha de saída de áudio e funções exclusivas do Electron continuam sujeitos ao suporte do navegador/dispositivo. Não é possível afirmar ausência de todos os bugs a partir dessas verificações. Mudanças locais, ainda não publicadas.
