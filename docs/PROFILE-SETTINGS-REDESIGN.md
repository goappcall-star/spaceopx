# Perfil — reformulação visual local

Referência: `Perfil LobbyX Neon.png`. Implementação na branch `codex/communities-v1`, sem publicação, push, migration ou alteração da versão.

## Entrega

- Correção de escopo: o componente original `SettingsShell` é reutilizado sem alterações. Sidebar, busca, categorias, ordem, largura, cabeçalho, fechamento e navegação permanecem originais.
- Somente o conteúdo central da aba Perfil foi redesenhado: Identidade, Aparência, prévia vertical e rodapé persistente.
- Nome, username imutável, bio, upload de avatar/banner, seletores existentes de molduras/placa e preferência de animações.
- Prévia imediata de texto, imagens e cosméticos; XP e badges vindos das consultas existentes na tela autenticada.
- Edição local até Salvar. Restaurar padrão descarta a edição e retorna ao perfil salvo; Cancelar descarta e volta ao aplicativo.
- Campos de presença/status não aparecem e não são enviados no update. Preferências de áudio e demais opções não são redefinidas.
- Limites de 32/160 caracteres em novos textos. Textos antigos maiores são preservados ao mudar apenas cosméticos.
- Uploads usam os buckets privados e a autorização existentes. URLs de prévia local são liberadas ao trocar imagem ou desmontar.
- Estado e cache de uploads separados por conta; repetição de salvar bloqueada enquanto há operação em curso.
- Altura desconta a barra do Desktop; layout responsivo e efeitos sujeitos ao Modo Desempenho existente.

## Arquivos

- `src/components/settings/ProfileSettingsEditor.tsx`: integração com autenticação, queries e persistência.
- `src/components/settings/ProfileSettingsView.tsx` e `profile-settings.css`: somente conteúdo central, sem sidebar própria.
- `src/components/settings/ProfileCosmeticPicker.tsx`: apresentação compacta opcional, preservando o diálogo existente.
- `src/lib/profile-editor.ts` e `profile-image.ts`: draft, validação e whitelist de atualização.
- `src/services/profile-images.ts`: reutilização da validação extraída, sem alteração dos contratos de upload.
- `src/routes/_authenticated/settings_.profile.tsx`: delega somente a seção Perfil ao novo editor; demais configurações preservadas.
- `tests/profile-settings-preview/preview.tsx`: fixture identificada, sem Supabase e sem persistência remota.
- `tests/community-unified-preview/preview.tsx` e `preview.css`: acesso pela opção Perfil.
- `tests/profile-editor.test.mjs`: proteção dos campos excluídos, limites/legado e validação de imagens.

## Validação

- 318 testes Node aprovados, zero falhas e zero ignorados.
- TypeScript aprovado.
- ESLint dos arquivos alterados aprovado.
- Builds WEB e Desktop locais aprovados, sem distribuição de instalador.
- Verificação visual real em 1448×1086, 1366×768 e 390×844.
- Nome alterado/restaurado, bio salva em memória e diálogo de molduras aberto e cancelado no navegador.
- Rodapé confirmado dentro da viewport de notebook e mobile, sem overflow horizontal da página.

Logs em `vo/outputs/profile-v2-tests.txt`, `profile-v2-web-build.txt` e `profile-v2-desktop-build.txt`.
Capturas em `vo/outputs/profile-v2-desktop.png`, `profile-v2-notebook.png` e `profile-v2-mobile.png`.

## Limites e avaliação manual pendente

- A prévia em http://127.0.0.1:5213/ → Perfil usa dados fictícios e callbacks em memória, incluindo imagens locais. Não comprova autenticação ou upload remoto.
- Revalidar manualmente em conta autenticada: salvar, reabrir, upload, troca de conta, erro de rede e preferência de animações. Nenhum dado real foi alterado nesta tarefa.
- Não foi executado um EXE instalado; o build Desktop foi compilado, e a interface conferida no navegador.
- A sidebar e o card Premium criados na primeira versão foram removidos. O menu original de Configurações foi preservado integralmente. A demonstração isolada exibe somente o conteúdo central; o aplicativo autenticado usa o SettingsShell original.
- A prévia reutiliza as artes e molduras existentes, sem copiar os personagens da referência como ativos do produto. No aplicativo, imagens e conquistas pertencem à conta real.
- Perfil e preferência de animações usam operações separadas. Se só a preferência falhar, o erro explica o salvamento parcial e permite tentar novamente, reutilizando uploads concluídos.
- Nenhuma mudança em voz, chat, hotbar, XP individual, migrações ou mecanismos de publicação.

## Correção de escopo solicitada

A sidebar adicional, seu CSS, o cabeçalho alternativo e os atalhos de navegação adicionados em app.tsx foram removidos. `SettingsShell.tsx` e `app.tsx` não apresentam diff em relação ao HEAD. Nenhuma configuração externa à aba Perfil foi redesenhada. Captura corrigida: `vo/outputs/profile-v2-content-only.png`.
