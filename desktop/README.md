# LobbyX para Windows

Aplicativo Electron com interface empacotada e o backend configurado no build. Não precisa do Vite ou localhost para executar; login e comunicação precisam de internet.

## Desenvolvimento

Instale as dependências com `npm install`, execute `npm run desktop:build` e depois `npm run desktop:start`. Para gerar o instalador x64 no Windows, execute `npm run desktop:dist`. O resultado fica em `../outputs/windows`.

O build desktop usa o modo SPA do TanStack Start. O build web permanece separado. Alterações na interface exigem novo build e instalador. Não coloque chaves secretas nas variáveis públicas do Vite.

## Primeira versão de teste

- Sem assinatura digital ou atualização automática.
- Microfone e câmera têm solicitação de permissão. Compartilhamento exige escolher uma tela ou janela; não inclui áudio do sistema.
- Fechar a janela encerra o aplicativo. Não há execução na bandeja.
- Login, chamadas, câmera, compartilhamento e presença devem ser validados no Windows com duas contas.
- Fluxos de convite, confirmação de email e recuperação de senha precisam de configuração de URLs públicas e integração de links com o aplicativo antes da distribuição pública.

O backend existente foi mantido. Este empacotamento não aplica migrações no banco de dados.

## Atividade automática e permissões locais

A versão em desenvolvimento inclui detecção por tasklist no Windows, com consentimento persistente em permissions.json na pasta userData do Electron. Apenas jogos reconhecidos e o início da detecção vão para a presença Realtime; a lista de processos não é publicada. A atividade depende do aplicativo aberto e não grava histórico no banco.

Catálogo inicial: VALORANT, CS:GO, CS2, Palworld (Steam/Game Pass), Aniimo e o executável compartilhado League of Legends/TFT. LoL/TFT exige escolher a identificação nas configurações; o padrão identifica ambos sem adivinhar o modo. Aniimo.exe é uma identificação provisória, ainda sem validação com instalação real.

As decisões de microfone e câmera são separadas, salvas no computador e podem ser redefinidas em Configurações de perfil > Atividade de jogos e permissões. Permissões do próprio Windows continuam sendo respeitadas. Permissões são do dispositivo, não de uma conta específica do LobbyX.

Testes: node --test tests/desktop-activity.test.mjs. Antes de distribuir: autorizar, reiniciar o LobbyX, abrir/fechar cada jogo, observar em outra conta, negar/redefinir cada permissão e testar chamadas após reiniciar. Esta alteração não gerou instalador.

## Configurações organizadas

As configurações usam navegação lateral e busca, com páginas de conta, perfil, privacidade da atividade, voz, aparência, acessibilidade, permissões, jogos registrados e favoritos. Recursos sem implementação (como sobreposição dentro do jogo) não aparecem como controles ativos.

No Windows, `permissions.json` também armazena `customGames`, `hiddenGames` e `gameHistory`. O histórico registra datas de detecção, não tempo total jogado. Executáveis personalizados são nomes `.exe`, nunca caminhos ou comandos; máximo de 50. A lista de processos permanece local. A atividade pública é filtrada pela preferência global e pela visibilidade individual. LoL e TFT compartilham o controle de visibilidade porque usam o mesmo executável. Essas novas funções nativas exigem um novo build do aplicativo; o instalador só é atualizado quando solicitado.
