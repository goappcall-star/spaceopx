# Comunidades V1 — auditoria visual anterior ao redesign

21/10/2026. Base `1278e33`, branch `codex/communities-v1`, árvore inicialmente limpa. Esta tarefa substitui a preparação de publicação: nenhuma autorização de migration foi concedida e nenhuma publicação será feita.

## Diagnóstico e decisão

| Área auditada | Problema observado no código/interface | Intervenção |
| --- | --- | --- |
| Criar/editar evento | Modal estreito, sequência uniforme de campos, URL de capa sem prévia, fuso com mesmo peso do nome, sem cartão de resultado | Prioridade 1: composição com editor e prévia, agrupamento e fuso avançado, ações fixas |
| Home | Banner, módulos e hierarquia já existem; progresso ocupa área longa antes dos módulos | Preservar estrutura; ajustar acabamento e atalhos, sem redesenhar navegação |
| Ativação | Fluxo de seis etapas já apropriado e com revisão; indicador/rodapé e avisos podem ganhar consistência | Refinar progresso e apresentação, sem adicionar etapas |
| Onboarding | Etapas funcionais, mas apresentação uniforme; interesses/cargos pouco diferenciados e conclusão sem resumo visual | Melhorar progresso, seleções e resumo; preservar aceite/revisões |
| Home e boas-vindas / configurações | Formulário muito longo, seções com pouca distinção e sem prévia da apresentação | Organizar seções e permitir alternar grupos sem perder o rascunho; prévia da identidade |
| Publicação no Explorar | Todos os campos empilhados; consentimento e identidade competem; sem prévia pública | Identidade/editor e cartão de prévia; admissão e consentimento claramente separados |
| Solicitações | Lista funcional compacta, mas vazio/loading e identificação insuficientes | Refinar linhas, estados e ações preservando revisão e callbacks |
| Busca/cards/apresentação pública | Banner e categorias já presentes; filtros muito semelhantes ao restante | Refinar agrupamento/identidade e estados, preservar ausência de números inventados |
| Denúncias/evidência | Fila apresenta ID longo e vários textos com mesmo peso; editor básico | Separar contexto, evidência e decisão; formulário de denúncia com orientação |
| Advertências/sanções | Consequências não detalhadas por ação; formulário genérico com checkbox de conferência | Resumo visível da ação/membro e consequências; manter motivo/checkbox e backend |
| Antispam e cargos de moderação | Campos administrativos em sequência, sem grupos por finalidade | Agrupar limites, links e autorização; nenhuma punição nova |
| Central oficial | Recursos sensíveis já separados no backend; controles visuais genéricos | Tornar escopo oficial e efeito de cada ação visíveis |
| Níveis/XP | Barra e explicação corretas, porém pouco contraste entre valor e instruções | Acabamento compacto e hierarquia, sem mudar fórmula ou estado da fonte |
| Missões/conquistas | Status correto; cards e galeria pouco diferenciados | Hierarquia/status e progressão estática; indisponíveis continuam bloqueados |
| Estatísticas | Métricas uniformes; série compacta sem datas visíveis nas barras | Destacar indicadores principais, legenda/período e dados indisponíveis |
| Cosméticos | Cinco cards quase iguais, prévia genérica e estado pouco hierárquico | Coleção com identificação do slot, seleção/disponibilidade e prévia mais clara |
| Modais/confirmações/seletores | Padrões repetidos e altura variável; confirmações sensíveis devem continuar explícitas | Componentes compartilhados leves, sem alterar Dialog/AlertDialog global |

## Direção

Evoluir Button, Dialog, Input, Label e tokens existentes. Componentes compartilhados apenas para cabeçalho, seção, feedback, capa/prévia, ações e vazio. Ações primárias verde-limão oficial; detalhes e progressão roxos. Superfícies grafite, bordas moderadas; sem blur, canvas, animações ou novas dependências.

O serviço atual de imagens escreve objetos privados sob `manage_server`, retorna URL assinada e não atualiza o servidor por si. Gerenciar eventos/comunidade não implica essa permissão. Não ampliar Storage/RLS. Uma callback de upload só será oferecida onde o controlador já puder comprovar autorização; caso contrário, manter HTTPS e explicar a pendência. Fixtures não simularão upload remoto.

## Preservação e validação planejada

Não alterar migrations, RPC, RLS, XP, fontes/verificadores, sanções, RSVP, notificações, WebRTC, hotbar, Central Social, versão ou atualizador. A revisão é local. Antes/depois nas principais áreas; desktop 1366×768 e 1920×1080, móvel e janela menor; teclado/foco, rolagem e campos nativos. Node, typecheck, lint focado, scanner, builds WEB/Desktop e interações com componentes reais. Sem alegar sessão autenticada ou upload validado por uma prévia de fixtures.
