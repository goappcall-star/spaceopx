import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

test('Every locked package has a version, including optional platform packages', () => {
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name || entry.link) continue;
    assert.match(entry.version ?? '', /^\d+\.\d+\.\d+(?:[-+].*)?$/, name);
  }
});

test('The lock includes Linux build bindings and matches the root manifest', () => {
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  for (const name of ['@tailwindcss/oxide-linux-x64-gnu', '@rolldown/binding-linux-x64-gnu']) {
    assert.ok(Object.keys(lock.packages).some((path) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`), name);
  }
});
