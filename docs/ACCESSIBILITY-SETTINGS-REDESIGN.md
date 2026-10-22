# Acessibilidade — implementação local

## Escopo

O conteúdo da aba Acessibilidade foi substituído pelas seis opções solicitadas. Logo, itens, ordem, dimensões e navegação da sidebar foram preservados. Em `SettingsShell.tsx`, apenas a descrição usada no cabeçalho de Acessibilidade foi atualizada para o texto solicitado. Nenhuma outra aba foi redesenhada.

As políticas CSS são globais quando o usuário as ativa, pois precisam melhorar a leitura e o foco no aplicativo inteiro. Não modificam dados, mídias de chamadas, dispositivos ou processamento de áudio. Sem publicação, push, migration ou alteração de versão/atualizador.

## Funcionalidades

1. Texto Compacto/Normal/Ampliado: escala base relativa de 93,75%/padrão/112,5%, respeitando a base do navegador. Com base de 16 px, os extremos são 15 e 18 px. Tipografia em rem acompanha a escala; linhas e espaçamento entre blocos textuais também são ajustados. Componentes que usam medidas fixas não são artificialmente ampliados por zoom da página.
2. Contraste: substituição temporária dos tokens de fundo, texto, texto secundário, bordas, entradas e foco, com variantes clara e escura. Desligar restaura as cores da aparência anterior, sem regravar suas preferências.
3. Movimento: desativa transições/animações CSS e rolagem suave; integra a preferência ao mecanismo existente de imagens animadas. A preferência do sistema também é respeitada. O nível do Modo Desempenho não é alterado.
4. Foco: contorno de 3 px com separação do fundo para navegação por teclado. Desligar volta ao foco normal, sem removê-lo.
5. Teclado: adiciona atalhos acessíveis por Tab para conteúdo e navegação. Não captura atalhos globais, não intercepta Push to Talk e não desliga a navegação básica por Tab. O destino é um landmark existente, com tabindex temporário restaurado ao perder foco.
6. Transparências: painéis de vidro ficam sólidos e sem backdrop blur. As preferências de Aparência permanecem salvas e são restauradas ao desligar a redução.

## Persistência e desempenho

Preferências locais em `lobbyx:accessibility:v1`, validadas por whitelist; não são enviadas ao banco. Sincronização entre janelas por evento storage. Armazenamento bloqueado mantém o funcionamento na sessão e apresenta aviso. Preferências desconhecidas ou inválidas não são aplicadas.

Sem polling, observers contínuos, captura de áudio ou temporizadores. Apenas eventos de preferência do sistema, storage e interação do usuário. Listeners são removidos ao desmontar o sincronizador. As opções começam desativadas e texto Normal, preservando a apresentação anterior; a redução de movimento do sistema pode atuar independentemente da opção local.

## Arquivos

- `src/lib/accessibility.ts`: modelo, normalização, valores padrão e atributos.
- `src/hooks/use-accessibility.ts`: armazenamento, assinaturas, sistema operacional e foco de landmarks.
- `src/components/settings/AccessibilitySync.tsx`: integração global e atalhos de navegação.
- `src/styles/accessibility.css`: políticas de conforto optativas.
- `src/components/settings/AccessibilitySettings.tsx`, `AccessibilitySettingsView.tsx` e `accessibility-settings.css`: nova página.
- `src/hooks/use-visual-quality.ts`: redução de movimento integrada apenas à animação de imagens.
- `src/routes/__root.tsx`: montagem do sincronizador.
- `src/routes/_authenticated/settings_.profile.tsx`: novo conteúdo e remoção dos controles cosméticos antigos de Acessibilidade.
- `src/components/settings/SettingsShell.tsx`: somente texto do subtítulo da aba.
- `tests/accessibility-settings-preview/preview.tsx` e prévia unificada: componente real com estado em memória e efeitos limitados à demonstração.
- `tests/accessibility-settings.test.mjs`: validação, persistência, storage bloqueado, eventos/limpeza, preferência do sistema, controles e integração de movimento com imagens.

## Testes e evidências

- 329 testes Node aprovados, zero falhas e zero ignorados, incluindo regressões existentes de voz/sinalização.
- TypeScript e lint dos arquivos envolvidos aprovados.
- Builds WEB e Desktop locais; nenhum instalador distribuído.
- Desktop 1448×1086 e mobile 390×844 conferidos. Sem overflow horizontal da página; nenhuma mídia de áudio/vídeo criada pela demonstração.
- Tamanhos 15/16/18 px observados no navegador com base padrão de 16 px.
- Contraste e opacidade 1 conferidos por estilos computados.
- Salto ao conteúdo e navegação com Tab testados na prévia; botão seguinte recebeu contorno de 3 px.
- Prévia: http://127.0.0.1:5213/ → Acessibilidade. Os ajustes da demonstração não são salvos no dispositivo.
- Capturas: `vo/outputs/accessibility-redesign-desktop.png` e `accessibility-redesign-mobile.png`.
- Logs: `vo/outputs/accessibility-redesign-tests.txt`, `accessibility-redesign-web-build.txt`, `accessibility-redesign-desktop-build.txt`.

## Conferências manuais pendentes

Reabrir o aplicativo autenticado e validar persistência após reiniciar, ajustes em telas com conteúdo extenso, tema claro, navegação nas abas e janelas do EXE. Conferir uma chamada e transmissão reais com os ajustes ativos. As regressões Node são testes automatizados, não uma chamada física. A preferência do sistema e storage indisponível foram simulados nos testes, sem alterar configurações do Windows.

Nenhum usuário, mensagem ou configuração real da conta foi alterado durante a avaliação em memória. Aguardar avaliação visual antes de qualquer publicação.
