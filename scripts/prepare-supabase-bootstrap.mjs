import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
const header = `-- LobbyX: instalacao em um projeto Supabase VAZIO.
-- Destino previsto: txkwmarzcyfbkizphjww. Confira o projeto no painel.
-- Execute todo o arquivo no SQL Editor. Nao executar no backend do Lovable.
-- Nao copia contas ou dados antigos e nao configura provedores OAuth.
BEGIN;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public')
 OR EXISTS (SELECT 1 FROM auth.users)
 OR EXISTS (SELECT 1 FROM storage.buckets) THEN
  RAISE EXCEPTION 'Projeto nao esta vazio. Instalacao interrompida sem alterar dados.';
 END IF;
END;
$guard$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
`;
let output = header;
for (const file of files) {
 const sql = (await readFile(new URL(file,dir),'utf8')).replace(/^\uFEFF/,'').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,'');
 output += `\n-- MIGRATION: ${file}\n${sql}\n`;
}
output += `
-- Buckets privados; acesso controlado pelas politicas criadas acima.
INSERT INTO storage.buckets (id, name, public) VALUES
 ('avatars','avatars',false), ('banners','banners',false),
 ('attachments','attachments',false), ('dm-attachments','dm-attachments',false),
 ('game-assets','game-assets',false), ('server-assets','server-assets',false);
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'Estrutura LobbyX criada com sucesso' AS resultado,
 (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tabelas,
 (SELECT count(*) FROM storage.buckets) AS buckets;
`;
const destination = new URL('../../outputs/migracao-supabase/',import.meta.url);
await mkdir(destination,{recursive:true});
await writeFile(new URL('01-criar-banco-lobbyx.sql',destination),output);
console.log(`Generated ${files.length} migrations, ${Buffer.byteLength(output)} bytes.`);
