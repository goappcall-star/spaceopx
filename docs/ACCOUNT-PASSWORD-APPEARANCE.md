# Minha conta: senha e ajuste de Aparência

## Entrega local

- Minha conta recebeu uma linha Senha com ação Editar e modal com senha atual, nova senha e confirmação, visibilidade individual, validação, estado de envio e feedback.
- Aparência preserva suas opções e ganha largura útil, fontes e controles maiores, espaçamento entre grupos e reorganização da prévia em janelas menores.
- A estrutura e a navegação lateral foram preservadas. Nenhuma publicação, migration ou alteração de versão foi feita.

## Autenticação

A senha atual é verificada em um cliente temporário do mesmo serviço de autenticação, sem persistência ou substituição da sessão principal. A identidade é reconferida antes da atualização. A atualização também envia `current_password`. O cliente temporário encerra somente sua própria sessão; senhas não são gravadas em preferências ou logs.

Contas sem identidade de e-mail/senha mostram a informação de que a senha é gerenciada pelo provedor. Requisitos adicionais do backend, como reautenticação, são apresentados como erro seguro ao usuário.

Referências consultadas: [Supabase Passwords](https://supabase.com/docs/guides/auth/passwords) e [implementação oficial da atualização de usuário](https://github.com/supabase/auth/blob/master/internal/api/user.go). O comportamento nativo de exigir a senha atual depende da configuração do serviço; por isso a implementação verifica as credenciais independentemente dessa configuração.

## Arquivos desta alteração

- `src/components/settings/AccountPasswordEditor.tsx`
- `src/components/settings/AccountSettings.tsx`
- `src/components/settings/AccountSettingsView.tsx`
- `src/components/settings/account-settings.css`
- `src/components/settings/SettingsShell.tsx`
- `src/components/settings/appearance-settings.css`
- `src/lib/account-password.ts`
- `src/services/account-password.ts`
- `tests/account-password.test.mjs`
- `tests/account-settings.test.mjs`
- `tests/account-settings-preview/preview.tsx`
- `tests/appearance-settings-preview/preview.tsx`

## Verificação

- 353 testes Node aprovados, sem falhas ou ignorados.
- TypeScript, lint dos arquivos alterados e builds WEB/Desktop aprovados.
- `git diff --check` aprovado; somente avisos existentes de conversão de finais de linha.
- Prévia: modal, confirmação diferente, cancelamento e limpeza dos campos conferidos; Claro/Escuro preservados.
- Aparência conferida em 1600 px e 420 px; em 420 px, largura do documento 405 px, sem transbordamento horizontal.
- Testes de serviço simulam senha incorreta, troca de identidade/conta, sucesso, erros do backend e limpeza da sessão temporária. Não substituem autenticação HTTP real.

Não foi executada troca real de senha, nem teste autenticado ponta a ponta no WEB/EXE. Essa validação deve ser feita pelo titular da conta. Os builds não representam validação manual do instalador.

## Prévia e evidências

Prévia em `http://127.0.0.1:5213/`, módulos Minha conta e Aparência, com dados fictícios explicitamente identificados e sem Supabase.

Arquivos em `../../outputs/` a partir da raiz do projeto:

- `account-password-modal.png`
- `account-password-row.png`
- `appearance-settings-spacious.png`
- `appearance-settings-small.png`
- `account-password-appearance-tests.txt`
- `account-password-appearance-typecheck.txt`
- `account-password-appearance-lint.txt`
- `account-password-appearance-web-build.txt`
- `account-password-appearance-desktop-build.txt`
