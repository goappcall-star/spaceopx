# Rodapé de Perfil e estado sem chamada

Correção local: a barra de salvar do Perfil deixou de ser sticky. Ela agora fica no fluxo após os cards, sem cobrir controles de personalização. Nas Configurações desktop, o contêiner externo usa `overflow: clip`, preservando a rolagem independente da sidebar e do conteúdo e impedindo rolagem externa adicional ao focar um botão no fim da página.

Removida a frase “Nenhuma chamada em andamento.” da hotbar. O perfil e seus controles permanecem disponíveis.

A prévia da hotbar em `http://127.0.0.1:5222/` permite abrir Configurações com componentes reais e perfil fictício, sem autenticação ou mídia real.

Validação: 11 testes de Perfil/hotbar e TypeScript aprovados; lint dos arquivos TSX alterados sem erros, com um aviso de Fast Refresh na prévia. Conferência visual em 1280 × 720, fora de chamada e em chamada simulada: fim do card em y=480,7, início dos botões em y=498,7 e fim em y=573,7, hotbar em y=654; rolagem externa igual a zero. Antes, os botões sticky cobriam o conteúdo. Capturas `outputs/profile-footer-before.png` e `outputs/profile-footer-after.png` na pasta principal do trabalho.

Sem mudanças de voz, banco de dados ou publicação.
