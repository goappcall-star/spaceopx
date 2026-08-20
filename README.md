# Secure Channels

Quero iniciar um novo aplicativo chamado provisoriamente "SecureChat".

O objetivo do produto é criar uma plataforma de comunicação inspirada na experiência de servidores e canais de aplicativos como Discord, porém com um diferencial central: futuramente teremos um sistema avançado de monitoramento e segurança baseado em IA.

IMPORTANTE:

Nesta primeira etapa NÃO implemente IA, análise de mensagens, chamadas de voz, automações de moderação ou recursos avançados de chat.

Nesta etapa quero construir somente uma fundação sólida, escalável e segura para o restante do produto.

==================================================

1. STACK

==================================================

Utilize:

- React

- TypeScript

- Tailwind CSS

- Supabase

- Supabase Auth

- PostgreSQL

- Supabase RLS

Não substitua o Supabase por outro backend.

Não utilize dados mockados como fonte definitiva de dados.

Todas as entidades principais devem estar persistidas no Supabase.

==================================================

2. CONCEITO DO SISTEMA

==================================================

O sistema será multi-tenant.

A unidade principal de isolamento será o SERVER.

Um usuário pode participar de vários servidores.

Cada servidor possui seus próprios:

- membros

- cargos

- canais

- configurações

- mensagens futuramente

- eventos de segurança futuramente

Um usuário NÃO pode acessar dados de um servidor do qual não é membro.

Essa regra deve ser garantida pelo PostgreSQL/RLS e não apenas pelo frontend.

==================================================

3. AUTENTICAÇÃO

==================================================

Implementar:

- Cadastro

- Login

- Logout

- Recuperação de senha

- Persistência de sessão

- Proteção de rotas

Após o cadastro, criar automaticamente o perfil do usuário.

O usuário deve possuir:

- id

- username

- display_name

- avatar_url

- status

- created_at

- updated_at

Status inicialmente:

- online

- idle

- offline

Username deve ser único.

Não permitir que um usuário tenha dois perfis.

==================================================

4. PERFIL

==================================================

Criar tela de perfil/configurações pessoais.

Permitir alterar:

- avatar

- display_name

- username

O usuário poderá visualizar:

- data de criação da conta

- username

- status

Não permitir que o usuário altere diretamente seu UUID ou dados internos.

==================================================

5. SERVIDORES

==================================================

Criar tabela:

servers

Campos:

- id UUID

- owner_id UUID

- name TEXT

- icon_url TEXT

- description TEXT

- created_at TIMESTAMP

- updated_at TIMESTAMP

Cada servidor possui exatamente um owner.

O owner deve ser obrigatoriamente um usuário autenticado.

==================================================

6. MEMBROS DO SERVIDOR

==================================================

Criar tabela:

server_members

Campos:

- id UUID

- server_id UUID

- user_id UUID

- nickname TEXT

- joined_at TIMESTAMP

- created_at TIMESTAMP

Criar constraint UNIQUE:

(server_id, user_id)

Um usuário não pode entrar duas vezes no mesmo servidor.

Quando um usuário criar um servidor:

1. O servidor é criado.

2. O usuário automaticamente entra como membro.

3. O usuário recebe o cargo OWNER.

==================================================

7. CARGOS

==================================================

Criar tabela:

roles

Campos:

- id UUID

- server_id UUID

- name TEXT

- color TEXT

- position INTEGER

- permissions JSONB

- created_at TIMESTAMP

Criar inicialmente três cargos:

OWNER

ADMIN

MEMBER

OWNER deve possuir todas as permissões.

ADMIN terá permissões administrativas.

MEMBER terá permissões básicas.

Não confiar somente no JSONB para autorização.

O RLS deve continuar garantindo o isolamento por servidor.

==================================================

8. MEMBRO + CARGO

==================================================

Criar tabela:

member_roles

Campos:

- id UUID

- member_id UUID

- role_id UUID

- created_at TIMESTAMP

Criar constraint UNIQUE:

(member_id, role_id)

Quando um usuário entrar em um servidor, deverá receber automaticamente o cargo MEMBER.

Quando o proprietário criar o servidor, ele deverá receber OWNER.

==================================================

9. CANAIS

==================================================

Criar tabela:

channels

Campos:

- id UUID

- server_id UUID

- name TEXT

- type TEXT

- description TEXT

- position INTEGER

- created_at TIMESTAMP

- updated_at TIMESTAMP

Nesta primeira etapa utilizar apenas:

type = "text"

Preparar a arquitetura para futuramente suportar:

- text

- voice

- announcement

- forum

Mas NÃO implementar esses tipos agora.

Cada servidor criado deverá possuir automaticamente um canal:

# geral

Esse canal será do tipo text.

==================================================

10. CONVITES

==================================================

Criar tabela:

server_invites

Campos:

- id UUID

- server_id UUID

- code TEXT

- created_by UUID

- max_uses INTEGER

- uses INTEGER

- expires_at TIMESTAMP

- created_at TIMESTAMP

O código deverá ser único.

Criar funcionalidade:

"Convidar pessoas"

O usuário poderá gerar um convite.

Criar uma página/rota para:

/invite/:code

Ao acessar um convite válido, o usuário poderá entrar no servidor.

Validar:

- convite existente

- servidor existente

- expiração

- limite de usos

Não permitir entrada duplicada.

==================================================

11. RLS

==================================================

Esta é uma parte CRÍTICA.

Ativar RLS em TODAS as tabelas criadas.

Criar políticas para garantir:

PROFILES:

- usuário pode visualizar dados públicos necessários

- usuário pode editar somente seu próprio perfil

SERVERS:

- somente membros podem visualizar um servidor

- somente usuários autorizados podem alterar configurações

- somente owner pode excluir o servidor

SERVER_MEMBERS:

- somente membros do mesmo servidor podem visualizar membros

- somente usuários autorizados podem adicionar/remover membros

ROLES:

- somente membros do servidor podem visualizar cargos

- somente OWNER/ADMIN podem administrar cargos

MEMBER_ROLES:

- somente membros do servidor podem visualizar

- somente usuários autorizados podem alterar

CHANNELS:

- somente membros do servidor podem visualizar

- somente OWNER/ADMIN podem criar, alterar ou excluir canais

SERVER_INVITES:

- somente usuários autorizados podem criar convites

- convites válidos precisam funcionar para usuários autenticados

IMPORTANTE:

Não usar simplesmente:

"auth.uid() = user_id"

para todas as tabelas.

As políticas devem verificar corretamente o relacionamento entre:

auth.uid()

→ server_members

→ server_id

→ recurso solicitado.

==================================================

12. FUNÇÕES SEGURAS

==================================================

Quando necessário, criar funções PostgreSQL SECURITY DEFINER para operações que exigem múltiplas alterações atômicas.

Exemplo:

create_server()

Essa função deverá:

1. Criar servidor.

2. Criar OWNER role.

3. Criar ADMIN role.

4. Criar MEMBER role.

5. Criar membership do owner.

6. Associar OWNER ao owner.

7. Criar canal #geral.

Tudo de forma transacional.

Não deixar o frontend responsável por executar essa sequência manualmente.

==================================================

13. INTERFACE

==================================================

Criar uma interface moderna inspirada na organização de aplicativos de comunicação, mas NÃO copiar identidade visual, logos ou elementos proprietários do Discord.

Tema:

- dark

- moderno

- tecnológico

- profissional

- foco em segurança

Layout inicial:

SIDEBAR ESQUERDA:

Lista vertical de servidores.

BOTÃO:

+

para criar/entrar em servidor.

ÁREA CENTRAL:

Quando nenhum servidor estiver selecionado:

"Bem-vindo ao SecureChat"

Texto:

"Escolha um servidor ou crie seu primeiro servidor."

Quando um servidor estiver selecionado:

Mostrar:

- nome do servidor

- lista de canais

- # geral

PAINEL DIREITO:

Mostrar inicialmente a lista de membros do servidor.

==================================================

14. CRIAÇÃO DE SERVIDOR

==================================================

Criar modal:

"Criar servidor"

Campos:

- nome

- descrição

- ícone opcional

Botão:

"Create Server"

Ao criar:

- criar servidor

- criar cargos

- adicionar owner

- criar #geral

- selecionar automaticamente o novo servidor

==================================================

15. ENTRAR EM SERVIDOR

==================================================

Criar modal:

"Entrar em servidor"

Campo:

código do convite

Botão:

"Entrar"

Após sucesso:

- adicionar usuário ao server_members

- atribuir MEMBER

- abrir o servidor

==================================================

16. NAVEGAÇÃO

==================================================

Rotas mínimas:

/login

/register

/forgot-password

/app

/settings

/invite/:code

A rota /app deve exigir autenticação.

Se usuário não estiver autenticado:

→ /login

==================================================

17. ARQUITETURA DE CÓDIGO

==================================================

Organizar o projeto de forma modular.

Separar:

components/

pages/

hooks/

lib/

services/

types/

Criar serviços separados para:

- auth

- profiles

- servers

- members

- roles

- channels

- invites

Evitar colocar toda a lógica em componentes React.

==================================================

18. SEGURANÇA

==================================================

NÃO:

- colocar service_role key no frontend

- confiar em permissões apenas no React

- usar dados mockados como fonte principal

- permitir acesso direto a dados de outros servidores

- colocar credenciais secretas no código

- criar políticas RLS permissivas como "authenticated users can do everything"

Usar somente variáveis públicas apropriadas no frontend.

==================================================

19. FUTURA ARQUITETURA DE SEGURANÇA

==================================================

Prepare a arquitetura para futuramente adicionar:

security_events

security_scores

ai_analysis

reports

moderation_actions

security_settings

NÃO criar a IA ainda.

Mas evite decisões de arquitetura que dificultem adicionar esses recursos depois.

==================================================

20. QUALIDADE

==================================================

Prioridades:

1. Segurança

2. Integridade do banco

3. RLS

4. Arquitetura escalável

5. UX

6. Visual

Antes de finalizar, verifique:

- TypeScript sem erros

- queries funcionando

- autenticação funcionando

- RLS funcionando

- criação de servidor funcionando

- criação automática dos cargos funcionando

- criação automática do #geral funcionando

- convite funcionando

- isolamento entre servidores funcionando

Não avance para recursos não solicitados.

Depois de implementar, apresente um resumo do que foi criado e qualquer problema técnico encontrado.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://spaceopx.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/565c686e-a227-40bd-a40a-8c63a0952cd1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
