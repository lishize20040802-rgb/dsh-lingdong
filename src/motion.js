/** DOM compatibility layer for official DSH 0.1.7-rc.2 data attributes. */
export const SELECTORS = Object.freeze({
  conversation: '[data-conversation-content][data-conversation-session]',
  input: '[data-composer-input]',
  user: '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-submission-echo]',
  // Verified against the pinned official 0.1.7-rc.2 UserStyleBubble, not the row/actions wrapper.
  bubble: '.LdtX1G_bubble',
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

// Freeze the actual rendered text/box, including rich text, font metrics and wrapping.
// The copy never receives events, IDs or executable content.
function visualCopy(element) {
  const clone = element.cloneNode(true);
  const originals = [element, ...element.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((original, index) => {
    const copy = copies[index];
    for (const attr of [...copy.attributes]) if (/^(id|class|style|contenteditable|autofocus|tabindex|href)$|^on|^data-/i.test(attr.name)) copy.removeAttribute(attr.name);
    const computed = getComputedStyle(original);
    for (const key of computed) copy.style.setProperty(key, computed.getPropertyValue(key));
    copy.style.animation = 'none'; copy.style.transition = 'none'; copy.style.caretColor = 'transparent';
    copy.style.pointerEvents = 'none';
    if (copy.matches('script,style,iframe,object,embed,video,audio')) copy.remove();
  });
  clone.setAttribute('aria-hidden', 'true'); clone.setAttribute('inert', '');
  Object.assign(clone.style, { margin: '0', position: 'relative', left: '0', top: '0',
    right: 'auto', bottom: 'auto', transform: 'none', opacity: '1', visibility: 'visible',
    minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', boxSizing: 'border-box' });
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const div = document.createElement('div'); div.style.cssText = clone.style.cssText;
    div.style.whiteSpace = 'pre-wrap'; div.style.overflowWrap = 'break-word';
    div.textContent = element.value; return div;
  }
  return clone;
}
const inputText = input => 'value' in input ? input.value : input.innerText;
const sameText = (a, b) => a?.replace(/\r\n/g, '\n').trim() === b?.replace(/\r\n/g, '\n').trim();
const mix = (a, b, t) => a + (b-a)*t;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };

export class MotionSurface {
  constructor(root, options, reduced, dock) {
    this.root = root; this.options = options; this.reduced = reduced; this.dock = dock;
    this.dead = false; this.generation = 0; this.animations = new Set(); this.nodes = new Set();
    this.hiddenTargets = new Map(); this.claimed = new WeakSet([...root.querySelectorAll(SELECTORS.user)].flatMap(row => [row, ...row.querySelectorAll(SELECTORS.bubble)]));
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
    this.captureInput();
    root.addEventListener('input', () => this.captureInput(), { capture: true, signal: this.abort.signal });
    root.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) this.captureInput(); }, { capture: true, signal: this.abort.signal });
    root.addEventListener('pointerdown', () => this.captureInput(), { capture: true, signal: this.abort.signal });
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
      // DSH replaces the optimistic submission with its confirmed row during flight.
      const flight = this.messageFlight;
      if (flight && !flight.target.isConnected) {
        const replacement = this.findDestination(flight.submission);
        if (replacement) {
          flight.restore(); this.claimed.add(replacement);
          flight.target = replacement; flight.refresh?.(); flight.restore = this.hideTarget(replacement);
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
    const input = this.root.querySelector(SELECTORS.input);
    if (input && sameText(inputText(input), submission.text)) this.captureInput();
    this.queue.push({ ...submission, visualSource: sameText(this.inputSnapshot?.text, submission.text) ? this.inputSnapshot : null });
    void this.drain();
  }
  findDestination(submission) {
    const candidates = [...this.root.querySelectorAll(submission.placement === 'queued'
      ? '[data-queue-dock] [data-submission-echo], [data-queue-dock]' : SELECTORS.user)];
    const bubbles = [...new Set(candidates.map(el => el.querySelector(SELECTORS.bubble) ?? el))];
    return bubbles.find(el => !this.claimed.has(el) && visible(el)
      && (!submission.text || sameText(el.textContent, submission.text)));
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
  captureInput() {
    const input = this.root.querySelector(SELECTORS.input);
    if (!input || !visible(input) || !inputText(input)?.trim()) return;
    const rect = input.getBoundingClientRect();
    this.inputSnapshot = { text: inputText(input), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      copy: visualCopy(input), scrollTop: input.scrollTop, scrollLeft: input.scrollLeft };
  }
  async flight(submission) {
    const generation = this.generation;
    const input = this.root.querySelector(SELECTORS.input);
    if (!input || !visible(input)) return;
    let target = this.findDestination(submission);
    for (let attempt = 0; !target && attempt < 8 && !this.dead && generation === this.generation; attempt++) {
      await this.delay(50); target = this.findDestination(submission);
    }
    if (!target || this.dead || document.hidden || generation !== this.generation) return;
    this.claimed.add(target);
    // Never invent a starting text position after a programmatic/attachment-only submission.
    const source = submission.visualSource;
    if (this.reduced || !source) {
      target.classList.add('ld-received');
      await this.delay(450); target.classList.remove('ld-received'); return;
    }
    this.updateGeometry();
    const orb = document.createElement('div'); orb.className = 'ld-flight ld-message-flight';
    orb.dataset.ldPhase = 'gather';
    orb.setAttribute('aria-hidden', 'true');
    const core = document.createElement('div'); core.className = 'ld-flight-core'; orb.append(core);
    const sourceWrap = document.createElement('div'); sourceWrap.className = 'ld-flight-copy';
    const sourceCopy = source.copy.cloneNode(true); sourceWrap.append(sourceCopy); orb.append(sourceWrap);
    const targetWrap = document.createElement('div'); targetWrap.className = 'ld-flight-copy';orb.append(targetWrap);
    this.layer.append(orb);this.nodes.add(orb);
    Object.assign(sourceCopy.style, { width: source.rect.width+'px', height: source.rect.height+'px' });
    sourceCopy.scrollTop = source.scrollTop; sourceCopy.scrollLeft = source.scrollLeft;
    const flight = { submission, target, restore: () => {}, refresh: () => {
      const copy = visualCopy(flight.target), rect = flight.target.getBoundingClientRect();
      Object.assign(copy.style, { width: rect.width+'px', height: rect.height+'px' });
      targetWrap.replaceChildren(copy); flight.copy = copy;
    } };
    flight.refresh(); flight.restore = this.hideTarget(target); this.messageFlight = flight;
    const start = { x: source.rect.x+source.rect.width/2, y: source.rect.y+source.rect.height/2 };
    const gather = this.options.gather, travel = this.options.flight, settle = this.options.settle;
    const overlap = Math.min(60, gather/4, settle/4);
    const travelStart = gather-overlap, expandStart = travelStart+travel-overlap;
    const total = expandStart+settle, diameter = 18;
    let frame = 0, finish;
    const done = new Promise(resolve => { finish = resolve; });
    const cancel = () => { cancelAnimationFrame(frame); finish(); };
    this.cancelMessageFrame = cancel;
    const started = performance.now();
    const tick = now => {
      if (this.dead || generation !== this.generation || !orb.isConnected || !visible(flight.target)) { finish(); return; }
      const elapsed = Math.min(total, now-started);
      const g = smooth(elapsed/gather), e = smooth((elapsed-expandStart)/settle);
      const p = smooth((elapsed-travelStart)/travel);
      const rect = flight.target.getBoundingClientRect(), destination = { x: rect.x+rect.width/2, y: rect.y+rect.height/2 };
      // Re-read the live target each frame: confirmation, autoscroll and resize stay aligned.
      Object.assign(flight.copy.style, { width: rect.width+'px', height: rect.height+'px' });
      const width = mix(mix(source.rect.width, diameter, g), rect.width, e);
      const height = mix(mix(source.rect.height, diameter, g), rect.height, e);
      const x = mix(start.x, destination.x, p), y = mix(start.y, destination.y, p);
      const computed = getComputedStyle(flight.target);
      const radius = parseFloat(computed.borderTopLeftRadius) || 0;
      Object.assign(orb.style, { left: (x-this.origin.x)+'px', top: (y-this.origin.y)+'px',
        width: width+'px', height: height+'px', borderRadius: mix(mix(0,diameter/2,g),radius,e)+'px',
        background: 'var(--ld-accent)', opacity: '1' });
      orb.dataset.ldPhase = elapsed < travelStart ? 'gather' : elapsed < expandStart ? 'travel' : 'expand';
      // Both visual copies scale as complete units; no truncation, ellipsis or text removal.
      const sourceScale = mix(1, diameter/Math.max(source.rect.width, source.rect.height), g);
      const targetScale = mix(diameter/Math.max(rect.width, rect.height),1,e);
      Object.assign(sourceWrap.style, { width: source.rect.width+'px', height: source.rect.height+'px',
        transform: 'translate(-50%,-50%) scale('+sourceScale+')', opacity: String(1-smooth((g-.7)/.3)) });
      Object.assign(targetWrap.style, { width: rect.width+'px', height: rect.height+'px',
        transform: 'translate(-50%,-50%) scale('+targetScale+')', opacity: String(smooth(e/.38)) });
      // The neutral ball becomes the destination's exact surface as the text expands.
      core.style.opacity = String(smooth(g) * (1-e));
      if (elapsed >= total) { finish(); return; }
      frame = requestAnimationFrame(tick);
    };
    // Initialize synchronously, so the first paint is exactly the source text, never an 18px flash.
    try { tick(started); await done; }
    finally {
      cancelAnimationFrame(frame);flight.restore();
      if (this.messageFlight === flight) this.messageFlight = null;
      if (this.cancelMessageFrame === cancel) this.cancelMessageFrame = null;
      orb.remove();this.nodes.delete(orb);
    }
  }
  cancelFlight() {
    this.generation++;
    this.cancelMessageFrame?.();
    this.messageFlight = null;
    this.queue.length = 0;
    for (const hold of this.hiddenTargets.values()) hold.cancel(); this.hiddenTargets.clear();
    for (const target of this.root.querySelectorAll('.ld-received')) target.classList.remove('ld-received');
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
    if (selected || running) {
      // The glow is the row's own pseudo-element, so it follows native reordering and transforms.
      const phase = [...row.dataset.rowKey].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 86;
      row.style.setProperty('--ld-glow-delay', `${-phase / 10}s`);
    } else row.style.removeProperty('--ld-glow-delay');
  }
}

/** Incremental row index. A streamed text delta never recomputes Session activity. */
export class SidebarObserver {
  constructor() {
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
      for (const row of this.rows) row.classList.toggle('ld-paused', document.hidden && this.enabled);
    });
  }
  dispose() {
    this.observer.disconnect(); cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.visibility); this.rows.clear(); clearSidebar();
  }
}

export function clearSidebar() {
  for (const row of document.querySelectorAll(SELECTORS.sidebar)) {
    row.classList.remove('ld-row', 'ld-row-active', 'ld-row-selected', 'ld-paused', 'ld-row-position');
    row.style.removeProperty('--ld-glow-delay');
  }
}
