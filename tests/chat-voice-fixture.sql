BEGIN;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated;
CREATE FUNCTION test_id(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT lpad(n::text,32,'0')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,username text,display_name text);
CREATE TABLE servers(id uuid PRIMARY KEY,owner_id uuid);
CREATE TABLE channels(id uuid PRIMARY KEY,server_id uuid,name text,type text);
CREATE TABLE server_members(id uuid PRIMARY KEY,server_id uuid,user_id uuid);
CREATE TABLE roles(id uuid PRIMARY KEY,permissions jsonb);
CREATE TABLE member_roles(member_id uuid,role_id uuid);
CREATE TABLE messages(id uuid PRIMARY KEY,channel_id uuid,author_id uuid,content text,mentions uuid[]);
CREATE FUNCTION is_server_owner(s uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM servers WHERE id=s AND owner_id=u) $$;
CREATE PUBLICATION supabase_realtime;
CREATE OR REPLACE FUNCTION public.has_channel_permission(_channel_id uuid, _user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.server_members sm ON sm.server_id = c.server_id AND sm.user_id = _user_id
    LEFT JOIN public.member_roles mr ON mr.member_id = sm.id
    LEFT JOIN public.roles r ON r.id = mr.role_id
    WHERE c.id = _channel_id
      AND (
        public.is_server_owner(c.server_id, _user_id)
        OR COALESCE((r.permissions->>'administrator')::boolean, false)
        OR COALESCE((r.permissions->>'manage_server')::boolean, false)
        OR COALESCE((r.permissions->>_perm)::boolean, false)
        -- baseline permissions every member has unless explicitly revoked
        OR (_perm IN ('view_channel','send_messages','connect','speak')
            AND COALESCE((r.permissions->>_perm)::boolean, true))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_server_permission(_server_id uuid, _user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_server_owner(_server_id, _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.server_members m
      JOIN public.member_roles mr ON mr.member_id = m.id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE m.server_id = _server_id
        AND m.user_id = _user_id
        AND (
          COALESCE((r.permissions->>'administrator')::boolean, false)
          OR COALESCE((r.permissions->>_perm)::boolean, false)
        )
    );
$$;

