import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useId } from 'react';
import { normalizeOptions, taskRows, orbitRows, agentLabel, reconcileAgents, activeSessions } from './model.js';
import { MotionSurface, SELECTORS, SidebarObserver, clearSidebar, EASING } from './motion.js';
import css from './style.css';

export const name = 'lingdong';
export const inject = ['slots', 'uiSession', 'uiConversation', 'jobs'];
const h = React.createElement;
const STORAGE = 'dsh-lingdong.preferences.v3';
const EMPTY_JOBS = Object.freeze([]);

function preferences() {
  let saved;
  try {
    const stored = localStorage.getItem(STORAGE);
    saved = JSON.parse(stored || '{}');
    if (!stored) {
      const old = JSON.parse(localStorage.getItem('dsh-lingdong.preferences.v2') || localStorage.getItem('dsh-lingdong.preferences.v1') || '{}');
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
    const label = agentLabel(row);
    return h('span', { className: 'ld-orb-wrap' },
      h('button', { ref, type: 'button', className: `ld-orb ld-${row.state}`,
        'aria-label': label, 'aria-describedby': `ld-tip-${row.id}` },
        ...Array.from({ length: 5 }, (_, index) => h('i', { key: index, 'aria-hidden': true }))),
      h('span', { id: `ld-tip-${row.id}`, className: 'ld-tooltip', role: 'tooltip' }, label));
  }

  function Dock(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions(state => state);
    const statuses = props.useSessionStatus(state => state);
    const jobs = props.useJobs(state => state.rows[props.sessionId]) ?? EMPTY_JOBS;
    useEffect(() => options.enabled ? props.watchRows(props.sessionId) : undefined, [props.sessionId, options.enabled]);
    const marker = useRef(null), model = useRef(new Map()), initialized = useRef(false);
    const exitTimers = useRef(new Map());
    const announced = useRef(new Set());
    const settingsRef = useRef(null), settingsTrigger = useRef(null);
    const dialogId = useId(), orbsId = useId();
    const paused = useSyncExternalStore(visibilitySource.subscribe, visibilitySource.getSnapshot);
    const [rows, setRows] = useState([]), [expanded, setExpanded] = useState(false), [settings, setSettings] = useState(false);
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
      model.current = new Map(); initialized.current = false; announced.current.clear(); setRows([]);
      return () => { for (const timer of exitTimers.current.values()) clearTimeout(timer); exitTimers.current.clear(); };
    }, [props.sessionId]);
    useEffect(() => {
      model.current = reconcileAgents(model.current, taskRows(props.sessionId, list, statuses, jobs), initialized.current);
      initialized.current = true; setRows([...model.current.values()]);
    }, [props.sessionId, list, statuses, jobs]);
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
    const displayed = orbitRows(rows);
    const root = [...document.querySelectorAll(SELECTORS.conversation)]
      .find(el => el.dataset.conversationSession === props.sessionId);
    useEffect(() => {
      const live = new Set(rows.map(row => row.id));
      for (const id of announced.current) if (!live.has(id)) announced.current.delete(id);
      const destinations = new Set();
      rows.forEach((row, index) => {
        if (announced.current.has(row.id)) return;
        announced.current.add(row.id);
        if (row.fresh && !row.exiting) destinations.add(rows.length >= 4 ? index % 3 : index);
      });
      if (!options.enabled || reduced || !root) return;
      const surface = [...surfaces].find(value => value.root === root);
      const elements = marker.current?.querySelectorAll('.ld-orb');
      for (const index of destinations) if (elements?.[index]) surface?.emitTask(elements[index]);
    }, [rows, root, options.enabled, reduced]);
    const catalog = list.projectionsBySession?.[props.sessionId]?.values?.subagentCatalog
      ?? list.byId?.[props.sessionId]?.projectionValues?.subagentCatalog;
    return h('div', { ref: marker, className: `ld-dock${reduced ? ' ld-reduced' : ''}${paused ? ' ld-paused' : ''}`,
      'data-ld-session': props.sessionId, 'aria-label': '灵动对话状态区' },
      options.enabled && h('span', { className: `ld-dock-line${rows.some(row => row.state === 'working') ? ' ld-live' : ''}`, 'aria-hidden': true }),
      options.enabled && h('div', { id: orbsId, className: `ld-orbs ld-orbits-${displayed.length}`, 'aria-label': '后台任务与子代理状态' },
        displayed.map(row => h(Orb, { key: row.id, row, reduced, root, onDone: remove }))),
      options.enabled && rows.length >= 4 && h('button', { className: 'ld-stack', type: 'button', onClick: () => setExpanded(!expanded),
        'aria-controls': `${orbsId}-tasks`, 'aria-label': expanded ? '收起任务列表' : `查看全部 ${rows.length} 个任务`,
        'aria-expanded': expanded }, `${rows.length} 项`),
      options.enabled && expanded && rows.length >= 4 && h('div', { id: `${orbsId}-tasks`, className: 'ld-task-list', role: 'region', 'aria-label': '全部任务状态' },
        h('strong', null, `${rows.length} 个任务 · 3 个动态状态球`),
        h('ul', null, rows.map(row => h('li', { key: row.id }, agentLabel(row))))),
      h('button', { ref: settingsTrigger, type: 'button', className: 'ld-settings-button', title: '灵动动效设置', 'aria-label': '灵动动效设置',
        'aria-haspopup': 'dialog', 'aria-controls': dialogId, 'aria-expanded': settings, onClick: () => setSettings(!settings) }, '◌'),
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
        h('small', null, '双球相互环绕；三球交错运行；4 个及以上任务由 3 个球代表，可展开查看全部任务。'),
        h('small', { className: 'ld-catalog-status' }, catalog === undefined ? '当前会话的子 agent 目录尚未就绪。'
          : `当前会话：${catalog.length} 个子 agent，${rows.filter(row => row.state === 'working').length} 个运行中。`),
        h('small', null, `已接入后台任务列表：${jobs.length} 项；完成、失败与停止均按真实状态显示。`),
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
    const jobs = props.useJobs(state => state.rows);
    const active = useMemo(() => activeSessions(list, statuses, jobs), [list, statuses, jobs]);
    const observer = useRef(null);
    useEffect(() => {
      const instance = new SidebarObserver(props.watchRows); observer.current = instance;
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
      surfaces.clear(); docks.clear(); clearSidebar(); style.remove();
    };
  });
  // Fresh list ids add contributions; no official slot occupant is replaced.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'lingdong-dock', order: 20,
    inject: () => ({ hooks: { jobs: ctx.jobs.state }, watchRows: id => ctx.jobs.watchRows(id) }),
  }, Dock));
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay', id: 'lingdong-surface', order: 20,
  }, Surface));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'lingdong-sidebar', order: 20,
    inject: () => ({ hooks: { jobs: ctx.jobs.state }, watchRows: id => ctx.jobs.watchRows(id) }),
  }, Sidebar));
}
