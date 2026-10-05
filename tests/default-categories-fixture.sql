ALTER TABLE public.servers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.servers ADD COLUMN owner_id uuid;
ALTER TABLE public.servers ADD COLUMN name text;
ALTER TABLE public.servers ADD COLUMN description text;
ALTER TABLE public.servers ADD COLUMN icon_url text;
ALTER TABLE public.channels ADD COLUMN type text DEFAULT 'text';
ALTER TABLE public.channels ADD COLUMN description text;
CREATE TABLE public.roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_id uuid, name text, color text, position integer, permissions jsonb);
CREATE TABLE public.server_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_id uuid, user_id uuid);
CREATE TABLE public.member_roles(member_id uuid,role_id uuid);
INSERT INTO public.server_categories(id,server_id,name,position) VALUES
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001','Personalizada',0),
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','Canais de texto',0);
INSERT INTO public.channels(id,server_id,name,type,category_id) VALUES
 ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','custom','voice','00000000-0000-0000-0000-000000000020'),
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','texto','text',NULL),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001','voz','voice',NULL);
