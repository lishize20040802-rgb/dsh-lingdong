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
  flight: 1850,
  gather: 580,
  settle: 900,
  taskFlight: 2200,
  reveal: 420,
  dissolve: 550,
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
  for (const key of ["flight", "gather", "settle", "taskFlight", "reveal", "dissolve"]) {
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
function activeSessions(list, statuses, jobsBySession = {}) {
  const active = /* @__PURE__ */ new Set();
  for (const [id, row] of Object.entries(list.byId ?? {})) {
    if ((statuses.get(id)?.running ?? row.running) === true) active.add(id);
  }
  for (const [id, status] of statuses) if (status.running === true) active.add(id);
  for (const [id, jobs] of Object.entries(jobsBySession)) {
    if (jobs.some((job) => job.owner === id && (job.status === "running" || job.status === "stopping"))) active.add(id);
  }
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
function taskRows(sessionId, list, statuses, jobs = []) {
  return [...agentRows(sessionId, list, statuses), ...jobs.map((job) => ({
    id: "job:" + job.id,
    title: (job.kind === "subagent" ? "后台子代理" : "后台任务") + " · " + (job.label || job.id),
    state: ["running", "stopping"].includes(job.status) ? "working" : "completed",
    statusText: { running: "运行中", stopping: "正在停止", completed: "已完成", failed: "失败", killed: "已停止" }[job.status] || job.status,
    progress: job.progress || job.detail,
    kind: job.kind
  }))];
}

// src/motion.js
var SELECTORS = Object.freeze({
  conversation: "[data-conversation-content][data-conversation-session]",
  input: "[data-composer-input]",
  user: '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-submission-echo]',
  assistant: '[data-chat-flow-kind="assistant-step"]',
  stream: '[data-streaming="true"]',
  sidebar: '[data-row-key^="session:"][role="treeitem"]'
});
var center = (element) => {
  const r = element.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
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
    this.claimed = new WeakSet(root.querySelectorAll(SELECTORS.user));
    this.taskFlights = /* @__PURE__ */ new Set();
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
    this.queue.push(submission);
    void this.drain();
  }
  findDestination(submission) {
    const candidates = [...this.root.querySelectorAll(submission.placement === "queued" ? "[data-queue-dock] [data-submission-echo], [data-queue-dock]" : SELECTORS.user)];
    return candidates.reverse().find((el) => !this.claimed.has(el) && visible(el) && (!submission.text || el.textContent.includes(submission.text.slice(0, 48))));
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
    if (this.reduced) {
      target.classList.add("ld-received");
      await this.delay(450);
      target.classList.remove("ld-received");
      return;
    }
    const orb = document.createElement("div");
    orb.className = "ld-flight";
    orb.dataset.ldPhase = "gather";
    orb.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = submission.text.slice(0, 180) || "附件";
    this.updateGeometry();
    const start = center(input), inputRect = input.getBoundingClientRect();
    orb.append(text);
    this.layer.append(orb);
    this.nodes.add(orb);
    const place = (point) => {
      orb.style.left = point.x - this.origin.x + "px";
      orb.style.top = point.y - this.origin.y + "px";
    };
    place(start);
    const flight = { submission, target, restore: this.hideTarget(target) };
    this.messageFlight = flight;
    try {
      await this.animate(orb, [
        { width: Math.min(inputRect.width, 360) + "px", height: "40px", borderRadius: "14px", opacity: 0.95 },
        { width: "22px", height: "22px", borderRadius: "50%", opacity: 1 }
      ], this.options.gather);
      text.remove();
      target = flight.target;
      if (!orb.isConnected || this.dead || !visible(target)) return;
      const destination = center(target), dx = destination.x - start.x, dy = destination.y - start.y;
      orb.dataset.ldPhase = "travel";
      await this.animate(orb, [
        { transform: "translate(-50%,-50%) scale(1)" },
        { transform: "translate(calc(-50% + " + dx * 0.42 + "px),calc(-50% + " + dy * 0.55 + "px)) scale(.94,1.08)", offset: 0.48 },
        { transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(1)" }
      ], this.options.flight);
      target = flight.target;
      if (!orb.isConnected || this.dead || !visible(target)) return;
      place(center(target));
      orb.dataset.ldPhase = "expand";
      const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
      await this.animate(orb, [
        { width: "22px", height: "22px", borderRadius: "50%", opacity: 1 },
        { width: Math.min(rect.width, this.root.clientWidth) + "px", height: Math.min(rect.height, 160) + "px", borderRadius: style.borderRadius || "16px", opacity: 0.15 }
      ], this.options.settle * 0.65);
      target = flight.target;
      flight.restore();
      if (orb.isConnected && target.isConnected) await Promise.all([
        this.animate(orb, [{ opacity: 0.15 }, { opacity: 0 }], this.options.settle * 0.35),
        this.animate(target, [{ opacity: 0, transform: "scale(.975)" }, { opacity: 1, transform: "scale(1)" }], this.options.settle * 0.35)
      ]);
    } finally {
      flight.restore();
      if (this.messageFlight === flight) this.messageFlight = null;
      orb.remove();
      this.nodes.delete(orb);
    }
  }
  emitTask(element) {
    if (this.dead || this.reduced || document.hidden || !visible(element)) return;
    const source = [...this.root.querySelectorAll("[data-chat-flow-kind]")].reverse().find((el) => el.getAttribute("data-chat-flow-kind")?.startsWith("assistant") && visible(el));
    if (!source) return;
    this.updateGeometry();
    const from = source.getBoundingClientRect(), to = center(element);
    const start = { x: Math.min(from.right - 12, from.left + Math.min(from.width * 0.4, 160)), y: Math.max(this.origin.y + 14, Math.min(from.bottom - 14, innerHeight - 14)) };
    const orb = document.createElement("div");
    orb.className = "ld-flight ld-task-flight";
    orb.setAttribute("aria-hidden", "true");
    orb.style.left = start.x - this.origin.x + "px";
    orb.style.top = start.y - this.origin.y + "px";
    this.layer.append(orb);
    const hidden = element.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "both" });
    const dx = to.x - start.x, dy = to.y - start.y;
    const animation = orb.animate([
      { opacity: 0, transform: "translate(-50%,-50%) scale(.4)" },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.15 },
      { opacity: 1, transform: "translate(calc(-50% + " + dx * 0.5 + "px),calc(-50% + " + dy * 0.65 + "px)) scale(.93,1.08)", offset: 0.55 },
      { opacity: 1, transform: "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(1)" }
    ], { duration: this.options.taskFlight, easing: EASING });
    const cleanup = () => {
      animation.cancel();
      hidden.cancel();
      orb.remove();
      this.taskFlights.delete(cleanup);
    };
    this.taskFlights.add(cleanup);
    animation.finished.then(cleanup, cleanup);
    return cleanup;
  }
  cancelFlight() {
    this.generation++;
    this.messageFlight = null;
    this.queue.length = 0;
    for (const hold of this.hiddenTargets.values()) hold.cancel();
    this.hiddenTargets.clear();
    for (const target of this.root.querySelectorAll(".ld-received")) target.classList.remove("ld-received");
    for (const cleanup of this.taskFlights) cleanup();
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
  }
}
var SidebarObserver = class {
  constructor(watchRows) {
    this.watchRows = watchRows;
    this.watches = /* @__PURE__ */ new Map();
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
      const ids = new Set(this.enabled ? [...this.rows].map((row) => row.dataset.rowKey.slice(8)) : []);
      for (const [id, dispose] of this.watches) if (!ids.has(id)) {
        dispose();
        this.watches.delete(id);
      }
      for (const id of ids) if (!this.watches.has(id) && this.watchRows) this.watches.set(id, this.watchRows(id));
      for (const row of this.rows) row.classList.toggle("ld-paused", document.hidden && this.enabled);
    });
  }
  dispose() {
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    for (const dispose of this.watches.values()) dispose();
    this.watches.clear();
    document.removeEventListener("visibilitychange", this.visibility);
    this.rows.clear();
    clearSidebar();
  }
};
function clearSidebar() {
  for (const row of document.querySelectorAll(SELECTORS.sidebar)) row.classList.remove("ld-row", "ld-row-active", "ld-row-selected", "ld-paused");
}

// src/style.css
var style_default = '.ld-surface,.ld-dock{--ld-accent:#7b9fb7;--ld-soft:#aaa4b7;--ld-ease:cubic-bezier(.22,.75,.25,1);--ld-breathe:4.2s;--ld-ink:var(--dsw-alias-label-primary,#344454)}\n\n/* Two slowly drifting color fields fill the existing row; text and controls keep their host colors. */\n.ld-row{position:relative;isolation:isolate;border-radius:10px}\n.ld-row:before,.ld-row:after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;overflow:hidden;background:radial-gradient(ellipse at 15% 35%,#7ca8f355,transparent 65%),radial-gradient(ellipse at 80% 65%,#b993ef50,transparent 65%),linear-gradient(110deg,#82c6df25,#dca9cb30);animation:ld-row-flow 9s ease-in-out infinite alternate;transform-origin:center}\n.ld-row:after{background:radial-gradient(ellipse at 75% 20%,#86d7ca55,transparent 65%),radial-gradient(ellipse at 20% 80%,#e5b48950,transparent 65%);animation:ld-row-flow-back 12s ease-in-out infinite alternate}\n.ld-row-selected:before{background:radial-gradient(ellipse at 15% 35%,#86b9f568,transparent 65%),radial-gradient(ellipse at 80% 65%,#c0a2f068,transparent 65%),linear-gradient(110deg,#a0c7e840,#c4ade944);animation-duration:14s}\n.ld-row-selected:after{background:radial-gradient(ellipse at 70% 30%,#efbbd255,transparent 70%),radial-gradient(ellipse at 25% 75%,#93cdd652,transparent 65%);animation-duration:17s}\n.ld-row-active:not(.ld-row-selected):before{background:radial-gradient(ellipse at 15% 35%,#68c9bf68,transparent 65%),radial-gradient(ellipse at 80% 65%,#e4b47265,transparent 65%),linear-gradient(110deg,#90becc30,#bdacdc35)}\n.ld-row-selected.ld-row-active:after{animation-duration:9s}\n@keyframes ld-row-flow{0%{transform:translateX(-2%) scale(.96,1);opacity:.55}50%{transform:translateX(1%) scale(.98,.96);opacity:1}100%{transform:translateX(2%) scale(.96,1);opacity:.72}}\n@keyframes ld-row-flow-back{0%{transform:translateX(2%) scale(.96,.96);opacity:.85}100%{transform:translateX(-2%) scale(.96,1);opacity:.25}}\n.ld-effects{position:fixed;z-index:1;pointer-events:none;overflow:hidden;contain:layout paint}\n.ld-ambient{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,#839fba0c,transparent 65%),radial-gradient(ellipse at 80% 75%,#9990af09,transparent 60%);animation:ld-ambient 24s ease-in-out infinite alternate}\n.ld-dock{display:flex;align-items:center;gap:8px;position:relative;min-width:26px;max-width:min(42vw,380px);min-height:28px;flex-shrink:1}\n.ld-dock-line{position:absolute;inset:auto 0 -3px;height:1px;overflow:hidden;opacity:.45;pointer-events:none}\n.ld-dock-line:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,#8bb4ca,#b2a0cc,#deb5bb,transparent)}\n.ld-dock-line.ld-live:after{animation:ld-sheen 6s ease-in-out infinite alternate}\n@keyframes ld-sheen{from{transform:translateX(-30%);opacity:.45}to{transform:translateX(30%);opacity:.9}}\n.ld-orbs{display:flex;align-items:center;gap:9px;min-width:0;flex-wrap:wrap;max-height:90px;overflow-y:auto;padding:5px}\n.ld-orb-wrap{display:inline-flex}\n.ld-orb{position:relative;appearance:none;display:inline-block;width:24px;height:24px;border-radius:50%;border:1px solid #91a9ba80;background:radial-gradient(ellipse at 30% 22%,#ffffffed,transparent 38%),radial-gradient(ellipse at 70% 78%,#d9b7d68c,transparent 65%),linear-gradient(145deg,#bddeedb3,#a7b8d345);padding:0;color:inherit;cursor:help;flex-shrink:0}\n.ld-orb:focus-visible,.ld-stack:focus-visible,.ld-settings-button:focus-visible{outline:2px solid var(--ld-accent);outline-offset:3px}\n.ld-queued{opacity:.55}\n.ld-working{animation:ld-breathe var(--ld-breathe) ease-in-out infinite;box-shadow:inset 0 -2px 5px #839dbc40,inset 0 1px 2px #fff9,0 2px 7px #6b86a329}\n.ld-orb i{position:absolute;left:6px;bottom:4px;width:3px;height:3px;border:1px solid #9db9c5aa;border-radius:50%;opacity:0;pointer-events:none}\n.ld-working i{animation:ld-bubble var(--ld-breathe) ease-in-out infinite}\n.ld-working i:nth-child(2){left:11px;animation-delay:1.4s;width:2px;height:2px}\n.ld-working i:nth-child(3){left:3px;animation-delay:2.8s;width:2px;height:2px}\n.ld-tooltip{display:none;position:absolute;top:calc(100% + 9px);left:0;z-index:100;max-width:min(340px,80vw);white-space:normal;overflow-wrap:anywhere;padding:9px 12px;border-radius:10px;background:var(--dsw-alias-bg-base,#f7f9fa);color:var(--ld-ink);border:1px solid #879eaa55;box-shadow:0 8px 24px #0002;font-size:12px;line-height:1.6;pointer-events:none}\n.ld-orb-wrap:hover .ld-tooltip,.ld-orb-wrap:focus-within .ld-tooltip{display:block}\n.ld-stack,.ld-settings-button{font:inherit;appearance:none;background:transparent;border:1px solid #91a9ba55;border-radius:14px;padding:2px 6px;color:var(--ld-ink);font-size:11px;cursor:pointer;min-height:24px;flex-shrink:0}\n.ld-settings-button{font-size:19px;border:0;padding:0 4px;opacity:.65}\n.ld-settings{position:fixed;inset:0;margin:auto;width:310px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;gap:15px;padding:24px;border:1px solid #b6c2d180;border-radius:22px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#f7f9fa) 92%,transparent);backdrop-filter:blur(24px);color:var(--ld-ink);box-shadow:0 24px 80px #20304730,inset 0 1px #ffffff60;font-size:13px}\n.ld-settings::backdrop{background:#18253626}\n.ld-settings label{display:flex;align-items:center;gap:8px}.ld-settings input{accent-color:#7b9fb7}.ld-settings small{line-height:1.6;opacity:.7}.ld-settings button{font:inherit;color:inherit;background:transparent;border:1px solid #91a9ba55;border-radius:6px;padding:5px}\n.ld-flight{position:absolute;width:22px;height:22px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 30% 25%,#f5fbff,#a6c5d9 48%,#ad9fc8 85%);box-shadow:0 0 15px #8caabb30;pointer-events:none;overflow:hidden;white-space:nowrap;display:flex;align-items:center;justify-content:center;color:#30404c;font-size:12px}\n.ld-flight span{overflow:hidden;text-overflow:ellipsis;padding:0 9px}\n.ld-stream:after{content:"";display:inline-block;vertical-align:middle;width:5px;height:5px;margin:0 0 3px 3px;border-radius:50%;background:var(--ld-accent);box-shadow:0 0 7px 2px #7b9fb740;animation:ld-breathe var(--ld-breathe) ease-in-out infinite}\n.ld-emitting .ld-working,.ld-emitting .ld-dock-line{opacity:.45}\n.ld-received{outline:1px solid #7b9fb780;outline-offset:2px;border-radius:8px}\n.ld-reduced *,.ld-reduced:before{animation:none!important;transition:none!important}\n@keyframes ld-breathe{0%,100%{opacity:.72}50%{opacity:1}}\n@keyframes ld-bubble{0%,15%{opacity:0;transform:translateY(1px) scale(.5)}40%{opacity:.6}85%,100%{opacity:0;transform:translateY(-13px) scale(1)}}\n@keyframes ld-ambient{from{opacity:.55}to{opacity:1}}\n@media(max-width:600px){.ld-dock{max-width:44vw;gap:3px}.ld-orbs{gap:5px;max-height:64px}.ld-orb{width:19px;height:19px}.ld-tooltip{left:auto;right:0}.ld-stack{min-width:28px;min-height:28px}}\n@media(prefers-reduced-motion:reduce){.ld-row:before,.ld-row:after,.ld-dock *,.ld-dock-line:after,.ld-ambient,.ld-stream:after{animation:none!important;transition:none!important}.ld-orb i{display:none}.ld-flight{display:none}}\n@media(forced-colors:active){.ld-row:before,.ld-row:after{display:none}.ld-orb,.ld-stack{border:1px solid ButtonText;background:Canvas}.ld-stream:after{background:CanvasText}.ld-ambient,.ld-dock-line{display:none}}\n\n.ld-orb{overflow:hidden;isolation:isolate;vertical-align:middle}\n.ld-orb:before,.ld-orb:after{content:"";position:absolute;pointer-events:none;border-radius:50%}\n.ld-orb:before{inset:3px -3px -5px 4px;background:radial-gradient(ellipse,#b89cdd80,transparent 70%);transform:rotate(-25deg);animation:ld-pearl-drift 6.8s ease-in-out infinite alternate}\n.ld-orb:after{width:10px;height:5px;left:4px;top:3px;background:linear-gradient(160deg,#fff9,#fff0);transform:rotate(-32deg);opacity:.8}\n.ld-working{animation:ld-pearl-breathe 4.8s ease-in-out infinite}\n.ld-orb-wrap:nth-child(2n) .ld-orb{animation-delay:-1.7s}.ld-orb-wrap:nth-child(3n) .ld-orb:before{animation-delay:-3.2s}\n.ld-queued:before{animation:none;opacity:.4}\n@keyframes ld-pearl-drift{from{transform:translate(-3px,-2px) rotate(-25deg);opacity:.45}to{transform:translate(3px,2px) rotate(25deg);opacity:.95}}\n@keyframes ld-pearl-breathe{0%,100%{transform:translateY(.5px) scale(.96);opacity:.82}50%{transform:translateY(-.8px) scale(1.035);opacity:1}}\n.ld-paused *,.ld-paused:before,.ld-paused:after,.ld-paused *:before,.ld-paused *:after{animation-play-state:paused!important}\n@media(prefers-reduced-motion:reduce){.ld-orb,.ld-orb:before{animation:none!important}}\n@media(forced-colors:active){.ld-orb:before,.ld-orb:after{display:none}}\n';

// src/client.js
var name = "lingdong";
var inject = ["slots", "uiSession", "uiConversation", "jobs"];
var h = import_react.default.createElement;
var STORAGE = "dsh-lingdong.preferences.v3";
var EMPTY_JOBS = Object.freeze([]);
function preferences() {
  let saved;
  try {
    const stored = localStorage.getItem(STORAGE);
    saved = JSON.parse(stored || "{}");
    if (!stored) {
      const old = JSON.parse(localStorage.getItem("dsh-lingdong.preferences.v2") || localStorage.getItem("dsh-lingdong.preferences.v1") || "{}");
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
  function Orb({ row, reduced, root, onDone }) {
    const ref = (0, import_react.useRef)(null);
    const callback = (0, import_react.useRef)(onDone);
    callback.current = onDone;
    (0, import_react.useEffect)(() => {
      const element = ref.current;
      if (!element || !row.exiting) return;
      const animation = !reduced && element.animate?.([
        { opacity: 1, filter: "blur(0)", transform: "scale(1)" },
        { opacity: 0, filter: "blur(5px)", transform: "translateY(-7px) scale(1.35)" }
      ], { duration: prefs.getSnapshot().dissolve, easing: EASING });
      let cancelled = false;
      const timer = setTimeout(() => {
        if (!cancelled) callback.current(row.id);
      }, reduced ? 0 : prefs.getSnapshot().dissolve);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        animation?.cancel();
      };
    }, [row.id, row.exiting, reduced]);
    (0, import_react.useEffect)(() => {
      const element = ref.current;
      if (!element || !row.fresh || reduced || !root) return;
      if (row.exiting) return;
      const surface = [...surfaces].find((value) => value.root === root);
      return surface?.emitTask(element);
    }, [row.id, row.exiting, reduced]);
    const label = agentLabel(row);
    return h(
      "span",
      { className: "ld-orb-wrap" },
      h(
        "button",
        {
          ref,
          type: "button",
          className: `ld-orb ld-${row.state}`,
          "aria-label": label,
          "aria-describedby": `ld-tip-${row.id}`
        },
        h("i", { "aria-hidden": true }),
        h("i", { "aria-hidden": true }),
        h("i", { "aria-hidden": true })
      ),
      h("span", { id: `ld-tip-${row.id}`, className: "ld-tooltip", role: "tooltip" }, label)
    );
  }
  function Dock(props) {
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions((state) => state);
    const statuses = props.useSessionStatus((state) => state);
    const jobs = props.useJobs((state) => state.rows[props.sessionId]) ?? EMPTY_JOBS;
    (0, import_react.useEffect)(() => options.enabled ? props.watchRows(props.sessionId) : void 0, [props.sessionId, options.enabled]);
    const marker = (0, import_react.useRef)(null), model = (0, import_react.useRef)(/* @__PURE__ */ new Map()), initialized = (0, import_react.useRef)(false);
    const exitTimers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const settingsRef = (0, import_react.useRef)(null), settingsTrigger = (0, import_react.useRef)(null);
    const dialogId = (0, import_react.useId)(), orbsId = (0, import_react.useId)();
    const paused = (0, import_react.useSyncExternalStore)(visibilitySource.subscribe, visibilitySource.getSnapshot);
    const [rows, setRows] = (0, import_react.useState)([]), [expanded, setExpanded] = (0, import_react.useState)(false), [settings, setSettings] = (0, import_react.useState)(false);
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
      model.current = reconcileAgents(model.current, taskRows(props.sessionId, list, statuses, jobs), initialized.current);
      initialized.current = true;
      setRows([...model.current.values()]);
    }, [props.sessionId, list, statuses, jobs]);
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
    const clipped = options.aggregate && !expanded && rows.length > options.maxOrbs;
    const displayed = clipped ? rows.slice(0, options.maxOrbs) : rows;
    const root = [...document.querySelectorAll(SELECTORS.conversation)].find((el) => el.dataset.conversationSession === props.sessionId);
    const catalog = list.projectionsBySession?.[props.sessionId]?.values?.subagentCatalog ?? list.byId?.[props.sessionId]?.projectionValues?.subagentCatalog;
    return h(
      "div",
      {
        ref: marker,
        className: `ld-dock${reduced ? " ld-reduced" : ""}${paused ? " ld-paused" : ""}`,
        "data-ld-session": props.sessionId,
        "aria-label": "灵动对话状态区"
      },
      options.enabled && h("span", { className: `ld-dock-line${rows.some((row) => row.state === "working") ? " ld-live" : ""}`, "aria-hidden": true }),
      options.enabled && h(
        "div",
        { id: orbsId, className: "ld-orbs", "aria-label": "后台任务与子代理状态" },
        displayed.map((row) => h(Orb, { key: row.id, row, reduced, root, onDone: remove })),
        options.aggregate && rows.length > options.maxOrbs && h("button", {
          key: "aggregate",
          className: "ld-stack",
          type: "button",
          onClick: () => setExpanded(!expanded),
          "aria-controls": orbsId,
          "aria-label": expanded ? "收起任务" : `展开其余 ${rows.length - options.maxOrbs} 个任务`,
          "aria-expanded": expanded
        }, expanded ? "收起" : `+${rows.length - options.maxOrbs}`)
      ),
      h("button", {
        ref: settingsTrigger,
        type: "button",
        className: "ld-settings-button",
        title: "灵动动效设置",
        "aria-label": "灵动动效设置",
        "aria-haspopup": "dialog",
        "aria-controls": dialogId,
        "aria-expanded": settings,
        onClick: () => setSettings(!settings)
      }, "◌"),
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
        ...[["enabled", "启用动效"], ["ambient", "背景氛围"], ["aggregate", "超过 4 个小球时折叠"]].map(([key, label]) => h("label", { key }, h("input", { type: "checkbox", checked: options[key], onChange: (event) => prefs.update({ [key]: event.target.checked }) }), label)),
        h("small", null, reduced ? "系统已开启减少动态效果：使用静态状态。" : "状态来自 DSH；不额外调用模型。"),
        h("small", { className: "ld-catalog-status" }, catalog === void 0 ? "当前会话的子 agent 目录尚未就绪。" : `当前会话：${catalog.length} 个子 agent，${rows.filter((row) => row.state === "working").length} 个运行中。`),
        h("small", null, `已接入后台任务列表：${jobs.length} 项；完成、失败与停止均按真实状态显示。`),
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
    const jobs = props.useJobs((state) => state.rows);
    const active = (0, import_react.useMemo)(() => activeSessions(list, statuses, jobs), [list, statuses, jobs]);
    const observer = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      const instance = new SidebarObserver(props.watchRows);
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
      clearSidebar();
      style.remove();
    };
  });
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "lingdong-dock",
    order: 20,
    inject: () => ({ hooks: { jobs: ctx.jobs.state }, watchRows: (id) => ctx.jobs.watchRows(id) })
  }, Dock));
  ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
    name: "conversation.input.overlay",
    id: "lingdong-surface",
    order: 20
  }, Surface));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "lingdong-sidebar",
    order: 20,
    inject: () => ({ hooks: { jobs: ctx.jobs.state }, watchRows: (id) => ctx.jobs.watchRows(id) })
  }, Sidebar));
}
return module.exports;}});
