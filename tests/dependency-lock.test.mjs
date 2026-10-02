import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

test('All TanStack Start copies include the GHSA-qx66-fv34-fjm8 fix', () => {
  const minimum = { '@tanstack/react-start': [1, 168, 60], '@tanstack/start-server-core': [1, 169, 39] };
  for (const [name, floor] of Object.entries(minimum)) {
    const copies = Object.entries(lock.packages).filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`));
    assert.ok(copies.length > 0, name);
    for (const [path, entry] of copies) {
      const actual = entry.version.split('.').map(Number);
      const delta = actual.map((part, i) => part - floor[i]).find((difference) => difference !== 0) ?? 0;
      assert.ok(delta >= 0, `${path}@${entry.version} is below the patched release`);
    }
  }
});

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
