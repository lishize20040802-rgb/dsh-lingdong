import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeOptions, agentRows, taskRows, orbitRows, reconcileAgents, activeSessions, agentLabel } from '../src/model.js';

test('preferences validate corrupt storage and bound timings', () => {
  assert.equal(normalizeOptions(null).enabled, true);
  const prefs = normalizeOptions({ enabled: 'false', flight: -99, settle: 9000, hold: NaN, maxQueue: 1e9 });
  assert.equal(prefs.enabled, true); assert.equal(prefs.flight, 80);
  assert.equal(prefs.settle, 4000); assert.equal(prefs.gather, 580); assert.equal(prefs.maxQueue, 3);
});
const list = {
  byId: { child: { running: true, displayTitle: '检索', projectionValues: { subagentTiming: { lastTurnCompleted: true } } } },
  projectionsBySession: { parent: { values: { subagentCatalog: [{ id: 'child', label: '分析' }] } } },
};
test('unified status overrides stale summaries; active beats old completion', () => {
  assert.equal(agentRows('parent', list, new Map())[0].state, 'working');
  assert.equal(agentRows('parent', list, new Map([['child', { running: false }]]))[0].state, 'completed');
  assert.equal(agentRows('other', list, new Map()).length, 0);
});
test('does not invent numerical progress or error activity', () => {
  const row = agentRows('parent', { ...list, byId: {} }, new Map())[0];
  assert.equal(row.state, 'queued'); assert.match(agentLabel(row), /等待状态同步/);
  assert.doesNotMatch(agentLabel(row), /\d+%/);
});
test('completed history does not replay; only observed completion dissolves', () => {
  const completed = { id: 'c', state: 'completed' };
  assert.equal(reconcileAgents(new Map(), [completed], false).size, 0);
  const live = reconcileAgents(new Map(), [{ id: 'c', state: 'working' }], false);
  const next = reconcileAgents(live, [completed], true);
  assert.equal(next.get('c').exiting, true);
  assert.equal(reconcileAgents(next, [completed], true).get('c'), next.get('c'));
  assert.equal(reconcileAgents(new Map(), [completed], true).size, 0);
});
test('new children emit and continuable children can resume', () => {
  assert.equal(reconcileAgents(new Map(), [{ id: 'c', state: 'working' }], true).get('c').fresh, true);
  const next = reconcileAgents(new Map([['c', { state: 'completed', exiting: true }]]), [{ id: 'c', state: 'working' }], true);
  assert.equal(next.get('c').exiting, undefined);
});
test('activity propagates to unopened ancestors without looping on bad catalogs', () => {
  const active = activeSessions({ ...list, projectionsBySession: {
    ...list.projectionsBySession,
    ancestor: { values: { subagentCatalog: [{ id: 'parent' }] } },
    loop: { values: { subagentCatalog: [{ id: 'loop' }] } },
  } }, new Map());
  assert.deepEqual([...active].sort(), ['ancestor', 'child', 'parent']);
});
test('bundle is lazy CJS and requests only the shared React module', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  let registration;
  const sandbox = { window: { __ModuleLoader__: { load: entry => registration = entry } } };
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  assert.equal(registration.id, manifest.name);
  const requests = [];
  const exports = registration.factory(id => { requests.push(id); return { createElement() {} }; });
  assert.deepEqual(requests, ['react']); assert.equal(typeof exports.apply, 'function');
  assert.deepEqual(Array.from(exports.inject), ['slots', 'uiSession', 'uiConversation', 'jobs']);
  assert.equal(manifest.dsh.manifestVersion, 1);
  assert.equal(manifest.engines.dsh, '0.1.7-rc.2');
  assert.match(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), /name: dsh-lingdong/);
});

test('jobs coexist with continuable agents and terminal reasons stay truthful', () => {
  const jobs = [{id:'subagent-1',kind:'subagent',owner:'parent',label:'检索',status:'running'},
    {id:'bash-2',kind:'bash',label:'编译',status:'failed',detail:'exit code: 1'}];
  const rows = taskRows('parent', list, new Map(), jobs);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(row => row.id)).size, 3);
  assert.match(agentLabel(rows[2]), /失败.*exit code: 1/);
  assert.equal(activeSessions({byId:{}}, new Map(), {parent:jobs}).has('parent'), true);
  assert.equal(activeSessions({byId:{}}, new Map(), {parent:[jobs[1]]}).size, 0);
});

test('orb groups cap four or more tasks at three without losing task identities', () => {
  for (const count of [0, 1, 2, 3, 4, 6, 20]) {
    const rows = Array.from({length:count}, (_, i) => ({id:String(i),title:`任务 ${i}`,state:i%2 ? 'queued' : 'working'}));
    const visible = orbitRows(rows);
    assert.equal(visible.length, Math.min(3, count));
    const represented = visible.flatMap(row => row.members ?? [row]);
    assert.deepEqual(represented.map(row => row.id).sort(), rows.map(row => row.id).sort());
  }
});
