import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const reference = process.env.DSH_REFERENCE_ROOT;
if (!reference) throw new Error('Set DSH_REFERENCE_ROOT to the installed @deepseek-ai package directory for DSH 0.1.7-rc.2.');
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json')));
const load = async name => import(pathToFileURL(path.join(reference, name, 'lib/index.js')).href);
const { evaluatePluginCompatibility, bundlePatchPaths, loadOptionalPatches } = await load('dsh-app-boot');
assert.equal(evaluatePluginCompatibility(manifest, {}, '0.1.7-rc.2'), undefined);
assert.ok(evaluatePluginCompatibility(manifest, {}, '0.1.6'));
const paths = bundlePatchPaths(root, manifest.dsh.bundle);
assert.equal(paths.length, 1);
const patch = loadOptionalPatches('lingdong-test', paths[0]);
assert.equal(patch[0].insert[0].name, manifest.name);
console.log('PASS official bundle patch and runtime peer compatibility');

async function factory(file, globals = {}) {
  let registered;
  const sandbox = { window: { __ModuleLoader__: { load: item => registered = item } }, ...globals };
  vm.runInNewContext(await readFile(file, 'utf8'), sandbox);
  return registered.factory;
}
const modules = (await factory(path.join(reference, 'dsh-client-modules/lib/client.js')))();
const parsed = modules.parseDshClient(manifest.name, manifest.dsh.client);
assert.equal(parsed.platform, 'web');
for (const name of parsed.inject) {
  const installed = JSON.parse(await readFile(path.join(reference, name.split('/')[1], 'package.json')));
  assert.ok(installed.dsh.client); assert.ok(installed.exports['./client']);
}
console.log('PASS official client manifest parser and declared provider packages');

const { SlotCore } = await load('dsh-client-ui-slots');
const slots = new SlotCore();
const slotNames = ['conversation.session.header.actions', 'conversation.input.overlay', 'shell.overlay'];
const ownerOff = slots.register({ name: 'root', children: Object.fromEntries(slotNames.map(name => [name,
  { kind: 'list', scope: name === 'shell.overlay' ? 'root' : 'session' }])) }, () => null);
let styles = 0; const effects = [];
const document = {
  createElement: () => ({ dataset: {}, remove: () => styles-- }),
  head: { append: () => styles++ }, querySelectorAll: () => [],
};
const getPlugin = await factory(path.join(root, 'lib/client.js'), {
  document, localStorage: { getItem: () => null },
  matchMedia: () => ({ matches: false }),
});
const plugin = getPlugin(id => { assert.equal(id, 'react'); return {}; });
const ctx = {
  effect(fn) { effects.push(fn()); },
  slots: {
    inject(name, fn) { assert.ok(slotNames.includes(name)); return fn(); },
    register(options, component) { const off = slots.register(options, component); effects.push(off); return off; },
  },
};
for (let n = 0; n < 2; n++) {
  plugin.apply(ctx);
  for (const name of slotNames) assert.equal(slots.entries(name).length, 1);
  assert.equal(styles, 1);
  for (const off of effects.splice(0).reverse()) off();
  for (const name of slotNames) assert.equal(slots.entries(name).length, 0);
  assert.equal(styles, 0);
}
ownerOff();
console.log('PASS official SlotCore registration, disposal and re-enable');
