import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { normalizeOptions, agentRows, agentLabel, reconcileAgents, activeSessions } from './model.js';
import { MotionSurface, SELECTORS, decorateSidebar, clearSidebar, EASING } from './motion.js';
import css from './style.css';

export const name = 'lingdong';
export const inject = ['slots', 'uiSession', 'uiConversation'];
const h = React.createElement;
const STORAGE = 'dsh-lingdong.preferences.v1';

function preferences() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { saved = {}; }
  let value = normalizeOptions(saved);
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    update(patch) {
      value = normalizeOptions({ ...value, ...patch });
      try { localStorage.setItem(STORAGE, JSON.stringify(value)); } catch { /* private browsing */ }
      for (const callback of listeners) callback();
    },
  };
}

/** Every mutable resource belongs to this application of the Cordis plugin. */
export function apply(ctx) {
  const prefs = preferences();
  const docks = new Map();
  const surfaces = new Set();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const motionSource = {
    getSnapshot: () => media.matches,
    subscribe: callback => {
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
  };
  const usePrefs = () => useSyncExternalStore(prefs.subscribe, prefs.getSnapshot);
  const useReduced = () => useSyncExternalStore(motionSource.subscribe, motionSource.getSnapshot);

  function Orb({ row, reduced, root, onDone }) {
    const ref = useRef(null);
    const callback = useRef(onDone); callback.current = onDone;
    useEffect(() => {
      const element = ref.current;
      if (!element || !row.exiting) return;
      const animation = !reduced && element.animate?.([
        { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' },
        { opacity: 0, filter: 'blur(5px)', transform: 'translateY(-7px) scale(1.35)' },
      ], { duration: prefs.getSnapshot().dissolve, easing: EASING });
      let cancelled = false;
      const timer = setTimeout(() => { if (!cancelled) callback.current(row.id); }, reduced ? 0 : prefs.getSnapshot().dissolve);
      return () => { cancelled = true; clearTimeout(timer); animation?.cancel(); };
    }, [row.id, row.exiting, reduced]);
    useEffect(() => {
      const element = ref.current;
      if (!element || !row.fresh || reduced || !root) return;
      const candidates = [...root.querySelectorAll('[data-chat-flow-kind]')];
      const source = candidates.reverse().find(el => el.getAttribute('data-chat-flow-kind')?.startsWith('assistant'));
      if (!source || !element.animate) return;
      const from = source.getBoundingClientRect(), to = element.getBoundingClientRect();
      // Same emission curve; cap distance so an offscreen source cannot sweep the viewport.
      const dy = Math.max(-240, Math.min(240, from.top - to.top));
      const dx = Math.max(-400, Math.min(400, from.left + from.width / 2 - to.left - to.width / 2));
      const animation = element.animate([
        { opacity: .25, transform: `translate(${dx}px,${dy}px) scale(.4)` },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], { duration: prefs.getSnapshot().flight, easing: EASING });
      return () => animation.cancel();
    }, [row.id, reduced]);
    const label = agentLabel(row);
    return h('span', { className: 'ld-orb-wrap' },
      h('button', { ref, type: 'button', className: `ld-orb ld-${row.state}`,
        'aria-label': label, 'aria-describedby': `ld-tip-${row.id}` },
        h('i', { 'aria-hidden': true }), h('i', { 'aria-hidden': true }), h('i', { 'aria-hidden': true })),
      h('span', { id: `ld-tip-${row.id}`, className: 'ld-tooltip', role: 'tooltip' }, label));
  }

  function Dock(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions(state => state);
    const statuses = props.useSessionStatus(state => state);
    const marker = useRef(null), model = useRef(new Map()), initialized = useRef(false);
    const exitTimers = useRef(new Map());
    const [rows, setRows] = useState([]), [expanded, setExpanded] = useState(false), [settings, setSettings] = useState(false);
    useLayoutEffect(() => {
      const element = marker.current;
      docks.set(props.sessionId, element);
      return () => { if (docks.get(props.sessionId) === element) docks.delete(props.sessionId); };
    }, [props.sessionId]);
    useEffect(() => {
      model.current = new Map(); initialized.current = false; setRows([]);
      return () => { for (const timer of exitTimers.current.values()) clearTimeout(timer); exitTimers.current.clear(); };
    }, [props.sessionId]);
    useEffect(() => {
      model.current = reconcileAgents(model.current, agentRows(props.sessionId, list, statuses), initialized.current);
      initialized.current = true; setRows([...model.current.values()]);
    }, [props.sessionId, list, statuses]);
    function remove(id) {
      if (!model.current.get(id)?.exiting) return;
      model.current.delete(id); setRows([...model.current.values()]);
    }
    useEffect(() => {
      for (const [id, timer] of exitTimers.current) {
        if (!model.current.get(id)?.exiting) { clearTimeout(timer); exitTimers.current.delete(id); }
      }
      // Hidden aggregate members still finish their lifecycle without mounting an Orb.
      for (const row of rows) if (row.exiting && !exitTimers.current.has(row.id)) {
        exitTimers.current.set(row.id, setTimeout(() => {
          exitTimers.current.delete(row.id); remove(row.id);
        }, reduced ? 0 : options.dissolve));
      }
    }, [rows, reduced, options.dissolve]);
    const clipped = options.aggregate && !expanded && rows.length > options.maxOrbs;
    const displayed = clipped ? rows.slice(0, options.maxOrbs) : rows;
    const root = [...document.querySelectorAll(SELECTORS.conversation)]
      .find(el => el.dataset.conversationSession === props.sessionId);
    return h('div', { ref: marker, className: `ld-dock${reduced ? ' ld-reduced' : ''}`,
      'data-ld-session': props.sessionId, 'aria-label': '灵动对话状态区' },
      options.enabled && h('span', { className: 'ld-dock-line', 'aria-hidden': true }),
      options.enabled && h('div', { className: 'ld-orbs', 'aria-label': '子 agent 状态' },
        displayed.map(row => h(Orb, { key: row.id, row, reduced, root, onDone: remove })),
        clipped && h('button', { className: 'ld-stack', type: 'button', onClick: () => setExpanded(true),
          'aria-label': `展开其余 ${rows.length - options.maxOrbs} 个子 agent`, 'aria-expanded': false }, `+${rows.length - options.maxOrbs}`),
        expanded && rows.length > options.maxOrbs && h('button', { className: 'ld-stack', type: 'button', onClick: () => setExpanded(false), 'aria-expanded': true }, '收起')),
      h('button', { type: 'button', className: 'ld-settings-button', 'aria-label': '灵动动效设置',
        'aria-expanded': settings, onClick: () => setSettings(!settings) }, '◌'),
      settings && h('div', { className: 'ld-settings', onKeyDown: event => { if (event.key === 'Escape') setSettings(false); } },
        h('strong', null, '灵动'),
        ...[['enabled', '启用动效'], ['ambient', '背景氛围'], ['aggregate', '超过 4 个小球时折叠']].map(([key, label]) =>
          h('label', { key }, h('input', { type: 'checkbox', checked: options[key], onChange: event => prefs.update({ [key]: event.target.checked }) }), label)),
        h('small', null, reduced ? '系统已开启减少动态效果：使用静态状态。' : '状态来自 DSH；不额外调用模型。'),
        h('button', { type: 'button', onClick: () => setSettings(false) }, '关闭')));
  }

  function Surface(props) {
    const marker = useRef(null), surface = useRef(null), pendingIds = useRef(new Set());
    const options = usePrefs(), reduced = useReduced();
    const pending = props.useSession(state => state.pendingSubmissions);
    const error = props.useSession(state => state.promptError);
    useLayoutEffect(() => {
      pendingIds.current = new Set(pending.map(x => x.requestId));
      const root = marker.current?.closest(SELECTORS.conversation);
      if (!root || !options.enabled) return;
      const instance = new MotionSurface(root, options, reduced, () => docks.get(props.sessionId));
      surface.current = instance; surfaces.add(instance);
      return () => { instance.dispose(); surfaces.delete(instance); surface.current = null; };
    }, [props.sessionId, options, reduced]);
    useLayoutEffect(() => {
      const current = new Set(pending.map(x => x.requestId));
      for (const item of pending) if (!pendingIds.current.has(item.requestId)) surface.current?.submit(item);
      pendingIds.current = current;
    }, [pending]);
    useEffect(() => { if (error?.op === 'send') surface.current?.cancelFlight(); }, [error]);
    return h('span', { ref: marker, hidden: true, 'data-ld-observer': '' });
  }

  function Sidebar(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions(state => state), statuses = props.useSessionStatus(state => state);
    const state = useRef({ list, statuses, enabled: options.enabled });
    state.current = { list, statuses, enabled: options.enabled };
    useEffect(() => {
      let frame = 0;
      const update = () => {
        frame = 0;
        decorateSidebar(activeSessions(state.current.list, state.current.statuses), state.current.enabled);
      };
      const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(update); });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
      update();
      return () => { observer.disconnect(); cancelAnimationFrame(frame); clearSidebar(); };
    }, []);
    useEffect(() => { decorateSidebar(activeSessions(list, statuses), options.enabled); }, [list, statuses, options, reduced]);
    return null;
  }

  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-lingdong'; style.textContent = css; document.head.append(style);
    return () => {
      for (const surface of surfaces) surface.dispose();
      surfaces.clear(); docks.clear(); clearSidebar(); style.remove();
    };
  });
  // Fresh list ids add contributions; no official slot occupant is replaced.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'lingdong-dock', order: 20,
  }, Dock));
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay', id: 'lingdong-surface', order: 20,
  }, Surface));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'lingdong-sidebar', order: 20,
  }, Sidebar));
}
