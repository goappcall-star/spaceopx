import { spawnSync } from 'node:child_process';
import { cp, mkdir, access, writeFile } from 'node:fs/promises';
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit', env: { ...process.env, LOBBYX_DESKTOP: '1' } });
if (result.status !== 0) process.exit(result.status ?? 1);
await access('.output/public/_shell.html');
await mkdir('desktop/web', { recursive: true });
await cp('.output/public', 'desktop/web', { recursive: true });
await writeFile('desktop/package.json', JSON.stringify({ name: 'lobbyx-desktop', version: '0.1.10', description: 'LobbyX para Windows', author: 'LobbyX', main: 'main.cjs' }, null, 2));
