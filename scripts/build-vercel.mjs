import { spawnSync } from 'node:child_process';

// Keep the web deployment target separate from the desktop's static shell.
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NITRO_PRESET: 'vercel', LOBBYX_DESKTOP: '0' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
