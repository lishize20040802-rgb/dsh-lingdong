window.__ModuleLoader__.load({id:"dsh-lingdong",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);

// src/model.js
var DEFAULTS = Object.freeze({
  enabled: true,
  ambient: true,
  aggregate: true,
  flight: 420,
  gather: 320,
  settle: 360,
  reveal: 420,
  dissolve: 520,
  breathing: 4200,
  ambientPeriod: 24e3,
  maxOrbs: 4,
  maxQueue: 3
});
function normalizeOptions(input = {}) {
  const result = { ...DEFAULTS };
  for (const key of ["enabled", "ambient", "aggregate"]) {
    if (typeof input?.[key] === "boolean") result[key] = input[key];
  }
  for (const key of ["flight", "gather", "settle", "reveal", "dissolve"]) {
    if (Number.isFinite(input?.[key])) result[key] = Math.max(80, Math.min(4e3, input[key]));
  }
  return result;
}
function agentRows(sessionId, list, statuses) {
  const catalog = list.projectionsBySession?.[sessionId]?.values?.subagentCatalog ?? list.byId?.[sessionId]?.projectionValues?.subagentCatalog ?? [];
  return catalog.map((entry) => {
    const summary = list.byId?.[entry.id];
    const timing = list.projectionsBySession?.[entry.id]?.values?.subagentTiming ?? summary?.projectionValues?.subagentTiming;
    const running = statuses.get(entry.id)?.running ?? summary?.running;
    const state = running === true ? "working" : timing?.lastTurnCompleted === true ? "completed" : "queued";
    return {
      id: entry.id,
      title: entry.label || summary?.displayTitle || entry.id,
      state,
      timing,
      inactive: running === false && timing?.lastTurnCompleted !== true
    };
  });
}
function activeSessions(list, statuses) {
  const active = /* @__PURE__ */ new Set();
  for (const [id, row] of Object.entries(list.byId ?? {})) {
    if ((statuses.get(id)?.running ?? row.running) === true) active.add(id);
  }
  for (const [id, status] of statuses) if (status.running === true) active.add(id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, projection] of Object.entries(list.projectionsBySession ?? {})) {
      if (!active.has(id) && projection.values?.subagentCatalog?.some((x) => active.has(x.id))) {
        active.add(id);
        changed = true;
      }
    }
  }
  return active;
}
function reconcileAgents(previous, incoming, initialized) {
  const next = /* @__PURE__ */ new Map();
  for (const row of incoming) {
    const before = previous.get(row.id);
    if (row.state === "completed") {
      if (before && before.state !== "completed") next.set(row.id, { ...row, exiting: true });
      else if (before?.exiting) next.set(row.id, before);
    } else next.set(row.id, { ...row, fresh: initialized && !before });
  }
  return next;
}
function agentLabel(row) {
  if (row.statusText) return `${row.title} · ${row.statusText}${row.progress ? ` · ${row.progress}` : ""}`;
  if (row.state === "completed") return `${row.title} · 已完成`;
  if (row.state === "working") return `${row.title} · 工作中（未提供百分比进度）`;
  return `${row.title} · ${row.inactive ? "当前未运行" : "排队 / 等待状态同步"}`;
}
var AGENT_COLORS = Object.freeze(["#FF5F57", "#FEBC2E", "#28C840"]);
function assignColors(rows, previous = /* @__PURE__ */ new Map(), random = Math.random) {
  const assigned = new Map(rows.filter((row) => previous.has(row.id)).map((row) => [row.id, previous.get(row.id)]));
  for (const row of rows) if (!assigned.has(row.id)) {
    const counts = AGENT_COLORS.map((color) => [...assigned.values()].filter((value) => value === color).length);
    const minimum = Math.min(...counts);
    const choices = AGENT_COLORS.filter((_, index) => counts[index] === minimum);
    assigned.set(row.id, choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]);
  }
  return assigned;
}

// src/motion.js
var SELECTORS = Object.freeze({
  conversation: "[data-conversation-content][data-conversation-session]",
  input: "[data-composer-input]",
  user: '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-submission-echo]',
  // Verified against the pinned official 0.1.7-rc.2 UserStyleBubble, not the row/actions wrapper.
  bubble: ".LdtX1G_bubble",
  assistant: '[data-chat-flow-kind="assistant-step"]',
  stream: '[data-streaming="true"]',
  sidebar: '[data-row-key^="session:"][role="treeitem"]'
});
var visible = (element) => {
  if (!element.isConnected || !element.getClientRects().length || element.closest("[hidden], [inert]")) return false;
  const r = element.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
  const scroller = element.closest("[data-conversation-scroll]");
  if (!scroller) return true;
  const clip = scroller.getBoundingClientRect();
  return r.bottom > clip.top && r.top < clip.bottom && r.right > clip.left && r.left < clip.right;
};
var EASING = "cubic-bezier(.22,.75,.25,1)";
var BLOCKS = "p,pre,ul,ol,table,blockquote,h1,h2,h3";
var elements = (node) => node.nodeType === 1;
function matchesIn(node, selector) {
  if (!elements(node)) return [];
  return [...node.matches(selector) ? [node] : [], ...node.querySelectorAll(selector)];
}
function visualCopy(element) {
  const clone = element.cloneNode(true);
  const originals = [element, ...element.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((original, index) => {
    const copy = copies[index];
    for (const attr of [...copy.attributes]) if (/^(id|class|style|contenteditable|autofocus|tabindex|href)$|^on|^data-/i.test(attr.name)) copy.removeAttribute(attr.name);
    const computed = getComputedStyle(original);
    for (const key of computed) copy.style.setProperty(key, computed.getPropertyValue(key));
    copy.style.animation = "none";
    copy.style.transition = "none";
    copy.style.caretColor = "transparent";
    copy.style.pointerEvents = "none";
    if (copy.matches("script,style,iframe,object,embed,video,audio")) copy.remove();
  });
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  Object.assign(clone.style, {
    margin: "0",
    position: "relative",
    left: "0",
    top: "0",
    right: "auto",
    bottom: "auto",
    transform: "none",
    opacity: "1",
    visibility: "visible",
    minWidth: "0",
    minHeight: "0",
    maxWidth: "none",
    maxHeight: "none",
    boxSizing: "border-box"
  });
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const div = document.createElement("div");
    div.style.cssText = clone.style.cssText;
    div.style.whiteSpace = "pre-wrap";
    div.style.overflowWrap = "break-word";
    div.textContent = element.value;
    return div;
  }
  return clone;
}
var inputText = (input) => "value" in input ? input.value : input.innerText;
var sameText = (a, b) => a?.replace(/\r\n/g, "\n").trim() === b?.replace(/\r\n/g, "\n").trim();
var mix = (a, b, t) => a + (b - a) * t;
var smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
var MotionSurface = class {
  constructor(root, options, reduced, dock) {
    this.root = root;
    this.options = options;
    this.reduced = reduced;
    this.dock = dock;
    this.dead = false;
    this.generation = 0;
    this.animations = /* @__PURE__ */ new Set();
    this.nodes = /* @__PURE__ */ new Set();
    this.hiddenTargets = /* @__PURE__ */ new Map();
    this.claimed = new WeakSet([...root.querySelectorAll(SELECTORS.user)].flatMap((row) => [row, ...row.querySelectorAll(SELECTORS.bubble)]));
    this.timers = /* @__PURE__ */ new Map();
    this.queue = [];
    this.busy = false;
    this.seen = /* @__PURE__ */ new WeakSet();
    this.streams = /* @__PURE__ */ new Set();
    this.raf = 0;
    this.changed = /* @__PURE__ */ new Set();
    this.geometryFrame = 0;
    this.abort = new AbortController();
    root.classList.add("ld-surface");
    root.classList.toggle("ld-reduced", reduced);
    this.layer = document.createElement("div");
    this.layer.className = "ld-effects";
    this.layer.setAttribute("aria-hidden", "true");
    if (options.ambient) {
      const ambient = document.createElement("div");
      ambient.className = "ld-ambient";
      this.layer.append(ambient);
    }
    root.append(this.layer);
    this.captureInput();
    root.addEventListener("input", () => this.captureInput(), { capture: true, signal: this.abort.signal });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) this.captureInput();
    }, { capture: true, signal: this.abort.signal });
    root.addEventListener("pointerdown", () => this.captureInput(), { capture: true, signal: this.abort.signal });
    this.updateGeometry();
    this.resize = new ResizeObserver(() => this.scheduleGeometry());
    this.resize.observe(root);
    if (dock()) this.resize.observe(dock());
    window.addEventListener("resize", () => this.scheduleGeometry(), { signal: this.abort.signal });
    document.addEventListener("scroll", () => this.scheduleGeometry(), { capture: true, passive: true, signal: this.abort.signal });
    for (const block of root.querySelectorAll(BLOCKS)) this.seen.add(block);
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === this.layer || this.layer.contains(record.target)) continue;
        if (record.type === "attributes") this.changed.add(record.target);
        for (const node of record.addedNodes) if (elements(node)) this.changed.add(node);
        if (record.removedNodes.length && this.streams.size) this.pruneStreams();
      }
      const flight = this.messageFlight;
      if (flight && !flight.target.isConnected) {
        const replacement = this.findDestination(flight.submission);
        if (replacement) {
          flight.restore();
          this.claimed.add(replacement);
          flight.target = replacement;
          flight.refresh?.();
          flight.restore = this.hideTarget(replacement);
        }
      }
      if (this.changed.size) this.schedule();
    });
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-streaming"]
    });
    for (const stream of root.querySelectorAll(SELECTORS.stream)) this.changed.add(stream);
    this.schedule();
    document.addEventListener("visibilitychange", () => {
      root.classList.toggle("ld-paused", document.hidden);
      if (document.hidden) this.cancelFlight();
    }, { signal: this.abort.signal });
    root.classList.toggle("ld-paused", document.hidden);
  }
  scheduleGeometry() {
    if (!this.geometryFrame && !this.dead) this.geometryFrame = requestAnimationFrame(() => {
      this.geometryFrame = 0;
      this.updateGeometry();
    });
  }
  updateGeometry() {
    const rect = this.root.getBoundingClientRect(), dock = this.dock()?.getBoundingClientRect();
    const top = Math.max(0, Math.min(rect.top, dock?.top ?? rect.top));
    this.origin = { x: rect.left, y: top };
    Object.assign(this.layer.style, {
      left: `${rect.left}px`,
      top: `${top}px`,
      width: `${Math.max(0, rect.width)}px`,
      height: `${Math.max(0, Math.min(innerHeight, rect.bottom) - top)}px`
    });
  }
  schedule() {
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.scan();
    });
  }
  pruneStreams() {
    for (const el of this.streams) {
      if (!this.root.contains(el) || !el.matches(SELECTORS.stream)) {
        el.classList.remove("ld-stream");
        this.streams.delete(el);
      }
    }
  }
  scan() {
    if (this.dead) return;
    this.pruneStreams();
    const blocks = /* @__PURE__ */ new Set(), candidates = /* @__PURE__ */ new Set();
    for (const node of this.changed) {
      if (!this.root.contains(node)) continue;
      for (const stream of matchesIn(node, SELECTORS.stream)) candidates.add(stream);
      const parent = node.closest(SELECTORS.stream);
      if (parent) candidates.add(parent);
      for (const block of matchesIn(node, BLOCKS)) blocks.add(block);
    }
    this.changed.clear();
    for (const stream of candidates) {
      if (stream.closest("[data-chat-flow-kind]")?.getAttribute("data-chat-flow-kind")?.startsWith("assistant") !== true) continue;
      if (stream.parentElement?.closest(SELECTORS.stream)) continue;
      stream.classList.add("ld-stream");
      this.streams.add(stream);
    }
    for (const block of blocks) {
      const stream = block.closest(SELECTORS.stream);
      if (!stream || !this.streams.has(stream)) continue;
      if (this.seen.has(block)) continue;
      this.seen.add(block);
      if (block.parentElement?.closest("pre,ul,ol,table,blockquote")) continue;
      if (!this.reduced && visible(block)) this.animate(block, block.matches("p") ? [
        { opacity: 0.35, filter: "blur(3px)", transform: "translateY(2px)" },
        { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }
      ] : [{ opacity: 0.4, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], this.options.reveal);
    }
  }
  animate(el, frames, duration) {
    if (this.dead || this.reduced || !el.animate) return Promise.resolve();
    const animation = el.animate(frames, { duration, easing: EASING });
    this.animations.add(animation);
    return animation.finished.catch(() => {
    }).finally(() => this.animations.delete(animation));
  }
  delay(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        resolve();
      }, ms);
      this.timers.set(timer, resolve);
    });
  }
  submit(submission) {
    if (this.dead || document.hidden || !visible(this.root)) return;
    if (this.queue.length >= this.options.maxQueue) return;
    const input = this.root.querySelector(SELECTORS.input);
    if (input && sameText(inputText(input), submission.text)) this.captureInput();
    this.queue.push({ ...submission, visualSource: sameText(this.inputSnapshot?.text, submission.text) ? this.inputSnapshot : null });
    void this.drain();
  }
  findDestination(submission) {
    const candidates = [...this.root.querySelectorAll(submission.placement === "queued" ? "[data-queue-dock] [data-submission-echo], [data-queue-dock]" : SELECTORS.user)];
    const bubbles = [...new Set(candidates.map((el) => el.querySelector(SELECTORS.bubble) ?? el))];
    return bubbles.find((el) => !this.claimed.has(el) && visible(el) && (!submission.text || sameText(el.textContent, submission.text)));
  }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (!this.dead && this.queue.length) await this.flight(this.queue.shift());
    } finally {
      this.busy = false;
    }
  }
  hideTarget(target) {
    const hold = target.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "both" });
    this.hiddenTargets.set(target, hold);
    return () => {
      hold.cancel();
      this.hiddenTargets.delete(target);
    };
  }
  captureInput() {
    const input = this.root.querySelector(SELECTORS.input);
    if (!input || !visible(input) || !inputText(input)?.trim()) return;
    const rect = input.getBoundingClientRect();
    this.inputSnapshot = {
      text: inputText(input),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      copy: visualCopy(input),
      scrollTop: input.scrollTop,
      scrollLeft: input.scrollLeft
    };
  }
  async flight(submission) {
    const generation = this.generation;
    const input = this.root.querySelector(SELECTORS.input);
    if (!input || !visible(input)) return;
    let target = this.findDestination(submission);
    for (let attempt = 0; !target && attempt < 8 && !this.dead && generation === this.generation; attempt++) {
      await this.delay(50);
      target = this.findDestination(submission);
    }
    if (!target || this.dead || document.hidden || generation !== this.generation) return;
    this.claimed.add(target);
    const source = submission.visualSource;
    if (this.reduced || !source) {
      target.classList.add("ld-received");
      await this.delay(450);
      target.classList.remove("ld-received");
      return;
    }
    this.updateGeometry();
    const orb = document.createElement("div");
    orb.className = "ld-flight ld-message-flight";
    orb.dataset.ldPhase = "gather";
    orb.setAttribute("aria-hidden", "true");
    const core = document.createElement("div");
    core.className = "ld-flight-core";
    orb.append(core);
    const sourceWrap = document.createElement("div");
    sourceWrap.className = "ld-flight-copy";
    const sourceCopy = source.copy.cloneNode(true);
    sourceWrap.append(sourceCopy);
    orb.append(sourceWrap);
    const targetWrap = document.createElement("div");
    targetWrap.className = "ld-flight-copy";
    orb.append(targetWrap);
    this.layer.append(orb);
    this.nodes.add(orb);
    Object.assign(sourceCopy.style, { width: source.rect.width + "px", height: source.rect.height + "px" });
    sourceCopy.scrollTop = source.scrollTop;
    sourceCopy.scrollLeft = source.scrollLeft;
    const flight = { submission, target, restore: () => {
    }, refresh: () => {
      const copy = visualCopy(flight.target), rect = flight.target.getBoundingClientRect();
      Object.assign(copy.style, { width: rect.width + "px", height: rect.height + "px" });
      targetWrap.replaceChildren(copy);
      flight.copy = copy;
    } };
    flight.refresh();
    flight.restore = this.hideTarget(target);
    this.messageFlight = flight;
    const start = { x: source.rect.x + source.rect.width / 2, y: source.rect.y + source.rect.height / 2 };
    const gather = this.options.gather, travel = this.options.flight, settle = this.options.settle;
    const overlap = Math.min(60, gather / 4, settle / 4);
    const travelStart = gather - overlap, expandStart = travelStart + travel - overlap;
    const total = expandStart + settle, diameter = 18;
    let frame = 0, finish;
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    const cancel = () => {
      cancelAnimationFrame(frame);
      finish();
    };
    this.cancelMessageFrame = cancel;
    const started = performance.now();
    const tick = (now) => {
      if (this.dead || generation !== this.generation || !orb.isConnected || !visible(flight.target)) {
        finish();
        return;
      }
      const elapsed = Math.min(total, now - started);
      const g = smooth(elapsed / gather), e = smooth((elapsed - expandStart) / settle);
      const p = smooth((elapsed - travelStart) / travel);
      const rect = flight.target.getBoundingClientRect(), destination = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      Object.assign(flight.copy.style, { width: rect.width + "px", height: rect.height + "px" });
      const width = mix(mix(source.rect.width, diameter, g), rect.width, e);
      const height = mix(mix(source.rect.height, diameter, g), rect.height, e);
      const x = mix(start.x, destination.x, p), y = mix(start.y, destination.y, p);
      const computed = getComputedStyle(flight.target);
      const radius = parseFloat(computed.borderTopLeftRadius) || 0;
      Object.assign(orb.style, {
        left: x - this.origin.x + "px",
        top: y - this.origin.y + "px",
        width: width + "px",
        height: height + "px",
        borderRadius: mix(mix(0, diameter / 2, g), radius, e) + "px",
        background: "var(--ld-accent)",
        opacity: "1"
      });
      orb.dataset.ldPhase = elapsed < travelStart ? "gather" : elapsed < expandStart ? "travel" : "expand";
      const sourceScale = mix(1, diameter / Math.max(source.rect.width, source.rect.height), g);
      const targetScale = mix(diameter / Math.max(rect.width, rect.height), 1, e);
      Object.assign(sourceWrap.style, {
        width: source.rect.width + "px",
        height: source.rect.height + "px",
        transform: "translate(-50%,-50%) scale(" + sourceScale + ")",
        opacity: String(1 - smooth((g - 0.7) / 0.3))
      });
      Object.assign(targetWrap.style, {
        width: rect.width + "px",
        height: rect.height + "px",
        transform: "translate(-50%,-50%) scale(" + targetScale + ")",
        opacity: String(smooth(e / 0.38))
      });
      core.style.opacity = String(smooth(g) * (1 - e));
      if (elapsed >= total) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    try {
      tick(started);
      await done;
    } finally {
      cancelAnimationFrame(frame);
      flight.restore();
      if (this.messageFlight === flight) this.messageFlight = null;
      if (this.cancelMessageFrame === cancel) this.cancelMessageFrame = null;
      orb.remove();
      this.nodes.delete(orb);
    }
  }
  cancelFlight() {
    this.generation++;
    this.cancelMessageFrame?.();
    this.messageFlight = null;
    this.queue.length = 0;
    for (const hold of this.hiddenTargets.values()) hold.cancel();
    this.hiddenTargets.clear();
    for (const target of this.root.querySelectorAll(".ld-received")) target.classList.remove("ld-received");
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    for (const node of this.nodes) node.remove();
    this.nodes.clear();
    for (const [timer, resolve] of this.timers) {
      clearTimeout(timer);
      resolve();
    }
    this.timers.clear();
    this.root.classList.remove("ld-emitting");
    this.dock()?.classList.remove("ld-emitting", "ld-received");
  }
  dispose() {
    this.dead = true;
    this.observer.disconnect();
    this.resize.disconnect();
    this.abort.abort();
    cancelAnimationFrame(this.geometryFrame);
    this.changed.clear();
    cancelAnimationFrame(this.raf);
    this.cancelFlight();
    for (const el of this.streams) el.classList.remove("ld-stream");
    this.streams.clear();
    this.layer.remove();
    this.root.classList.remove("ld-surface", "ld-reduced", "ld-paused");
  }
};
function decorateSidebar(active, enabled, rows) {
  rows = [...rows].filter((row) => row.isConnected);
  for (const row of rows) {
    const selected = enabled && row.getAttribute("aria-selected") === "true";
    const running = enabled && active.has(row.dataset.rowKey.slice(8));
    row.classList.toggle("ld-row", selected || running);
    row.classList.toggle("ld-row-selected", selected);
    row.classList.toggle("ld-row-active", running);
    if (selected || running) {
      const phase = [...row.dataset.rowKey].reduce((hash, char) => hash * 31 + char.charCodeAt(0) >>> 0, 0) % 86;
      row.style.setProperty("--ld-glow-delay", `${-phase / 10}s`);
    } else row.style.removeProperty("--ld-glow-delay");
  }
}
var SidebarObserver = class {
  constructor() {
    this.rows = new Set(document.querySelectorAll(SELECTORS.sidebar));
    this.active = /* @__PURE__ */ new Set();
    this.enabled = false;
    this.frame = 0;
    this.observer = new MutationObserver((records) => {
      let dirty = false;
      for (const record of records) {
        if (record.type === "attributes" && record.target.matches(SELECTORS.sidebar)) dirty = true;
        if (record.type === "childList" && record.target.closest?.(SELECTORS.sidebar)) dirty = true;
        for (const node of record.addedNodes) {
          for (const row of matchesIn(node, SELECTORS.sidebar)) {
            this.rows.add(row);
            dirty = true;
          }
        }
        if ([...record.removedNodes].some(elements)) {
          for (const row of this.rows) if (!row.isConnected) {
            this.rows.delete(row);
            dirty = true;
          }
        }
      }
      if (dirty) this.schedule();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected"]
    });
    this.visibility = () => this.schedule();
    document.addEventListener("visibilitychange", this.visibility);
  }
  set(active, enabled) {
    this.active = active;
    this.enabled = enabled;
    this.schedule();
  }
  schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      decorateSidebar(this.active, this.enabled, this.rows);
      for (const row of this.rows) row.classList.toggle("ld-paused", document.hidden && this.enabled);
    });
  }
  dispose() {
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    document.removeEventListener("visibilitychange", this.visibility);
    this.rows.clear();
    clearSidebar();
  }
};
function clearSidebar() {
  for (const row of document.querySelectorAll(SELECTORS.sidebar)) {
    row.classList.remove("ld-row", "ld-row-active", "ld-row-selected", "ld-paused", "ld-row-position");
    row.style.removeProperty("--ld-glow-delay");
  }
}

// src/style.css
var style_default = ".ld-surface,.ld-dock{--ld-accent:#7b9fb7;--ld-ink:var(--dsw-alias-label-primary,#344454);--ld-bg:var(--dsw-alias-bg-base,#f7f9fa)}\n@property --ld-ax{syntax:'<percentage>';inherits:false;initial-value:8%}@property --ld-ay{syntax:'<percentage>';inherits:false;initial-value:14%}\n@property --ld-bx{syntax:'<percentage>';inherits:false;initial-value:78%}@property --ld-by{syntax:'<percentage>';inherits:false;initial-value:0%}\n@property --ld-cx{syntax:'<percentage>';inherits:false;initial-value:100%}@property --ld-cy{syntax:'<percentage>';inherits:false;initial-value:82%}\n:where(.ld-row){position:relative}\n.ld-row:before,.ld-row:after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(ellipse 28% 62% at var(--ld-ax) var(--ld-ay),#65cafaaf 0%,#65cafa66 35%,transparent 76%),radial-gradient(ellipse 31% 70% at var(--ld-bx) var(--ld-by),#ae8ce8aa 0%,#ae8ce855 40%,transparent 77%),radial-gradient(ellipse 35% 75% at var(--ld-cx) var(--ld-cy),#f0a2c69c 0%,#f0a2c64d 42%,transparent 78%);mask-image:linear-gradient(to right,#000,transparent 19px),linear-gradient(to left,#000,transparent 19px),linear-gradient(to bottom,#000,transparent 14px),linear-gradient(to top,#000,transparent 14px);mask-composite:add,add,add;animation:ld-aurora-path 8.6s ease-in-out infinite;animation-delay:var(--ld-glow-delay,0s);filter:blur(3px)}\n.ld-row:after{animation-duration:12.4s;animation-direction:reverse;filter:blur(9px);opacity:.68}\n.ld-row-active:before{animation-duration:6.8s}.ld-row-active:after{animation-duration:9.7s}.ld-row-active:not(.ld-row-selected):before,.ld-row-active:not(.ld-row-selected):after{opacity:.68}\n@keyframes ld-aurora-path{0%,100%{--ld-ax:8%;--ld-ay:14%;--ld-bx:78%;--ld-by:0%;--ld-cx:100%;--ld-cy:82%}25%{--ld-ax:42%;--ld-ay:0%;--ld-bx:100%;--ld-by:44%;--ld-cx:54%;--ld-cy:100%}50%{--ld-ax:100%;--ld-ay:20%;--ld-bx:65%;--ld-by:100%;--ld-cx:0%;--ld-cy:72%}75%{--ld-ax:72%;--ld-ay:100%;--ld-bx:0%;--ld-by:52%;--ld-cx:40%;--ld-cy:0%}}\n.ld-effects{position:fixed;z-index:1;pointer-events:none;overflow:hidden;contain:layout paint}\n.ld-ambient{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,#839fba0c,transparent 65%),radial-gradient(ellipse at 80% 75%,#9990af09,transparent 60%);animation:ld-ambient 24s ease-in-out infinite alternate}@keyframes ld-ambient{from{opacity:.55}to{opacity:1}}\n.ld-dock{display:flex;align-items:center;position:relative;min-width:0;flex-shrink:0;color:var(--ld-ink)}\n.ld-capsule{font:inherit;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:36px;min-width:78px;padding:0 6px;border:0;border-radius:999px;background:transparent;color:inherit;cursor:pointer;overflow:visible}\n.ld-capsule:hover{background:transparent}.ld-capsule:focus-visible,.ld-settings-button:focus-visible,.ld-settings button:focus-visible{outline:2px solid var(--ld-accent);outline-offset:3px}\n.ld-orbs{position:relative;display:block;width:66px;height:32px;flex:none;pointer-events:none}\n.ld-orb-wrap{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;transform:translateX(var(--ld-home-x));will-change:transform}\n.ld-orb{position:relative;display:block;width:12px;height:12px;border:0;box-shadow:none;overflow:visible}.ld-orb-body{position:absolute;inset:0;display:block;border-radius:50%;background:var(--ld-color)}\n.ld-orb i{display:block;position:absolute;left:4px;top:-1px;width:3.5px;height:3.5px;border-radius:50%;background:var(--ld-color);opacity:0;pointer-events:none}.ld-working i{animation:ld-boil 1.25s ease-in-out infinite}.ld-working i:nth-child(2){left:8px;width:3px;height:3px;animation-delay:-.42s}.ld-working i:nth-child(3){left:1px;width:2.5px;height:2.5px;animation-delay:-.84s}\n@keyframes ld-boil{0%,8%{opacity:0;transform:translate(0,2px) scale(.4)}20%{opacity:1;transform:translate(0,-2px) scale(1.1)}60%{opacity:1}90%,100%{opacity:0;transform:translate(2px,-15px) scale(.2)}}\n.ld-orbits-2 .ld-orb-wrap[data-ld-active=true]{animation:ld-binary-orbit 5.6s linear infinite;animation-delay:var(--ld-orbit-delay)}\n.ld-orbits-3 .ld-orb-wrap[data-ld-active=true]{animation:ld-three-body 8.4s linear infinite;animation-delay:var(--ld-orbit-delay)}\n@keyframes ld-binary-orbit{0%,100%{transform:translate(17px,0) scale(1);z-index:2}12.5%{transform:translate(12px,4px) scale(1.04);z-index:3}25%{transform:translate(0,6px) scale(1.08);z-index:3}37.5%{transform:translate(-12px,4px) scale(1.04);z-index:3}50%{transform:translate(-17px,0) scale(1);z-index:2}62.5%{transform:translate(-12px,-4px) scale(.96);z-index:1}75%{transform:translate(0,-6px) scale(.92);z-index:1}87.5%{transform:translate(12px,-4px) scale(.96);z-index:1}}\n@keyframes ld-three-body{0%,100%{transform:translate(0,0) scale(1.07);z-index:3}12.5%{transform:translate(14px,6px) scale(1.04);z-index:3}25%{transform:translate(20px,0) scale(1);z-index:2}37.5%{transform:translate(14px,-6px) scale(.95);z-index:1}50%{transform:translate(0,0) scale(.92);z-index:1}62.5%{transform:translate(-14px,6px) scale(.95);z-index:1}75%{transform:translate(-20px,0) scale(1);z-index:2}87.5%{transform:translate(-14px,-6px) scale(1.04);z-index:3}}\n.ld-task-list{position:absolute;right:0;top:calc(100% + 9px);z-index:100;width:300px;max-width:calc(100vw - 24px);max-height:min(340px,65vh);overflow:auto;padding:16px;border:1px solid color-mix(in srgb,var(--ld-ink) 18%,transparent);border-radius:14px;background:var(--ld-bg);color:var(--ld-ink);box-shadow:0 12px 36px #20304722;font-size:12px;line-height:1.7}.ld-task-list ul{padding:0;margin:10px 0;list-style:none}.ld-task-list li{display:flex;align-items:baseline;gap:9px;padding:7px 0;overflow-wrap:anywhere}.ld-identity{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}\n.ld-settings-button{font:inherit;appearance:none;background:transparent;border:1px solid #91a9ba55;border-radius:8px;padding:6px 10px;color:inherit;cursor:pointer}\n.ld-settings{position:fixed;inset:0;margin:auto;width:330px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;gap:15px;padding:24px;border:1px solid #b6c2d180;border-radius:20px;background:var(--ld-bg);color:var(--ld-ink);box-shadow:0 24px 80px #20304730;font:13px/1.6 system-ui}.ld-settings::backdrop{background:#18253626}.ld-settings label{display:flex;align-items:center;gap:8px}.ld-settings input{accent-color:#7b9fb7}.ld-settings small{opacity:.75}.ld-settings button{font:inherit;color:inherit;background:transparent;border:1px solid #91a9ba55;border-radius:6px;padding:5px}\n.ld-flight{position:absolute;width:18px;height:18px;border-radius:50%;transform:translate(-50%,-50%);background:var(--ld-accent);pointer-events:none;overflow:visible;box-sizing:border-box}.ld-message-flight{background:transparent!important}.ld-flight-copy{position:absolute;left:50%;top:50%;transform-origin:center;pointer-events:none;overflow:hidden}.ld-flight-core{position:absolute;inset:0;border-radius:inherit;background:conic-gradient(from var(--ld-flow-angle),#57c9e8,#8a7bdf,#ee8ac8,#f3b86a,#65cfae,#57c9e8);box-shadow:0 0 10px 2px #9b94d766;animation:ld-message-flow .65s linear infinite}@property --ld-flow-angle{syntax:'<angle>';inherits:false;initial-value:0deg}@keyframes ld-message-flow{to{--ld-flow-angle:360deg}}\n.ld-stream:after{content:'';display:inline-block;vertical-align:middle;width:5px;height:5px;margin:0 0 3px 3px;border-radius:50%;background:var(--ld-accent);box-shadow:0 0 7px 2px #7b9fb740;animation:ld-breathe 4.2s ease-in-out infinite}@keyframes ld-breathe{0%,100%{opacity:.65}50%{opacity:1}}.ld-received{outline:1px solid #7b9fb780;outline-offset:2px}\n.ld-paused,.ld-paused *,.ld-paused:before,.ld-paused:after,.ld-paused *:before,.ld-paused *:after{animation-play-state:paused!important}.ld-reduced *{animation:none!important;transition:none!important}.ld-reduced .ld-orb i{display:none}\n@media(prefers-reduced-motion:reduce){.ld-row:before,.ld-row:after,.ld-dock *,.ld-ambient,.ld-stream:after{animation:none!important;transition:none!important}.ld-orb i{display:none}.ld-flight{display:none}}\n@media(forced-colors:active){.ld-row:before,.ld-row:after{background:Highlight;animation:none}.ld-orb-body{background:ButtonText;border:1px solid ButtonText}.ld-orb i{display:none}.ld-capsule{border:0;background:Canvas;color:ButtonText}.ld-flight-core{background:Highlight;animation:none}.ld-ambient{display:none}}\n@media(max-width:600px){.ld-capsule{height:34px;padding:0 5px;min-width:74px}.ld-orbs{width:64px}}\n";

// src/client.js
var name = "lingdong";
var inject = ["slots", "uiSession", "uiConversation"];
var h = import_react.default.createElement;
var STORAGE = "dsh-lingdong.preferences.v4";
function preferences() {
  let saved;
  try {
    const stored = localStorage.getItem(STORAGE);
    saved = JSON.parse(stored || "{}");
    if (!stored) {
      const old = JSON.parse(localStorage.getItem("dsh-lingdong.preferences.v3") || localStorage.getItem("dsh-lingdong.preferences.v2") || localStorage.getItem("dsh-lingdong.preferences.v1") || "{}");
      saved = { enabled: old?.enabled, ambient: old?.ambient, aggregate: old?.aggregate };
    }
  } catch {
    saved = {};
  }
  let value = normalizeOptions(saved);
  const listeners = /* @__PURE__ */ new Set();
  return {
    getSnapshot: () => value,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    update(patch) {
      value = normalizeOptions({ ...value, ...patch });
      try {
        localStorage.setItem(STORAGE, JSON.stringify(value));
      } catch {
      }
      for (const callback of listeners) callback();
    }
  };
}
function apply(ctx) {
  const prefs = preferences();
  const docks = /* @__PURE__ */ new Map();
  const sessionColors = /* @__PURE__ */ new Map();
  const surfaces = /* @__PURE__ */ new Set();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const motionSource = {
    getSnapshot: () => media.matches,
    subscribe: (callback) => {
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    }
  };
  const usePrefs = () => (0, import_react.useSyncExternalStore)(prefs.subscribe, prefs.getSnapshot);
  const useReduced = () => (0, import_react.useSyncExternalStore)(motionSource.subscribe, motionSource.getSnapshot);
  const visibilitySource = {
    getSnapshot: () => document.hidden,
    subscribe: (callback) => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    }
  };
  function Orb({ row, color, index, active, rank, reduced }) {
    const wrap = (0, import_react.useRef)(null);
    (0, import_react.useLayoutEffect)(() => {
      const element = wrap.current;
      if (!element || !row?.exiting || reduced) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const home = (index - 1) * 20;
      element.style.animation = "none";
      const animation = element.animate([
        { transform: `translate(${matrix.m41}px,${matrix.m42}px)` },
        { transform: `translate(${(matrix.m41 + home) / 2}px,${matrix.m42 - 9}px)`, offset: 0.56 },
        { transform: `translate(${home}px,0px)` }
      ], { duration: prefs.getSnapshot().dissolve, easing: EASING, fill: "forwards" });
      return () => {
        animation.cancel();
        element.style.animation = "";
      };
    }, [row?.id, row?.exiting, reduced]);
    return h(
      "span",
      {
        ref: wrap,
        className: "ld-orb-wrap",
        "data-ld-active": String(active),
        style: { "--ld-color": color, "--ld-home-x": `${(index - 1) * 20}px`, "--ld-orbit-delay": `${-rank * 2.8}s` },
        title: row ? agentLabel(row) : "空闲"
      },
      h(
        "span",
        { className: `ld-orb ld-${row?.state ?? "idle"}`, "data-agent-id": row?.id ?? "", "aria-hidden": true },
        h("span", { className: "ld-orb-body" }),
        ...Array.from({ length: 3 }, (_, index2) => h("i", { key: index2 }))
      )
    );
  }
  function Dock(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions((state) => state);
    const statuses = props.useSessionStatus((state) => state);
    const capsuleRef = (0, import_react.useRef)(null);
    const marker = (0, import_react.useRef)(null), model = (0, import_react.useRef)(/* @__PURE__ */ new Map()), initialized = (0, import_react.useRef)(false);
    const exitTimers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const settingsRef = (0, import_react.useRef)(null), settingsTrigger = (0, import_react.useRef)(null);
    const dialogId = (0, import_react.useId)(), orbsId = (0, import_react.useId)();
    const paused = (0, import_react.useSyncExternalStore)(visibilitySource.subscribe, visibilitySource.getSnapshot);
    const [rows, setRows] = (0, import_react.useState)([]), [expanded, setExpanded] = (0, import_react.useState)(false), [settings, setSettings] = (0, import_react.useState)(false);
    (0, import_react.useEffect)(() => {
      if (!expanded || settings) return;
      const close = (event) => {
        if (event.type === "keydown" && event.key !== "Escape") return;
        if (event.type === "pointerdown" && marker.current?.contains(event.target)) return;
        setExpanded(false);
        if (event.type === "keydown") capsuleRef.current?.focus();
      };
      document.addEventListener("pointerdown", close);
      document.addEventListener("keydown", close);
      return () => {
        document.removeEventListener("pointerdown", close);
        document.removeEventListener("keydown", close);
      };
    }, [expanded, settings]);
    (0, import_react.useLayoutEffect)(() => {
      const dialog = settingsRef.current, trigger = settingsTrigger.current;
      if (!settings || !dialog) return;
      dialog.showModal();
      dialog.querySelector("input")?.focus();
      return () => {
        dialog.close();
        if (trigger?.isConnected) trigger.focus();
      };
    }, [settings]);
    (0, import_react.useLayoutEffect)(() => {
      const element = marker.current;
      docks.set(props.sessionId, element);
      return () => {
        if (docks.get(props.sessionId) === element) docks.delete(props.sessionId);
      };
    }, [props.sessionId]);
    (0, import_react.useEffect)(() => {
      model.current = /* @__PURE__ */ new Map();
      initialized.current = false;
      setRows([]);
      return () => {
        for (const timer of exitTimers.current.values()) clearTimeout(timer);
        exitTimers.current.clear();
      };
    }, [props.sessionId]);
    (0, import_react.useEffect)(() => {
      model.current = reconcileAgents(model.current, agentRows(props.sessionId, list, statuses), initialized.current);
      initialized.current = true;
      const all = [...model.current.values()];
      const colors = assignColors(all, sessionColors.get(props.sessionId));
      const cache = sessionColors.get(props.sessionId) ?? /* @__PURE__ */ new Map();
      for (const [id, color] of colors) cache.set(id, color);
      sessionColors.set(props.sessionId, cache);
      for (const row of all) row.color = colors.get(row.id);
      setRows(all);
    }, [props.sessionId, list, statuses]);
    function remove(id) {
      if (!model.current.get(id)?.exiting) return;
      model.current.delete(id);
      setRows([...model.current.values()]);
    }
    (0, import_react.useEffect)(() => {
      for (const [id, timer] of exitTimers.current) {
        if (!model.current.get(id)?.exiting) {
          clearTimeout(timer);
          exitTimers.current.delete(id);
        }
      }
      for (const row of rows) if (row.exiting && !exitTimers.current.has(row.id)) {
        exitTimers.current.set(row.id, setTimeout(() => {
          exitTimers.current.delete(row.id);
          remove(row.id);
        }, reduced ? 0 : options.dissolve));
      }
    }, [rows, reduced, options.dissolve]);
    const displayed = AGENT_COLORS.map((color) => rows.find((row) => row.color === color && row.state === "working") ?? rows.find((row) => row.color === color && row.exiting) ?? rows.find((row) => row.color === color) ?? null);
    const activeColors = displayed.map((row, index) => row && (row.state === "working" || row.exiting) ? index : -1).filter((index) => index >= 0);
    const catalog = list.projectionsBySession?.[props.sessionId]?.values?.subagentCatalog ?? list.byId?.[props.sessionId]?.projectionValues?.subagentCatalog;
    return h(
      "div",
      {
        ref: marker,
        className: `ld-dock${reduced ? " ld-reduced" : ""}${paused ? " ld-paused" : ""}`,
        "data-ld-session": props.sessionId,
        "aria-label": "灵动对话状态区"
      },
      h(
        "button",
        {
          ref: capsuleRef,
          type: "button",
          className: "ld-capsule",
          "aria-label": options.enabled && rows.length ? `查看 ${rows.length} 个子 Agent` : "灵动：查看子 Agent",
          "aria-controls": `${orbsId}-tasks`,
          "aria-expanded": expanded,
          onClick: () => setExpanded(!expanded)
        },
        options.enabled && h(
          "span",
          { id: orbsId, className: `ld-orbs ld-orbits-${activeColors.length}`, "aria-hidden": true },
          displayed.map((row, index) => h(Orb, {
            key: AGENT_COLORS[index],
            row,
            color: AGENT_COLORS[index],
            index,
            active: activeColors.includes(index),
            rank: activeColors.indexOf(index),
            reduced
          }))
        )
      ),
      expanded && h(
        "div",
        { id: `${orbsId}-tasks`, className: "ld-task-list", role: "region", "aria-label": "子 Agent 状态" },
        h("strong", null, `${rows.length} 个子 Agent`),
        rows.length ? h("ul", null, rows.map((row) => h(
          "li",
          { key: row.id },
          h("span", { className: "ld-identity", style: { background: row.color }, "aria-hidden": true }),
          agentLabel(row)
        ))) : h("p", null, "当前没有子 Agent"),
        h("button", {
          ref: settingsTrigger,
          type: "button",
          className: "ld-settings-button",
          "aria-haspopup": "dialog",
          "aria-controls": dialogId,
          "aria-expanded": settings,
          onClick: () => setSettings(true)
        }, "灵动动效设置")
      ),
      settings && h(
        "dialog",
        {
          ref: settingsRef,
          id: dialogId,
          className: "ld-settings",
          "aria-labelledby": `${dialogId}-title`,
          onCancel: (event) => {
            event.preventDefault();
            setSettings(false);
          },
          onClick: (event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSettings(false);
          }
        },
        h("strong", { id: `${dialogId}-title` }, "灵动动效设置"),
        ...[["enabled", "启用动效"], ["ambient", "背景氛围"]].map(([key, label]) => h("label", { key }, h("input", { type: "checkbox", checked: options[key], onChange: (event) => prefs.update({ [key]: event.target.checked }) }), label)),
        h("small", null, reduced ? "系统已开启减少动态效果：使用静态状态。" : "状态来自 DSH；不额外调用模型。"),
        h("small", null, "双球相互环绕；三球交错运行；4 个及以上子 Agent 显示 3 个代表球，点击胶囊查看完整列表。"),
        h("small", { className: "ld-catalog-status" }, catalog === void 0 ? "当前会话的子 agent 目录尚未就绪。" : `当前会话：${catalog.length} 个子 agent，${rows.filter((row) => row.state === "working").length} 个运行中。`),
        h("button", { type: "button", onClick: () => setSettings(false) }, "关闭")
      )
    );
  }
  function Surface(props) {
    const marker = (0, import_react.useRef)(null), surface = (0, import_react.useRef)(null), pendingIds = (0, import_react.useRef)(/* @__PURE__ */ new Set());
    const options = usePrefs(), reduced = useReduced();
    const pending = props.useSession((state) => state.pendingSubmissions);
    const error = props.useSession((state) => state.promptError);
    (0, import_react.useLayoutEffect)(() => {
      pendingIds.current = new Set(pending.map((x) => x.requestId));
      const root = marker.current?.closest(SELECTORS.conversation);
      if (!root || !options.enabled) return;
      const instance = new MotionSurface(root, options, reduced, () => docks.get(props.sessionId));
      surface.current = instance;
      surfaces.add(instance);
      return () => {
        instance.dispose();
        surfaces.delete(instance);
        surface.current = null;
      };
    }, [props.sessionId, options, reduced]);
    (0, import_react.useLayoutEffect)(() => {
      const current = new Set(pending.map((x) => x.requestId));
      for (const item of pending) if (!pendingIds.current.has(item.requestId)) surface.current?.submit(item);
      pendingIds.current = current;
    }, [pending]);
    (0, import_react.useEffect)(() => {
      if (error?.op === "send") surface.current?.cancelFlight();
    }, [error]);
    return h("span", { ref: marker, hidden: true, "data-ld-observer": "" });
  }
  function Sidebar(props) {
    const options = usePrefs();
    const list = props.useSessions((state) => state), statuses = props.useSessionStatus((state) => state);
    const active = (0, import_react.useMemo)(() => activeSessions(list, statuses), [list, statuses]);
    const observer = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      const instance = new SidebarObserver();
      observer.current = instance;
      return () => {
        instance.dispose();
        observer.current = null;
      };
    }, []);
    (0, import_react.useEffect)(() => {
      observer.current?.set(active, options.enabled);
    }, [active, options.enabled]);
    return null;
  }
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-lingdong";
    style.textContent = style_default;
    document.head.append(style);
    return () => {
      for (const surface of surfaces) surface.dispose();
      surfaces.clear();
      docks.clear();
      sessionColors.clear();
      clearSidebar();
      style.remove();
    };
  });
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "lingdong-dock",
    order: 20
  }, Dock));
  ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
    name: "conversation.input.overlay",
    id: "lingdong-surface",
    order: 20
  }, Surface));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "lingdong-sidebar",
    order: 20
  }, Sidebar));
}
return module.exports;}});
