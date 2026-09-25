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
  flight: 470,
  hold: 180,
  settle: 350,
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
  for (const key of ["flight", "hold", "settle", "reveal", "dissolve"]) {
    if (Number.isFinite(input?.[key])) result[key] = Math.max(80, Math.min(1500, input[key]));
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
  if (row.state === "completed") return `${row.title} · 已完成`;
  if (row.state === "working") return `${row.title} · 工作中（未提供百分比进度）`;
  return `${row.title} · ${row.inactive ? "当前未运行" : "排队 / 等待状态同步"}`;
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
var MotionSurface = class {
  constructor(root, options, reduced, dock) {
    this.root = root;
    this.options = options;
    this.reduced = reduced;
    this.dock = dock;
    this.dead = false;
    this.animations = /* @__PURE__ */ new Set();
    this.nodes = /* @__PURE__ */ new Set();
    this.timers = /* @__PURE__ */ new Map();
    this.queue = [];
    this.busy = false;
    this.seen = /* @__PURE__ */ new WeakSet();
    this.streams = /* @__PURE__ */ new Set();
    this.raf = 0;
    this.abort = new AbortController();
    root.classList.add("ld-surface");
    root.classList.toggle("ld-ambient", options.ambient);
    root.classList.toggle("ld-reduced", reduced);
    for (const block of root.querySelectorAll("p,pre,ul,ol,table,blockquote,h1,h2,h3")) this.seen.add(block);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-streaming"]
    });
    this.schedule();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancelFlight();
    }, { signal: this.abort.signal });
  }
  schedule() {
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.scan();
    });
  }
  scan() {
    if (this.dead) return;
    for (const el of this.streams) {
      if (!el.isConnected || !el.matches(SELECTORS.stream)) {
        el.classList.remove("ld-stream");
        this.streams.delete(el);
      }
    }
    for (const stream of this.root.querySelectorAll(SELECTORS.stream)) {
      if (stream.closest("[data-chat-flow-kind]")?.getAttribute("data-chat-flow-kind")?.startsWith("assistant") !== true) continue;
      if (stream.parentElement?.closest(SELECTORS.stream)) continue;
      stream.classList.add("ld-stream");
      this.streams.add(stream);
      for (const block of stream.querySelectorAll("p,pre,ul,ol,table,blockquote,h1,h2,h3")) {
        if (this.seen.has(block)) continue;
        this.seen.add(block);
        if (block.parentElement?.closest("pre,ul,ol,table,blockquote")) continue;
        if (!this.reduced && visible(block)) this.animate(block, block.matches("p") ? [
          { opacity: 0.35, filter: "blur(3px)", transform: "translateY(2px)" },
          { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }
        ] : [{ opacity: 0.4, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], this.options.reveal);
      }
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
    return candidates.reverse().find((el) => visible(el) && (!submission.text || el.textContent.includes(submission.text.slice(0, 48))));
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
  async flight(submission) {
    const input = this.root.querySelector(SELECTORS.input);
    const dock = this.dock();
    if (!input || !dock || !visible(input) || !visible(dock)) return;
    if (this.reduced) {
      dock.classList.add("ld-received");
      await this.delay(450);
      dock.classList.remove("ld-received");
      return;
    }
    const orb = document.createElement("div");
    orb.className = "ld-flight";
    orb.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = submission.text.slice(0, 90) || "附件";
    orb.append(text);
    document.body.append(orb);
    this.nodes.add(orb);
    const start = center(input), top = center(dock);
    orb.style.left = `${start.x}px`;
    orb.style.top = `${start.y}px`;
    this.root.classList.add("ld-emitting");
    dock.classList.add("ld-emitting");
    try {
      await this.animate(orb, [
        { width: "180px", height: "36px", borderRadius: "12px", opacity: 0.8 },
        { width: "15px", height: "15px", borderRadius: "50%", opacity: 1 }
      ], 160);
      text.remove();
      if (!orb.isConnected || this.dead) return;
      await this.animate(orb, [
        { transform: "translate(-50%,-50%) scale(1)" },
        { transform: `translate(calc(-50% + ${(top.x - start.x) * 0.4}px),calc(-50% + ${(top.y - start.y) * 0.65}px)) scale(.85)`, offset: 0.5 },
        { transform: `translate(calc(-50% + ${top.x - start.x}px),calc(-50% + ${top.y - start.y}px)) scale(1)` }
      ], this.options.flight);
      orb.style.left = `${top.x}px`;
      orb.style.top = `${top.y}px`;
      if (!orb.isConnected || this.dead) return;
      await this.delay(this.options.hold);
      if (!orb.isConnected || this.dead) return;
      const target = this.findDestination(submission);
      if (!target) return;
      const destination = center(target);
      await this.animate(orb, [
        { transform: "translate(-50%,-50%)", opacity: 1 },
        { transform: `translate(calc(-50% + ${destination.x - top.x}px),calc(-50% + ${destination.y - top.y}px)) scale(1.7)`, opacity: 0 }
      ], this.options.settle);
      if (orb.isConnected && visible(target)) await this.animate(
        target,
        [{ transform: "scale(.985)", filter: "blur(.6px)" }, { transform: "scale(1)", filter: "blur(0)" }],
        180
      );
    } finally {
      orb.remove();
      this.nodes.delete(orb);
      this.root.classList.remove("ld-emitting");
      dock.classList.remove("ld-emitting");
    }
  }
  cancelFlight() {
    this.queue.length = 0;
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
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    this.cancelFlight();
    for (const el of this.streams) el.classList.remove("ld-stream");
    this.streams.clear();
    this.root.classList.remove("ld-surface", "ld-ambient", "ld-reduced");
  }
};
function decorateSidebar(active, enabled) {
  const rows = [...document.querySelectorAll(SELECTORS.sidebar)];
  const count = rows.filter((row) => active.has(row.dataset.rowKey.slice(8)) && row.getAttribute("aria-selected") !== "true").length;
  for (const row of rows) {
    const title = row.querySelector(":scope > span:nth-of-type(2)");
    if (!title) continue;
    title.classList.toggle("ld-title", enabled);
    const flow = enabled && row.getAttribute("aria-selected") !== "true" && active.has(row.dataset.rowKey.slice(8));
    title.classList.toggle("ld-title-active", flow);
    title.classList.toggle("ld-title-muted", flow && count > 3);
  }
}
function clearSidebar() {
  for (const el of document.querySelectorAll(".ld-title")) el.classList.remove("ld-title", "ld-title-active", "ld-title-muted");
}

// src/style.css
var style_default = '.ld-surface,.ld-dock{--ld-accent:#7b9fb7;--ld-soft:#aaa4b7;--ld-ease:cubic-bezier(.22,.75,.25,1);--ld-breathe:4.2s;--ld-ink:var(--dsw-alias-label-primary,#344454)}\n.ld-surface{isolation:isolate;position:relative}\n.ld-surface.ld-ambient:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 30% 20%,#839fba0c,transparent 65%),radial-gradient(ellipse at 80% 75%,#9990af09,transparent 60%);animation:ld-ambient 24s ease-in-out infinite alternate}\n.ld-title{background-image:linear-gradient(100deg,var(--dsw-alias-label-primary,#344454),color-mix(in srgb,var(--dsw-alias-label-primary,#344454) 86%,#7b9fb7),var(--dsw-alias-label-primary,#344454));background-size:240% 100%;background-clip:text;-webkit-background-clip:text;color:transparent!important}\n[aria-selected=true]>.ld-title{background:none;color:var(--dsw-alias-label-primary,#344454)!important}\n.ld-title-active{background-image:linear-gradient(100deg,var(--dsw-alias-label-primary,#344454),#819eac,var(--dsw-alias-label-primary,#344454),#a29bab);animation:ld-flow 8.4s ease-in-out infinite}\n.ld-title-muted{background-image:linear-gradient(100deg,var(--dsw-alias-label-primary,#344454),color-mix(in srgb,var(--dsw-alias-label-primary,#344454) 78%,#819eac),var(--dsw-alias-label-primary,#344454))}\n.ld-dock{display:flex;align-items:center;gap:8px;position:relative;min-width:26px;max-width:min(42vw,380px);min-height:28px;flex-shrink:1}\n.ld-dock-line{position:absolute;inset:auto 0 -3px;height:1px;background:linear-gradient(90deg,transparent,var(--ld-accent),var(--ld-soft),transparent);background-size:240% 100%;opacity:.55;animation:ld-flow 8.4s ease-in-out infinite;pointer-events:none}\n.ld-orbs{display:flex;align-items:center;gap:9px;min-width:0;flex-wrap:wrap;max-height:90px;overflow-y:auto;padding:5px}\n.ld-orb-wrap{display:inline-flex}\n.ld-orb{position:relative;appearance:none;display:inline-block;width:20px;height:20px;border-radius:50%;border:1px solid #91a9ba80;background:radial-gradient(circle at 32% 28%,#b9cdd440,#7e9aaf12 65%);padding:0;color:inherit;cursor:help;flex-shrink:0}\n.ld-orb:focus-visible,.ld-stack:focus-visible,.ld-settings-button:focus-visible{outline:2px solid var(--ld-accent);outline-offset:3px}\n.ld-queued{opacity:.55}\n.ld-working{animation:ld-breathe var(--ld-breathe) ease-in-out infinite;box-shadow:inset 0 0 7px #87adc526,0 0 8px #87adc512}\n.ld-orb i{position:absolute;left:6px;bottom:4px;width:3px;height:3px;border:1px solid #9db9c5aa;border-radius:50%;opacity:0;pointer-events:none}\n.ld-working i{animation:ld-bubble var(--ld-breathe) ease-in-out infinite}\n.ld-working i:nth-child(2){left:11px;animation-delay:1.4s;width:2px;height:2px}\n.ld-working i:nth-child(3){left:3px;animation-delay:2.8s;width:2px;height:2px}\n.ld-tooltip{display:none;position:absolute;top:calc(100% + 9px);left:0;z-index:100;max-width:min(340px,80vw);white-space:normal;overflow-wrap:anywhere;padding:9px 12px;border-radius:10px;background:var(--dsw-alias-bg-base,#f7f9fa);color:var(--ld-ink);border:1px solid #879eaa55;box-shadow:0 8px 24px #0002;font-size:12px;line-height:1.6;pointer-events:none}\n.ld-orb-wrap:hover .ld-tooltip,.ld-orb-wrap:focus-within .ld-tooltip{display:block}\n.ld-stack,.ld-settings-button{font:inherit;appearance:none;background:transparent;border:1px solid #91a9ba55;border-radius:14px;padding:2px 6px;color:var(--ld-ink);font-size:11px;cursor:pointer;min-height:24px;flex-shrink:0}\n.ld-settings-button{font-size:19px;border:0;padding:0 4px;opacity:.65}\n.ld-settings{position:absolute;right:0;top:calc(100% + 10px);z-index:101;width:240px;max-width:80vw;display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #91a9ba55;border-radius:14px;background:var(--dsw-alias-bg-base,#f7f9fa);color:var(--ld-ink);box-shadow:0 12px 40px #0002;font-size:13px}\n.ld-settings label{display:flex;align-items:center;gap:8px}.ld-settings input{accent-color:#7b9fb7}.ld-settings small{line-height:1.6;opacity:.7}.ld-settings button{font:inherit;color:inherit;background:transparent;border:1px solid #91a9ba55;border-radius:6px;padding:5px}\n.ld-flight{position:fixed;z-index:1000;width:15px;height:15px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 30% 25%,#ddeaf0,#8caabb 65%,#9f9aac);box-shadow:0 0 15px #8caabb30;pointer-events:none;overflow:hidden;white-space:nowrap;display:flex;align-items:center;justify-content:center;color:#30404c;font-size:12px}\n.ld-flight span{overflow:hidden;text-overflow:ellipsis;padding:0 9px}\n.ld-stream:after{content:"";display:inline-block;vertical-align:middle;width:5px;height:5px;margin:0 0 3px 3px;border-radius:50%;background:var(--ld-accent);box-shadow:0 0 7px 2px #7b9fb740;animation:ld-breathe var(--ld-breathe) ease-in-out infinite}\n.ld-emitting .ld-working,.ld-emitting .ld-dock-line{opacity:.45}\n.ld-received{outline:1px solid #7b9fb780;outline-offset:2px;border-radius:8px}\n.ld-reduced *,.ld-reduced:before{animation:none!important;transition:none!important}\n@keyframes ld-flow{0%,100%{background-position:0 50%}50%{background-position:100% 50%}}\n@keyframes ld-breathe{0%,100%{opacity:.72}50%{opacity:1}}\n@keyframes ld-bubble{0%,15%{opacity:0;transform:translateY(1px) scale(.5)}40%{opacity:.6}85%,100%{opacity:0;transform:translateY(-13px) scale(1)}}\n@keyframes ld-ambient{from{opacity:.55}to{opacity:1}}\n@media(max-width:600px){.ld-dock{max-width:44vw;gap:3px}.ld-orbs{gap:5px;max-height:64px}.ld-orb{width:19px;height:19px}.ld-tooltip{left:auto;right:0}.ld-settings{position:fixed;top:70px;right:12px}.ld-stack{min-width:28px;min-height:28px}}\n@media(prefers-reduced-motion:reduce){.ld-title,.ld-dock *,.ld-surface:before,.ld-stream:after{animation:none!important;transition:none!important}.ld-orb i{display:none}.ld-flight{display:none}}\n@media(forced-colors:active){.ld-title{background:none;color:CanvasText!important}.ld-orb,.ld-stack{border:1px solid ButtonText;background:Canvas}.ld-stream:after{background:CanvasText}.ld-surface:before,.ld-dock-line{display:none}}\n';

// src/client.js
var name = "lingdong";
var inject = ["slots", "uiSession", "uiConversation"];
var h = import_react.default.createElement;
var STORAGE = "dsh-lingdong.preferences.v1";
function preferences() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
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
      const candidates = [...root.querySelectorAll("[data-chat-flow-kind]")];
      const source = candidates.reverse().find((el) => el.getAttribute("data-chat-flow-kind")?.startsWith("assistant"));
      if (!source || !element.animate) return;
      const from = source.getBoundingClientRect(), to = element.getBoundingClientRect();
      const dy = Math.max(-240, Math.min(240, from.top - to.top));
      const dx = Math.max(-400, Math.min(400, from.left + from.width / 2 - to.left - to.width / 2));
      const animation = element.animate([
        { opacity: 0.25, transform: `translate(${dx}px,${dy}px) scale(.4)` },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ], { duration: prefs.getSnapshot().flight, easing: EASING });
      return () => animation.cancel();
    }, [row.id, reduced]);
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
    const marker = (0, import_react.useRef)(null), model = (0, import_react.useRef)(/* @__PURE__ */ new Map()), initialized = (0, import_react.useRef)(false);
    const exitTimers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const [rows, setRows] = (0, import_react.useState)([]), [expanded, setExpanded] = (0, import_react.useState)(false), [settings, setSettings] = (0, import_react.useState)(false);
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
      setRows([...model.current.values()]);
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
    const clipped = options.aggregate && !expanded && rows.length > options.maxOrbs;
    const displayed = clipped ? rows.slice(0, options.maxOrbs) : rows;
    const root = [...document.querySelectorAll(SELECTORS.conversation)].find((el) => el.dataset.conversationSession === props.sessionId);
    return h(
      "div",
      {
        ref: marker,
        className: `ld-dock${reduced ? " ld-reduced" : ""}`,
        "data-ld-session": props.sessionId,
        "aria-label": "灵动对话状态区"
      },
      options.enabled && h("span", { className: "ld-dock-line", "aria-hidden": true }),
      options.enabled && h(
        "div",
        { className: "ld-orbs", "aria-label": "子 agent 状态" },
        displayed.map((row) => h(Orb, { key: row.id, row, reduced, root, onDone: remove })),
        clipped && h("button", {
          className: "ld-stack",
          type: "button",
          onClick: () => setExpanded(true),
          "aria-label": `展开其余 ${rows.length - options.maxOrbs} 个子 agent`,
          "aria-expanded": false
        }, `+${rows.length - options.maxOrbs}`),
        expanded && rows.length > options.maxOrbs && h("button", { className: "ld-stack", type: "button", onClick: () => setExpanded(false), "aria-expanded": true }, "收起")
      ),
      h("button", {
        type: "button",
        className: "ld-settings-button",
        "aria-label": "灵动动效设置",
        "aria-expanded": settings,
        onClick: () => setSettings(!settings)
      }, "◌"),
      settings && h(
        "div",
        { className: "ld-settings", onKeyDown: (event) => {
          if (event.key === "Escape") setSettings(false);
        } },
        h("strong", null, "灵动"),
        ...[["enabled", "启用动效"], ["ambient", "背景氛围"], ["aggregate", "超过 4 个小球时折叠"]].map(([key, label]) => h("label", { key }, h("input", { type: "checkbox", checked: options[key], onChange: (event) => prefs.update({ [key]: event.target.checked }) }), label)),
        h("small", null, reduced ? "系统已开启减少动态效果：使用静态状态。" : "状态来自 DSH；不额外调用模型。"),
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
    const options = usePrefs(), reduced = useReduced();
    const list = props.useSessions((state2) => state2), statuses = props.useSessionStatus((state2) => state2);
    const state = (0, import_react.useRef)({ list, statuses, enabled: options.enabled });
    state.current = { list, statuses, enabled: options.enabled };
    (0, import_react.useEffect)(() => {
      let frame = 0;
      const update = () => {
        frame = 0;
        decorateSidebar(activeSessions(state.current.list, state.current.statuses), state.current.enabled);
      };
      const observer = new MutationObserver(() => {
        if (!frame) frame = requestAnimationFrame(update);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
      update();
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearSidebar();
      };
    }, []);
    (0, import_react.useEffect)(() => {
      decorateSidebar(activeSessions(list, statuses), options.enabled);
    }, [list, statuses, options, reduced]);
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
