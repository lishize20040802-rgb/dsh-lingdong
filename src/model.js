export const DEFAULTS = Object.freeze({
  enabled: true, ambient: true, aggregate: true,
  flight: 1850, gather: 580, settle: 900, taskFlight: 2200, reveal: 420, dissolve: 550,
  breathing: 4200, ambientPeriod: 24000, maxOrbs: 4, maxQueue: 3,
});

export function normalizeOptions(input = {}) {
  const result = { ...DEFAULTS };
  for (const key of ['enabled', 'ambient', 'aggregate']) {
    if (typeof input?.[key] === 'boolean') result[key] = input[key];
  }
  for (const key of ['flight', 'gather', 'settle', 'taskFlight', 'reveal', 'dissolve']) {
    if (Number.isFinite(input?.[key])) result[key] = Math.max(80, Math.min(4000, input[key]));
  }
  return result;
}

/** Host facts only; no fabricated percent-complete or inference from text. */
export function agentRows(sessionId, list, statuses) {
  const catalog = list.projectionsBySession?.[sessionId]?.values?.subagentCatalog
    ?? list.byId?.[sessionId]?.projectionValues?.subagentCatalog ?? [];
  return catalog.map(entry => {
    const summary = list.byId?.[entry.id];
    const timing = list.projectionsBySession?.[entry.id]?.values?.subagentTiming
      ?? summary?.projectionValues?.subagentTiming;
    const running = statuses.get(entry.id)?.running ?? summary?.running;
    const state = running === true ? 'working'
      : timing?.lastTurnCompleted === true ? 'completed' : 'queued';
    return { id: entry.id, title: entry.label || summary?.displayTitle || entry.id,
      state, timing, inactive: running === false && timing?.lastTurnCompleted !== true };
  });
}

export function activeSessions(list, statuses, jobsBySession = {}) {
  const active = new Set();
  for (const [id, row] of Object.entries(list.byId ?? {})) {
    if ((statuses.get(id)?.running ?? row.running) === true) active.add(id);
  }
  for (const [id, status] of statuses) if (status.running === true) active.add(id);
  for (const [id, jobs] of Object.entries(jobsBySession)) {
    if (jobs.some(job => job.owner === id && (job.status === 'running' || job.status === 'stopping'))) active.add(id);
  }
  // Propagate activity through catalog ancestry, including unopened parent rows.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, projection] of Object.entries(list.projectionsBySession ?? {})) {
      if (!active.has(id) && projection.values?.subagentCatalog?.some(x => active.has(x.id))) {
        active.add(id); changed = true;
      }
    }
  }
  return active;
}

/** Retain only live completion transitions; opening history never replays fireworks. */
export function reconcileAgents(previous, incoming, initialized) {
  const next = new Map();
  for (const row of incoming) {
    const before = previous.get(row.id);
    if (row.state === 'completed') {
      if (before && before.state !== 'completed') next.set(row.id, { ...row, exiting: true });
      else if (before?.exiting) next.set(row.id, before);
    } else next.set(row.id, { ...row, fresh: initialized && !before });
  }
  return next;
}

export function agentLabel(row) {
  if (row.statusText) return `${row.title} · ${row.statusText}${row.progress ? ` · ${row.progress}` : ''}`;
  if (row.state === 'completed') return `${row.title} · 已完成`;
  if (row.state === 'working') return `${row.title} · 工作中（未提供百分比进度）`;
  return `${row.title} · ${row.inactive ? '当前未运行' : '排队 / 等待状态同步'}`;
}

export function taskRows(sessionId, list, statuses, jobs = []) {
  return [...agentRows(sessionId, list, statuses), ...jobs.map(job => ({
    id: 'job:' + job.id, title: (job.kind === 'subagent' ? '后台子代理' : '后台任务') + ' · ' + (job.label || job.id),
    state: ['running', 'stopping'].includes(job.status) ? 'working' : 'completed',
    statusText: ({running:'运行中',stopping:'正在停止',completed:'已完成',failed:'失败',killed:'已停止'})[job.status] || job.status,
    progress: job.progress || job.detail, kind: job.kind,
  }))];
}

/** Four or more tasks share exactly three visible representatives; no task is dropped. */
export function orbitRows(rows) {
  if (rows.length < 4) return rows;
  return Array.from({ length: 3 }, (_, index) => {
    const members = rows.filter((_, position) => position % 3 === index);
    return {
      id: `group:${index}`, title: `任务组 ${index + 1} · ${members.length} 项`,
      state: members.some(row => row.state === 'working') ? 'working'
        : members.every(row => row.state === 'completed') ? 'completed' : 'queued',
      statusText: members.map(agentLabel).join('；'),
      exiting: members.every(row => row.exiting), members,
    };
  });
}
