import { spawnSync } from 'node:child_process';
import { cp, mkdir, access, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { supabaseBuildEnv } from '../scripts/supabase-build-env.mjs';
const env = supabaseBuildEnv({ ...loadEnv('production', process.cwd(), ''), ...process.env });
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit', env: { ...env, LOBBYX_DESKTOP: '1' } });
if (result.status !== 0) process.exit(result.status ?? 1);
await access('.output/public/_shell.html');
// Remove only generated web assets so old backend bundles are not packaged.
const generatedWeb = path.resolve('desktop/web');
const expectedWeb = fileURLToPath(new URL('./web', import.meta.url));
if (generatedWeb !== expectedWeb) throw new Error('Unexpected desktop web directory');
await rm(generatedWeb, { recursive: true, force: true });
await mkdir('desktop/web', { recursive: true });
await cp('.output/public', 'desktop/web', { recursive: true });
await writeFile('desktop/package.json', JSON.stringify({ name: 'lobbyx-desktop', version: '0.1.19', description: 'LobbyX para Windows', author: 'LobbyX', main: 'main.cjs' }, null, 2));
