import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useId } from 'react';
import { normalizeOptions, agentRows, assignColors, AGENT_COLORS, agentLabel, reconcileAgents, activeSessions } from './model.js';
import { MotionSurface, SELECTORS, SidebarObserver, clearSidebar, EASING } from './motion.js';
import css from './style.css';

export const name = 'lingdong';
export const inject = ['slots', 'uiSession', 'uiConversation'];
const h = React.createElement;
const STORAGE = 'dsh-lingdong.preferences.v4';


function preferences() {
  let saved;
  try {
    const stored = localStorage.getItem(STORAGE);
    saved = JSON.parse(stored || '{}');
    if (!stored) {
      const old = JSON.parse(localStorage.getItem('dsh-lingdong.preferences.v3') || localStorage.getItem('dsh-lingdong.preferences.v2') || localStorage.getItem('dsh-lingdong.preferences.v1') || '{}');
      saved = { enabled: old?.enabled, ambient: old?.ambient, aggregate: old?.aggregate };
    }
  } catch { saved = {}; }
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
  const sessionColors = new Map();
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
  const visibilitySource = {
    getSnapshot: () => document.hidden,
    subscribe: callback => {
      document.addEventListener('visibilitychange', callback);
      return () => document.removeEventListener('visibilitychange', callback);
    },
  };

  function Orb({ row, color, index, active, rank, reduced }) {
    const wrap = useRef(null);
    useLayoutEffect(() => {
      const element = wrap.current;
      if (!element || !row?.exiting || reduced) return;
      // Keep the running orbit until this layout effect captures its current position.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const home = (index - 1) * 20;
      element.style.animation = 'none';
      const animation = element.animate([
        { transform: `translate(${matrix.m41}px,${matrix.m42}px)` },
        { transform: `translate(${(matrix.m41 + home) / 2}px,${matrix.m42 - 9}px)`, offset: .56 },
        { transform: `translate(${home}px,0px)` },
      ], { duration: prefs.getSnapshot().dissolve, easing: EASING, fill: 'forwards' });
      return () => { animation.cancel(); element.style.animation = ''; };
    }, [row?.id, row?.exiting, reduced]);
    return h('span', { ref: wrap, className: 'ld-orb-wrap', 'data-ld-active': String(active),
      style: { '--ld-color': color, '--ld-home-x': `${(index - 1) * 20}px`, '--ld-orbit-delay': `${-rank * 2.8}s` },
      title: row ? agentLabel(row) : '空闲' },
      h('span', { className: `ld-orb ld-${row?.state ?? 'idle'}`, 'data-agent-id': row?.id ?? '', 'aria-hidden': true },
        h('span', { className: 'ld-orb-body' }),
        ...Array.from({ length: 3 }, (_, index) => h('i', { key: index }))));
  }

  function Dock(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions(state => state);
    const statuses = props.useSessionStatus(state => state);
    const capsuleRef = useRef(null);
    const marker = useRef(null), model = useRef(new Map()), initialized = useRef(false);
    const exitTimers = useRef(new Map());
    const settingsRef = useRef(null), settingsTrigger = useRef(null);
    const dialogId = useId(), orbsId = useId();
    const paused = useSyncExternalStore(visibilitySource.subscribe, visibilitySource.getSnapshot);
    const [rows, setRows] = useState([]), [expanded, setExpanded] = useState(false), [settings, setSettings] = useState(false);
    useEffect(() => {
      if (!expanded || settings) return;
      const close = event => {
        if (event.type === 'keydown' && event.key !== 'Escape') return;
        if (event.type === 'pointerdown' && marker.current?.contains(event.target)) return;
        setExpanded(false);
        if (event.type === 'keydown') capsuleRef.current?.focus();
      };
      document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
      return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
    }, [expanded, settings]);
    useLayoutEffect(() => {
      const dialog = settingsRef.current, trigger = settingsTrigger.current;
      if (!settings || !dialog) return;
      // Native top-layer dialog owns focus containment, Escape and inert background.
      dialog.showModal(); dialog.querySelector('input')?.focus();
      return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
    }, [settings]);
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
      initialized.current = true;
      const all = [...model.current.values()];
      const colors = assignColors(all, sessionColors.get(props.sessionId));
      // Preserve assigned colors when a session is temporarily unmounted or a child completes.
      const cache = sessionColors.get(props.sessionId) ?? new Map();
      for (const [id, color] of colors) cache.set(id, color);
      sessionColors.set(props.sessionId, cache);
      for (const row of all) row.color = colors.get(row.id);
      setRows(all);
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
    const displayed = AGENT_COLORS.map(color => rows.find(row => row.color === color && row.state === 'working')
      ?? rows.find(row => row.color === color && row.exiting)
      ?? rows.find(row => row.color === color) ?? null);
    const activeColors = displayed.map((row, index) => row && (row.state === 'working' || row.exiting) ? index : -1).filter(index => index >= 0);
    const catalog = list.projectionsBySession?.[props.sessionId]?.values?.subagentCatalog
      ?? list.byId?.[props.sessionId]?.projectionValues?.subagentCatalog;
    return h('div', { ref: marker, className: `ld-dock${reduced ? ' ld-reduced' : ''}${paused ? ' ld-paused' : ''}`,
      'data-ld-session': props.sessionId, 'aria-label': '灵动对话状态区' },
      h('button', { ref: capsuleRef, type: 'button', className: 'ld-capsule',
        'aria-label': options.enabled && rows.length ? `查看 ${rows.length} 个子 Agent` : '灵动：查看子 Agent',
        'aria-controls': `${orbsId}-tasks`, 'aria-expanded': expanded,
        onClick: () => setExpanded(!expanded) },
        options.enabled && h('span', { id: orbsId, className: `ld-orbs ld-orbits-${activeColors.length}`, 'aria-hidden': true },
          displayed.map((row, index) => h(Orb, { key: AGENT_COLORS[index], row, color: AGENT_COLORS[index], index,
            active: activeColors.includes(index), rank: activeColors.indexOf(index), reduced })))),
      expanded && h('div', { id: `${orbsId}-tasks`, className: 'ld-task-list', role: 'region', 'aria-label': '子 Agent 状态' },
        h('strong', null, `${rows.length} 个子 Agent`),
        rows.length ? h('ul', null, rows.map(row => h('li', { key: row.id },
          h('span', { className: 'ld-identity', style: { background: row.color }, 'aria-hidden': true }), agentLabel(row))))
          : h('p', null, '当前没有子 Agent'),
        h('button', { ref: settingsTrigger, type: 'button', className: 'ld-settings-button', 'aria-haspopup': 'dialog',
          'aria-controls': dialogId, 'aria-expanded': settings, onClick: () => setSettings(true) }, '灵动动效设置')),
      settings && h('dialog', { ref: settingsRef, id: dialogId, className: 'ld-settings', 'aria-labelledby': `${dialogId}-title`,
        onCancel: event => { event.preventDefault(); setSettings(false); },
        onClick: event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSettings(false);
        } },
        h('strong', { id: `${dialogId}-title` }, '灵动动效设置'),
        ...[['enabled', '启用动效'], ['ambient', '背景氛围']].map(([key, label]) =>
          h('label', { key }, h('input', { type: 'checkbox', checked: options[key], onChange: event => prefs.update({ [key]: event.target.checked }) }), label)),
        h('small', null, reduced ? '系统已开启减少动态效果：使用静态状态。' : '状态来自 DSH；不额外调用模型。'),
        h('small', null, '双球相互环绕；三球交错运行；4 个及以上子 Agent 显示 3 个代表球，点击胶囊查看完整列表。'),
        h('small', { className: 'ld-catalog-status' }, catalog === undefined ? '当前会话的子 agent 目录尚未就绪。'
          : `当前会话：${catalog.length} 个子 agent，${rows.filter(row => row.state === 'working').length} 个运行中。`),
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
    const options = usePrefs();
    const list = props.useSessions(state => state), statuses = props.useSessionStatus(state => state);
    const active = useMemo(() => activeSessions(list, statuses), [list, statuses]);
    const observer = useRef(null);
    useEffect(() => {
      const instance = new SidebarObserver(); observer.current = instance;
      return () => { instance.dispose(); observer.current = null; };
    }, []);
    useEffect(() => { observer.current?.set(active, options.enabled); }, [active, options.enabled]);
    return null;
  }

  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-lingdong'; style.textContent = css; document.head.append(style);
    return () => {
      for (const surface of surfaces) surface.dispose();
      surfaces.clear(); docks.clear(); sessionColors.clear(); clearSidebar(); style.remove();
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
