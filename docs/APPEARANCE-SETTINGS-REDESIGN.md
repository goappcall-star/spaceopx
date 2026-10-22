# Aparência — redesign local

## Escopo e preservação

Somente o conteúdo da aba Aparência foi substituído. `SettingsShell.tsx` permanece intacto, incluindo sidebar, busca, categorias, largura, cabeçalho e navegação. As abas Perfil, Minha conta, Voz e áudio e Acessibilidade não foram redesenhadas nesta tarefa. Os controles anteriores de Acessibilidade conservam seu comportamento.

Não houve publicação, push, migration, mudança de versão, alteração do atualizador ou modificação de chamadas.

## Interface e integração

- Cards Personalização visual e Desempenho; painel de pré-visualização à direita, com lista ilustrativa e hotbar em miniatura.
- Tema Escuro/Claro/Automático usa `useTheme` existente, com persistência local e acompanhamento do sistema.
- Cor de destaque, glow, animações, animações das molduras e transparência usam os valores e a persistência existentes. Mantidas as seis cores reais, incluindo Ciano; não foi inventada a opção Rosa.
- Transparência mantém Nenhuma, além de Baixa/Média/Alta, preservando preferências anteriores.
- Preferências da conta são atualizadas parcialmente por `preferencesService.save`; controles aguardam a conclusão da gravação. Carregamento e falhas são indicados, sem sinalizar sucesso antes de salvar. Não são sobrescritas preferências de áudio.
- Modo Desempenho e níveis usam `setVisualQuality` existente. O modo ligado seleciona Otimizado e desligado seleciona Normal. Mantidos os níveis reais: Normal, Otimizado e Desempenho Máximo.
- Otimizado e Máximo suprimem efeitos na prévia, preservando as preferências de personalização. Redução de movimento do sistema é respeitada.
- Performance Monitor reutiliza `AdminMonitorLink`, com a autorização existente. Abrir a página não inicia o monitor automaticamente.
- A demonstração permite filtrar exemplos de amigos, alterar uma faixa de volume e alternar indicadores de mic/fone. São estados visuais locais, sem captura de mídia, streams, dispositivos ou alteração de chamadas.

## Opções sem suporte atual

Densidade não existe nos contratos atuais; as três opções aparecem desabilitadas com explicação. Não foi implementado um comportamento apenas visual apresentado como configuração global.

O nível Elevado não existe. Não foi renomeado Desempenho Máximo para Elevado, pois seu efeito real é reduzir efeitos. A interface explica essa diferença e conserva os três níveis funcionais existentes.

## Arquivos

- `src/components/settings/AppearanceSettings.tsx`: integração com preferências, tema, qualidade visual e autorização do monitor.
- `src/components/settings/AppearanceSettingsView.tsx` e `appearance-settings.css`: conteúdo central e prévias interativas com estilos locais.
- `src/lib/appearance-settings.ts`: opções existentes e política da prévia.
- `src/routes/_authenticated/settings_.profile.tsx`: seleciona o novo conteúdo somente para Aparência e remove o bloco antigo correspondente.
- `tests/appearance-settings-preview/preview.tsx`: demonstração com o componente real e estado em memória.
- `tests/community-unified-preview/preview.tsx` e `preview.css`: entrada Aparência na prévia local.
- `tests/appearance-settings.test.mjs`: efeitos/desempenho, movimento reduzido, transparência, cores, contratos dos controles e ausência de elementos de mídia.

## Validação

- 324 testes Node aprovados, zero falhas e zero ignorados.
- TypeScript e ESLint dos arquivos envolvidos aprovados.
- Builds WEB e Desktop locais aprovados; nenhum instalador foi distribuído.
- Na última recompilação paralela, o WEB encontrou EPERM em uma pasta temporária do Nitro no Windows. A repetição isolada, após concluir o Desktop, passou. Nenhum arquivo de usuário foi apagado para resolver a falha.
- Prévia verificada em desktop 1491×1055 e mobile 390×844, sem overflow horizontal da página.
- Troca Claro/Roxo/Máximo conferida no navegador: ambos os exemplos ficaram claros, roxos e com glow/movimento/molduras desativados efetivamente.
- Retorno ao Normal preservou os controles de personalização. Filtro de amigos e mic de demonstração funcionaram sem áudio real.
- DOM sem elementos audio/video. Sidebar original sem diff.

Prévia: http://127.0.0.1:5213/ → Aparência.
Capturas: `vo/outputs/appearance-redesign-desktop.png` e `appearance-redesign-mobile.png`.
Logs: `vo/outputs/appearance-redesign-tests.txt`, `appearance-redesign-web-build.txt` e `appearance-redesign-desktop-build.txt`.

## Limitações de integração

A prévia usa somente estado em memória e não altera o tema/qualidade global nem preferências reais. O botão de monitor está desabilitado nesse ambiente sem autenticação. No aplicativo, as configurações reais usam os mecanismos existentes.

Persistência com login real, falhas de rede do Supabase e acesso administrativo ao monitor ainda exigem conferência manual autenticada. O EXE foi compilado, mas não foi instalado/testado interativamente. Nenhum dado de produção foi usado nos testes.
