/** DOM compatibility layer for official DSH 0.1.7-rc.2 data attributes. */
export const SELECTORS = Object.freeze({
  conversation: '[data-conversation-content][data-conversation-session]',
  input: '[data-composer-input]',
  user: '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-submission-echo]',
  assistant: '[data-chat-flow-kind="assistant-step"]',
  stream: '[data-streaming="true"]',
  sidebar: '[data-row-key^="session:"][role="treeitem"]',
});

const center = element => {
  const r = element.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const visible = element => {
  if (!element.isConnected || !element.getClientRects().length || element.closest('[hidden], [inert]')) return false;
  const r = element.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
  const scroller = element.closest('[data-conversation-scroll]');
  if (!scroller) return true;
  const clip = scroller.getBoundingClientRect();
  return r.bottom > clip.top && r.top < clip.bottom && r.right > clip.left && r.left < clip.right;
};
export const EASING = 'cubic-bezier(.22,.75,.25,1)';
const BLOCKS = 'p,pre,ul,ol,table,blockquote,h1,h2,h3';
const elements = node => node.nodeType === 1;
function matchesIn(node, selector) {
  if (!elements(node)) return [];
  return [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
}

export class MotionSurface {
  constructor(root, options, reduced, dock) {
    this.root = root; this.options = options; this.reduced = reduced; this.dock = dock;
    this.dead = false; this.animations = new Set(); this.nodes = new Set();
    this.timers = new Map(); this.queue = []; this.busy = false;
    this.seen = new WeakSet(); this.streams = new Set(); this.raf = 0;
    this.changed = new Set(); this.geometryFrame = 0;
    this.abort = new AbortController();
    root.classList.add('ld-surface');
    root.classList.toggle('ld-reduced', reduced);
    // A plugin-owned clipped layer: never change positioning/isolation on the host.
    this.layer = document.createElement('div'); this.layer.className = 'ld-effects';
    this.layer.setAttribute('aria-hidden', 'true');
    if (options.ambient) {
      const ambient = document.createElement('div'); ambient.className = 'ld-ambient';
      this.layer.append(ambient);
    }
    root.append(this.layer);
    this.updateGeometry();
    this.resize = new ResizeObserver(() => this.scheduleGeometry());
    this.resize.observe(root);
    if (dock()) this.resize.observe(dock());
    window.addEventListener('resize', () => this.scheduleGeometry(), { signal: this.abort.signal });
    document.addEventListener('scroll', () => this.scheduleGeometry(), { capture: true, passive: true, signal: this.abort.signal });
    // Baseline all mounted blocks: history must not animate when opening a Session.
    for (const block of root.querySelectorAll(BLOCKS)) this.seen.add(block);
    this.observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.target === this.layer || this.layer.contains(record.target)) continue;
        if (record.type === 'attributes') this.changed.add(record.target);
        for (const node of record.addedNodes) if (elements(node)) this.changed.add(node);
        // Text-node deltas need no DOM query: the paragraph already has its entrance.
        if (record.removedNodes.length && this.streams.size) this.pruneStreams();
      }
      if (this.changed.size) this.schedule();
    });
    this.observer.observe(root, { childList: true, subtree: true,
      attributes: true, attributeFilter: ['data-streaming'] });
    for (const stream of root.querySelectorAll(SELECTORS.stream)) this.changed.add(stream);
    this.schedule();
    document.addEventListener('visibilitychange', () => {
      root.classList.toggle('ld-paused', document.hidden);
      if (document.hidden) this.cancelFlight();
    }, { signal: this.abort.signal });
    root.classList.toggle('ld-paused', document.hidden);
  }
  scheduleGeometry() {
    if (!this.geometryFrame && !this.dead) this.geometryFrame = requestAnimationFrame(() => {
      this.geometryFrame = 0; this.updateGeometry();
    });
  }
  updateGeometry() {
    const rect = this.root.getBoundingClientRect(), dock = this.dock()?.getBoundingClientRect();
    const top = Math.max(0, Math.min(rect.top, dock?.top ?? rect.top));
    this.origin = { x: rect.left, y: top };
    Object.assign(this.layer.style, { left: `${rect.left}px`, top: `${top}px`,
      width: `${Math.max(0, rect.width)}px`, height: `${Math.max(0, Math.min(innerHeight, rect.bottom) - top)}px` });
  }
  schedule() {
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(() => { this.raf = 0; this.scan(); });
  }
  pruneStreams() {
    for (const el of this.streams) {
      if (!this.root.contains(el) || !el.matches(SELECTORS.stream)) {
        el.classList.remove('ld-stream'); this.streams.delete(el);
      }
    }
  }
  scan() {
    if (this.dead) return;
    this.pruneStreams();
    const blocks = new Set(), candidates = new Set();
    for (const node of this.changed) {
      if (!this.root.contains(node)) continue;
      for (const stream of matchesIn(node, SELECTORS.stream)) candidates.add(stream);
      const parent = node.closest(SELECTORS.stream);
      if (parent) candidates.add(parent);
      for (const block of matchesIn(node, BLOCKS)) blocks.add(block);
    }
    this.changed.clear();
    for (const stream of candidates) {
      if (stream.closest('[data-chat-flow-kind]')?.getAttribute('data-chat-flow-kind')?.startsWith('assistant') !== true) continue;
      if (stream.parentElement?.closest(SELECTORS.stream)) continue;
      stream.classList.add('ld-stream'); this.streams.add(stream);
    }
    for (const block of blocks) {
        const stream = block.closest(SELECTORS.stream);
        if (!stream || !this.streams.has(stream)) continue;
        if (this.seen.has(block)) continue;
        this.seen.add(block);
        // One animation per paragraph/block; appends never repeatedly blur old text.
        if (block.parentElement?.closest('pre,ul,ol,table,blockquote')) continue;
        if (!this.reduced && visible(block)) this.animate(block, block.matches('p') ? [
          { opacity: .35, filter: 'blur(3px)', transform: 'translateY(2px)' },
          { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
        ] : [{ opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], this.options.reveal);
    }
  }
  animate(el, frames, duration) {
    if (this.dead || this.reduced || !el.animate) return Promise.resolve();
    const animation = el.animate(frames, { duration, easing: EASING });
    this.animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => this.animations.delete(animation));
  }
  delay(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.timers.delete(timer); resolve(); }, ms);
      this.timers.set(timer, resolve);
    });
  }
  submit(submission) {
    if (this.dead || document.hidden || !visible(this.root)) return;
    // Decorations have a bounded queue; actual DSH submissions are never queued here.
    if (this.queue.length >= this.options.maxQueue) return;
    this.queue.push(submission);
    void this.drain();
  }
  findDestination(submission) {
    const candidates = [...this.root.querySelectorAll(submission.placement === 'queued'
      ? '[data-queue-dock] [data-submission-echo], [data-queue-dock]' : SELECTORS.user)];
    return candidates.reverse().find(el => visible(el)
      && (!submission.text || el.textContent.includes(submission.text.slice(0, 48))));
  }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (!this.dead && this.queue.length) await this.flight(this.queue.shift());
    } finally { this.busy = false; }
  }
  async flight(submission) {
    const input = this.root.querySelector(SELECTORS.input);
    const dock = this.dock();
    if (!input || !dock || !visible(input) || !visible(dock)) return;
    if (this.reduced) {
      dock.classList.add('ld-received');
      await this.delay(450);
      dock.classList.remove('ld-received');
      return;
    }
    const orb = document.createElement('div');
    orb.className = 'ld-flight'; orb.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.textContent = submission.text.slice(0, 90) || '附件';
    this.updateGeometry();
    orb.append(text); this.layer.append(orb); this.nodes.add(orb);
    const start = center(input), top = center(dock);
    orb.style.left = `${start.x-this.origin.x}px`; orb.style.top = `${start.y-this.origin.y}px`;
    this.root.classList.add('ld-emitting'); dock.classList.add('ld-emitting');
    try {
      await this.animate(orb, [
        { width: '180px', height: '36px', borderRadius: '12px', opacity: .8 },
        { width: '22px', height: '22px', borderRadius: '50%', opacity: 1 },
      ], 280);
      text.remove();
      if (!orb.isConnected || this.dead) return;
      await this.animate(orb, [
        { transform: 'translate(-50%,-50%) scale(1)' },
        { transform: `translate(calc(-50% + ${(top.x-start.x)*.4}px),calc(-50% + ${(top.y-start.y)*.65}px)) scale(.92,1.12)`, offset: .5 },
        { transform: `translate(calc(-50% + ${top.x-start.x}px),calc(-50% + ${top.y-start.y-3}px)) scale(1.06,.96)`, offset: .86 },
        { transform: `translate(calc(-50% + ${top.x-start.x}px),calc(-50% + ${top.y-start.y}px)) scale(1)` },
      ], this.options.flight);
      orb.style.left = `${top.x-this.origin.x}px`; orb.style.top = `${top.y-this.origin.y}px`;
      if (!orb.isConnected || this.dead) return;
      await this.delay(this.options.hold);
      if (!orb.isConnected || this.dead) return;
      const target = this.findDestination(submission);
      if (!target) return; // failed/removed/offscreen submissions never fabricate a bubble
      const destination = center(target);
      await this.animate(orb, [
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${destination.x-top.x}px),calc(-50% + ${destination.y-top.y}px)) scale(1.7)`, opacity: 0 },
      ], this.options.settle);
      if (orb.isConnected && visible(target)) await this.animate(target,
        [{ transform: 'scale(.985)', filter: 'blur(.6px)' }, { transform: 'scale(1)', filter: 'blur(0)' }], 180);
    } finally {
      orb.remove(); this.nodes.delete(orb);
      this.root.classList.remove('ld-emitting'); dock.classList.remove('ld-emitting');
    }
  }
  cancelFlight() {
    this.queue.length = 0;
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    for (const node of this.nodes) node.remove();
    this.nodes.clear();
    for (const [timer, resolve] of this.timers) { clearTimeout(timer); resolve(); }
    this.timers.clear();
    this.root.classList.remove('ld-emitting');
    this.dock()?.classList.remove('ld-emitting', 'ld-received');
  }
  dispose() {
    this.dead = true; this.observer.disconnect(); this.resize.disconnect(); this.abort.abort();
    cancelAnimationFrame(this.geometryFrame); this.changed.clear();
    cancelAnimationFrame(this.raf); this.cancelFlight();
    for (const el of this.streams) el.classList.remove('ld-stream');
    this.streams.clear();
    this.layer.remove();
    this.root.classList.remove('ld-surface', 'ld-reduced', 'ld-paused');
  }
}

export function decorateSidebar(active, enabled, rows) {
  rows = [...rows].filter(row => row.isConnected);
  const count = rows.filter(row => active.has(row.dataset.rowKey.slice(8)) && row.getAttribute('aria-selected') !== 'true').length;
  for (const row of rows) {
    // Official 0.1.7 row structure: leading icon, title span, time, actions.
    const title = row.querySelector(':scope > span:nth-of-type(2)');
    if (!title) continue;
    title.classList.toggle('ld-title', enabled);
    const selected = enabled && row.getAttribute('aria-selected') === 'true';
    const flow = enabled && active.has(row.dataset.rowKey.slice(8));
    title.classList.toggle('ld-title-selected', selected);
    if (enabled) title.dataset.ldLabel = title.textContent; else delete title.dataset.ldLabel;
    title.classList.toggle('ld-title-active', flow);
    title.classList.toggle('ld-title-muted', flow && !selected && count > 3);
  }
}

/** Incremental row index. A streamed text delta never recomputes Session activity. */
export class SidebarObserver {
  constructor(watchRows) {
    this.watchRows = watchRows; this.watches = new Map();
    this.rows = new Set(document.querySelectorAll(SELECTORS.sidebar));
    this.active = new Set(); this.enabled = false; this.frame = 0;
    this.observer = new MutationObserver(records => {
      let dirty = false;
      for (const record of records) {
        if (record.type === 'attributes' && record.target.matches(SELECTORS.sidebar)) dirty = true;
        if (record.type === 'childList' && record.target.closest?.(SELECTORS.sidebar)) dirty = true;
        for (const node of record.addedNodes) {
          for (const row of matchesIn(node, SELECTORS.sidebar)) { this.rows.add(row); dirty = true; }
        }
        // Only removal can invalidate cached row membership; no document-wide query.
        if ([...record.removedNodes].some(elements)) for (const row of this.rows) if (!row.isConnected) {
          this.rows.delete(row); dirty = true;
        }
      }
      if (dirty) this.schedule();
    });
    this.observer.observe(document.body, { childList: true, subtree: true,
      attributes: true, attributeFilter: ['aria-selected'] });
    this.selection = () => { const selection = getSelection(); for (const row of this.rows) { const title = row.querySelector('.ld-title'); if (title) title.classList.toggle('ld-title-selecting', !!selection && !selection.isCollapsed && selection.containsNode(title, true)); } };
    document.addEventListener('selectionchange', this.selection);
    this.visibility = () => this.schedule();
    document.addEventListener('visibilitychange', this.visibility);
  }
  set(active, enabled) { this.active = active; this.enabled = enabled; this.schedule(); }
  schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => {
      this.frame = 0; decorateSidebar(this.active, this.enabled, this.rows);
      const ids = new Set(this.enabled ? [...this.rows].map(row => row.dataset.rowKey.slice(8)) : []);
      for (const [id, dispose] of this.watches) if (!ids.has(id)) { dispose(); this.watches.delete(id); }
      for (const id of ids) if (!this.watches.has(id) && this.watchRows) this.watches.set(id, this.watchRows(id));
      for (const row of this.rows) row.querySelector('.ld-title')?.classList.toggle('ld-paused', document.hidden);
    });
  }
  dispose() {
    this.observer.disconnect(); cancelAnimationFrame(this.frame);
    for (const dispose of this.watches.values()) dispose(); this.watches.clear();
    document.removeEventListener('selectionchange', this.selection);
    document.removeEventListener('visibilitychange', this.visibility); this.rows.clear(); clearSidebar();
  }
}

export function clearSidebar() {
  for (const el of document.querySelectorAll('.ld-title')) { el.classList.remove('ld-title', 'ld-title-active', 'ld-title-selected', 'ld-title-selecting', 'ld-title-muted', 'ld-paused'); delete el.dataset.ldLabel; }
}
