# Lingdong · dsh-lingdong 0.5.4

[简体中文](README.md) · [English](README.en.md)

A small visual enhancement for the official DeepSeek Harness Desktop 0.1.7-rc.2 interface. It preserves the host layout, fonts, button sizes, composer, message content, attachments, and send behavior.

## What it does

- **Subagent status in the header:** Three solid red, yellow, and green balls are always visible in a borderless button that blends with the official header. Each subagent gets a stable, randomly assigned color. The large balls stay perfectly round; only working subagents emit small bubbles of the same color. Two working balls orbit each other, and three follow intertwined paths. A completed ball returns to its resting position along an arc. Subagents never fly out of the conversation.
- **Real subagent state:** Status comes from the official `subagentCatalog` and session state. Background tasks are neither subscribed to nor displayed. When more than three subagents exist, the header keeps three representative balls; click them to see the full list. Color does not indicate success or failure.
- **Whole-message send motion:** The plugin captures a read-only visual snapshot of the actual composer, including its position, size, font, wrapping, and scroll position. On send, the full text contracts into a flowing multicolor ball, travels to the real message bubble, and expands to the bubble's current bounds. The default phases are 320 ms for contraction, 420 ms for travel, and 360 ms for expansion, with overlap for a total of about 0.98 s.
- **Accurate landing:** The destination is reread each frame so the animation follows scrolling, layout changes, and replacement of optimistic messages. Attachments and the native copy actions remain in the official interface.
- **Flowing sidebar glow:** Irregular blue, purple, and pink light patches travel around the edges of each relevant conversation button and fade inward. The effect is attached to the native button itself, so it moves immediately when the official sidebar reorders that conversation. It adds no child nodes and does not change the button's text or dimensions.
- **Light reading effects:** New streamed paragraphs and structured blocks enter gently. Opening history does not replay their animations.

## Install and settings

In the official desktop app, choose **Plugins → Install plugin → Local directory** and select the complete `dsh-lingdong` folder. The package includes a prebuilt `lib` directory, so installation does not require a build step. This release is verified only with official DSH 0.1.7-rc.2; recheck compatibility after upgrading the host.

Click the three balls in the upper-right corner, then **Lingdong motion settings** (shown in the app's current Chinese UI), to toggle effects and ambient light. Existing enable/ambient preferences are retained. The three idle balls remain visible when no subagent is active.

Disabling or unloading the plugin removes its styles, sidebar glow, listeners, animations, and temporary message visibility changes. Send failures, session switches, hidden pages, and destinations leaving the visible area restore the native message immediately. The plugin respects reduced-motion and forced-colors settings.

## Scope and compatibility

The plugin makes no model calls, uploads no data, and does not take over input events or alter message content. It reads official client-side state. If it cannot match a real input snapshot or message bubble, such as for an attachment-only or programmatic send, it falls back to a brief static outline instead of guessing a text position.

The bubble selector was checked against the installed official 0.1.7-rc.2 `UserStyleBubble`. Later host versions may change DOM selectors. Four or more subagents reuse colors; their names in the full list distinguish them.

## Development

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm run check
npm run test:browser
node scripts/build.mjs --check
```

For offline builds, `DSH_ESBUILD_PATH` may point to an existing `esbuild/lib/main.js`. Browser tests use `DSH_TEST_MODULES` for the `esbuild`, `react`, `react-dom`, and `playwright-core` installation; `DSH_BROWSER` selects Chromium, and `DSH_TEST_OUTPUT` selects the results directory. See [verification details](docs/verification.md). Automated tests never send a real chat message.
