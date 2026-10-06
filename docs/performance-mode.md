# Modo Desempenho — implementação e validação local

Configurações → Aparência → Desempenho. Política central com normal / optimized / maximum, inicializada antes da pintura e sincronizada por useSyncExternalStore. Sem atualização por frame no React e sem requisição ao Supabase.

Persistência: localStorage, chave lobbyx:visual-quality. Individual ao navegador/origem e ao Electron; não sincroniza entre dispositivos ou usuários. Sem seleção válida anterior, prefers-reduced-motion ativa Otimizado. Uma escolha explícita é preservada. As regras de acessibilidade já existentes continuam respeitando redução de movimento.

| Recurso | Normal visível | Otimizado | Máximo |
| --- | --- | --- | --- |
| Molduras e rastros | Animações originais | Arte estática preservada | Arte estática preservada |
| Filtros SVG das molduras | Originais | Sem filtros de glow/distorção | Sem filtros de glow/distorção |
| Blur dos painéis e overlays | Original | Removido | Removido |
| Sombras marcadas e painéis | Originais | Simplificadas | Simplificadas |
| Pulsação e shimmer decorativo | Originais | Pausados | Desativados |
| Menus, transições e indicadores de carregamento | Originais | Mantidos | Sem animação; estados e textos continuam funcionando |
| GIFs identificados em avatar, banner e anexos | Originais | Quadro estático em canvas | Quadro estático em canvas |

Efeitos de maior custo encontrados: reconstrução de 12 paths por Corte Flamejante a 30 FPS, feTurbulence/feDisplacementMap animados, glow/blur SVG, filtros backdrop-blur e sombras em painéis. Não há canvas/WebGL decorativo contínuo além dos rastros SVG. RAF da análise de voz e da medição de microfone são funcionais e foram preservados.

Otimizações adicionais: a geometria de 2.400 pontos do Corte Flamejante é compartilhada entre instâncias. O relógio compartilhado fica sem assinantes nos modos reduzidos; SMIL é pausado junto ao relógio. CSS pausa animações com a janela oculta, inclusive pseudo-elementos. GIFs identificáveis são substituídos por um quadro estático quando a janela fica oculta, voltando ao original quando reaparece. O observador de viewport e as pausas de molduras fora da tela existentes foram mantidos. Imagens estáticas não mantêm um decodificador GIF escondido; snapshots são limitados a 1.024 pixels no maior eixo e descartados ao desmontar.

Validação: fixture React real com oito cards, usando AnimeFrame e FlamingCutFrame reais. Em uma janela de cerca de 2,5 segundos, Normal registrou 1.560 alterações de paths e oito animações CSS ativas; Otimizado registrou zero alterações contínuas e zero animações ativas; Máximo também zerou animações e alterações contínuas. Na montagem inicial pode haver alterações únicas para desenhar a arte estática. A contagem de nodes permaneceu em 428 sem GIF / 431 com o GIF de teste: nenhum card foi removido. GIF animado validado como canvas estático, e retorno a Normal validado como imagem original. Persistência confirmada após reload.

Esses números medem trabalho gráfico e não equivalem a porcentagens de CPU/GPU/FPS ou redução medida de RAM. A API do navegador não fornece uma medição confiável de GPU/CPU por componente nesta execução. Não foi demonstrada redução percentual de memória ou FPS; a economia estrutural de arrays foi implementada, sem estimar ganho de RAM. O fixture é um teste isolado, não um benchmark de uma chamada real com dezenas de usuários.

Typecheck, build e 92 testes Node passaram. Lint dos arquivos alterados sem erros; avisos de Fast Refresh não impedem execução. Serviços de voz, WebRTC, bitrate, supressão de ruído, compartilhamento, AFK, permissões, Realtime e notificações não foram modificados nesta etapa. Compatibilidade Electron usa o mesmo renderer e localStorage; ainda não foi empacotada ou publicada uma nova versão para esta alteração.

Limitações de GIF: detecção por extensão .gif ou indicação explícita; formatos animados sem identificação (APNG/WebP animado e URLs sem extensão) não são convertidos automaticamente. Vídeos anexados e transmissões permanecem funcionais e não são congelados.

Arquivos novos:
- src/lib/visual-quality.ts
- src/hooks/use-visual-quality.ts
- src/components/settings/PerformanceSettings.tsx
- src/components/ui/static-image.tsx
- tests/visual-quality.test.mjs
- tests/performance/{harness.tsx,index.html,vite.config.mjs,test.gif}
- docs/performance-mode.md

Arquivos modificados:
- src/routes/__root.tsx
- src/routes/_authenticated/settings_.profile.tsx
- src/styles.css
- src/components/ui/avatar.tsx
- src/components/gamer/{FlamingCutFrame,QuickProfile,ProfileDialog}.tsx
- src/components/settings/ProfileCosmeticPicker.tsx
- src/components/chat/AttachmentView.tsx
- src/components/social/DmAttachmentView.tsx

Reproduzir benchmark: npx vite --config tests/performance/vite.config.mjs --host 127.0.0.1 --port 5184; abrir /tests/performance/index.html e selecionar os três níveis. Aguardar a atualização do resultado de cada nível. Para comparar os valores, manter viewport e número de cards visíveis constantes.

Nenhuma migration ou variável de ambiente nova. Alterações ainda locais.
