import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
const registrations = new Map(), disposers = [];
const state = {
  jobs: { rows: {} }, watches: 0, sessionId: 'parent', session: { pendingSubmissions: [], promptError: null },
  list: { byId: {}, projectionsBySession: { parent: { values: { subagentCatalog: [] } } } }, statuses: new Map(),
};
let revision = 0; const subscribers = new Set();
const subscribe = cb => { subscribers.add(cb); return () => subscribers.delete(cb); };
const emit = () => { revision++; for (const cb of subscribers) cb(); };
window.__ModuleLoader__ = { load: entry => {
  const plugin = entry.factory(id => { if (id === 'react') return React; throw new Error(`Unexpected external: ${id}`); });
  window.mount = () => {
    plugin.apply({
      jobs: { state: {getSnapshot: () => state.jobs, subscribe}, watchRows: () => { state.watches++; return () => state.watches--; } },
      effect: factory => { const dispose = factory(); disposers.push(dispose); return dispose; },
      slots: { inject: (_name, fn) => fn(), register: (spec, Component) => {
        const injected = spec.inject?.();
        registrations.set(spec.name, props => <Component {...props} watchRows={injected?.watchRows}/>);
        return () => registrations.delete(spec.name);
      } },
    }); emit();
  };
  window.mount();
} };
const hooks = {
  useJobs: select => { useSyncExternalStore(subscribe, () => revision); return select(state.jobs); },
  useSessions: select => { useSyncExternalStore(subscribe, () => revision); return select(state.list); },
  useSessionStatus: select => { useSyncExternalStore(subscribe, () => revision); return select(state.statuses); },
  useSession: select => { useSyncExternalStore(subscribe, () => revision); return select(state.session); },
};
function Slot({ name }) {
  const Component = registrations.get(name);
  return Component ? <Component key={state.sessionId} {...hooks} sessionId={state.sessionId}/> : null;
}
function App() {
  useSyncExternalStore(subscribe, () => revision);
  return <><aside><b>DeepSeek Harness</b><small>灵动 · 桌面适配测试</small>
    {['parent','other','third','fourth','fifth'].map((id, i) => <div key={id} data-row-key={`session:${id}`} role="treeitem" aria-selected={id === state.sessionId}><span>◌</span><span>{['设计动效语言','资料整理','交互探索','代码审阅','后台任务'][i]}</span><span>刚刚</span></div>)}
    </aside><main><header><span>设计动效语言</span><Slot name="conversation.session.header.actions"/></header>
    <div data-conversation-content="" data-conversation-session={state.sessionId} key={state.sessionId}>
      <div id="messages"><div data-chat-flow-kind="assistant-step"><p>让动作有意义，让界面安静地流动。</p></div></div>
      <div data-composer-seat=""><div data-composer-input="true" role="textbox" contentEditable suppressContentEditableWarning>帮我梳理这个想法</div><Slot name="conversation.input.overlay"/></div>
    </div></main><Slot name="shell.overlay"/></>;
}
const root = createRoot(document.getElementById('app')); root.render(<App/>);
window.fixture = {
  confirm() {
    const before = document.querySelector('#messages [data-chat-flow-kind="user"]:last-child');
    if (before) before.replaceWith(before.cloneNode(true));
  },
  watches: () => state.watches,
  jobs(rows) { state.jobs = { rows: { parent: rows } }; emit(); },
  send(text = '这是一条新消息', placement = 'transcript') {
    const id = `rpc-${Date.now()}-${Math.random()}`;
    const row = document.createElement('div'); row.dataset.chatFlowKind = 'user'; row.textContent = text;
    document.querySelector('#messages').append(row);
    state.session = { ...state.session, pendingSubmissions: [...state.session.pendingSubmissions, { requestId: id, text, placement, time: Date.now() }] }; emit();
  },
  fail() { state.session = { pendingSubmissions: [], promptError: { op: 'send', error: {} } }; emit(); },
  stream() {
    const row = document.createElement('div'); row.dataset.chatFlowKind = 'assistant-step';
    row.innerHTML = '<div data-streaming="true"><div><p id="ink">文字像墨水一样聚拢。</p><pre id="code"><code>const motion = "quiet";</code></pre><ul id="list"><li>结构化内容保持完整</li></ul></div></div>';
    document.querySelector('#messages').append(row);
  },
  append() { document.querySelector('#ink').append(' 新的流式内容。'); },
  agents(count = 6) {
    const rows = Array.from({ length: count }, (_, n) => ({ id: `agent-${n}`, label: `资料分析 ${n + 1}` }));
    state.list = { byId: Object.fromEntries(rows.map(row => [row.id, { running: true }])),
      projectionsBySession: { parent: { values: { subagentCatalog: rows } } } };
    state.statuses = new Map(['other','third','fourth','fifth',...rows.map(x => x.id)].map(id => [id, { running: true }])); emit();
  },
  complete() {
    state.list = { ...state.list, byId: Object.fromEntries(Object.keys(state.list.byId).map(id => [id, { running: false, projectionValues: { subagentTiming: { lastTurnCompleted: true } } }])) };
    state.statuses = new Map(); emit();
  },
  switchSession() { state.sessionId = state.sessionId === 'parent' ? 'other' : 'parent'; state.session = { pendingSubmissions: [], promptError: null }; emit(); },
  unmount() { registrations.clear(); emit(); for (const dispose of disposers.splice(0).reverse()) dispose?.(); },
};
