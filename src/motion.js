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
    this.dead = false; this.generation = 0; this.animations = new Set(); this.nodes = new Set();
    this.hiddenTargets = new Map(); this.claimed = new WeakSet(root.querySelectorAll(SELECTORS.user));
    this.taskFlights = new Set();
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
      for (const cleanup of this.taskFlights) if (!cleanup.target.isConnected) cleanup();
      for (const record of records) {
        if (record.target === this.layer || this.layer.contains(record.target)) continue;
        if (record.type === 'attributes') this.changed.add(record.target);
        for (const node of record.addedNodes) if (elements(node)) this.changed.add(node);
        // Text-node deltas need no DOM query: the paragraph already has its entrance.
        if (record.removedNodes.length && this.streams.size) this.pruneStreams();
      }
      // DSH replaces the optimistic submission with its confirmed row during flight.
      const flight = this.messageFlight;
      if (flight && !flight.target.isConnected) {
        const replacement = this.findDestination(flight.submission);
        if (replacement) {
          flight.restore(); this.claimed.add(replacement);
          flight.target = replacement; flight.restore = this.hideTarget(replacement);
        }
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
    return candidates.reverse().find(el => !this.claimed.has(el) && visible(el)
      && (!submission.text || el.textContent.includes(submission.text.slice(0, 48))));
  }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (!this.dead && this.queue.length) await this.flight(this.queue.shift());
    } finally { this.busy = false; }
  }
  hideTarget(target) {
    const hold = target.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'both' });
    this.hiddenTargets.set(target, hold);
    return () => { hold.cancel(); this.hiddenTargets.delete(target); };
  }
  async flight(submission) {
    const generation = this.generation;
    const input = this.root.querySelector(SELECTORS.input);
    if (!input || !visible(input)) return;
    // Resolve only a new host-rendered message. Never animate an identical historical message.
    let target = this.findDestination(submission);
    for (let attempt = 0; !target && attempt < 8 && !this.dead && generation === this.generation; attempt++) {
      await this.delay(50); target = this.findDestination(submission);
    }
    if (!target || this.dead || document.hidden || generation !== this.generation) return;
    this.claimed.add(target);
    if (this.reduced) {
      target.classList.add('ld-received');
      await this.delay(450); target.classList.remove('ld-received'); return;
    }
    const orb = document.createElement('div');
    orb.className = 'ld-flight'; orb.dataset.ldPhase = 'gather'; orb.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.textContent = submission.text.slice(0, 180) || '附件';
    this.updateGeometry();
    const start = center(input), inputRect = input.getBoundingClientRect();
    orb.append(text); this.layer.append(orb); this.nodes.add(orb);
    const place = point => { orb.style.left = (point.x-this.origin.x)+'px'; orb.style.top = (point.y-this.origin.y)+'px'; };
    place(start);
    // Keep the actual message mounted and accessible while its visual copy travels.
    const flight = { submission, target, restore: this.hideTarget(target) };
    this.messageFlight = flight;
    try {
      await this.animate(orb, [
        { width: Math.min(inputRect.width, 360)+'px', height: '40px', borderRadius: '14px', opacity: .95 },
        { width: '22px', height: '22px', borderRadius: '50%', opacity: 1 },
      ], this.options.gather);
      text.remove();
      target = flight.target;
      if (!orb.isConnected || this.dead || !visible(target)) return;
      const destination = center(target), dx = destination.x-start.x, dy = destination.y-start.y;
      orb.dataset.ldPhase = 'travel';
      // Direct composer → message path. The header is exclusively for AI task emissions.
      await this.animate(orb, [
        { transform: 'translate(-50%,-50%) scale(1)' },
        { transform: 'translate(calc(-50% + '+dx*.42+'px),calc(-50% + '+dy*.55+'px)) scale(.94,1.08)', offset: .48 },
        { transform: 'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) scale(1)' },
      ], this.options.flight);
      target = flight.target;
      if (!orb.isConnected || this.dead || !visible(target)) return;
      place(center(target)); orb.dataset.ldPhase = 'expand';
      const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
      await this.animate(orb, [
        { width: '22px', height: '22px', borderRadius: '50%', opacity: 1 },
        { width: Math.min(rect.width, this.root.clientWidth)+'px', height: Math.min(rect.height, 160)+'px', borderRadius: style.borderRadius || '16px', opacity: .15 },
      ], this.options.settle*.65);
      target = flight.target; flight.restore();
      if (orb.isConnected && target.isConnected) await Promise.all([
        this.animate(orb, [{ opacity: .15 }, { opacity: 0 }], this.options.settle*.35),
        this.animate(target, [{ opacity: 0, transform: 'scale(.975)' }, { opacity: 1, transform: 'scale(1)' }], this.options.settle*.35),
      ]);
    } finally {
      flight.restore();
      if (this.messageFlight === flight) this.messageFlight = null;
      orb.remove(); this.nodes.delete(orb);
    }
  }
  emitTask(element) {
    if (this.dead || this.reduced || document.hidden || !visible(element)) return;
    const source = [...this.root.querySelectorAll('[data-chat-flow-kind]')].reverse()
      .find(el => el.getAttribute('data-chat-flow-kind')?.startsWith('assistant') && visible(el));
    if (!source) return;
    this.updateGeometry();
    const from = source.getBoundingClientRect(), to = center(element);
    const start = { x: Math.min(from.right-12, from.left+Math.min(from.width*.4, 160)), y: Math.max(this.origin.y+14, Math.min(from.bottom-14, innerHeight-14)) };
    const orb = document.createElement('div'); orb.className = 'ld-flight ld-task-flight'; orb.setAttribute('aria-hidden', 'true');
    orb.style.left = (start.x-this.origin.x)+'px'; orb.style.top = (start.y-this.origin.y)+'px';
    this.layer.append(orb);
    const hidden = element.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'both' });
    const dx = to.x-start.x, dy = to.y-start.y;
    const animation = orb.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .15 },
      { opacity: 1, transform: 'translate(calc(-50% + '+dx*.5+'px),calc(-50% + '+dy*.65+'px)) scale(.93,1.08)', offset: .55 },
      { opacity: 1, transform: 'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) scale(1)' },
    ], { duration: this.options.taskFlight, easing: EASING });
    const cleanup = () => { animation.cancel(); hidden.cancel(); orb.remove(); this.taskFlights.delete(cleanup); };
    cleanup.target = element;
    this.taskFlights.add(cleanup); animation.finished.then(cleanup, cleanup); return cleanup;
  }
  cancelFlight() {
    this.generation++;
    this.messageFlight = null;
    this.queue.length = 0;
    for (const hold of this.hiddenTargets.values()) hold.cancel(); this.hiddenTargets.clear();
    for (const target of this.root.querySelectorAll('.ld-received')) target.classList.remove('ld-received');
    for (const cleanup of this.taskFlights) cleanup();
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
  for (const row of rows) {
    const selected = enabled && row.getAttribute('aria-selected') === 'true';
    const running = enabled && active.has(row.dataset.rowKey.slice(8));
    row.classList.toggle('ld-row', selected || running);
    row.classList.toggle('ld-row-selected', selected);
    row.classList.toggle('ld-row-active', running);
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
      for (const row of this.rows) row.classList.toggle('ld-paused', document.hidden && this.enabled);
    });
  }
  dispose() {
    this.observer.disconnect(); cancelAnimationFrame(this.frame);
    for (const dispose of this.watches.values()) dispose(); this.watches.clear();
    document.removeEventListener('visibilitychange', this.visibility); this.rows.clear(); clearSidebar();
  }
}

export function clearSidebar() {
  for (const row of document.querySelectorAll(SELECTORS.sidebar)) {
    row.classList.remove('ld-row', 'ld-row-active', 'ld-row-selected', 'ld-paused');
  }
}
