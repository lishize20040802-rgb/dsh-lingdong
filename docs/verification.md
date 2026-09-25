# v0.2.0 验证报告

目标：官方 DeepSeek Harness Desktop 0.1.7-rc.2；Windows；2026-09-25。

- 8 项 Node 测试通过，包括任务通道合并与失败原因、后台任务侧边栏状态。
- 3 组真实官方契约测试通过：bundle patch 与兼容性、客户端 manifest 与提供者、SlotCore 生命周期。
- 源码重新构建与已发货 lib 字节一致（build --check）。
- 32 项隔离 Chromium 场景通过：

1. history mount has no entrance animations
2. selected idle conversation has its own flow
3. host positioning and stacking remain unchanged
4. background process alone produces a truthful orb
5. background job activates its sidebar conversation
6. failed job settles instead of running forever
7. four child orbs plus aggregate control
8. selected and running sidebar styles coexist distinctly
9. keyboard focus exposes task tooltip
10. aggregate control exposes expanded state
11. selected title remains opaque and hides decorative text
12. flight is clipped to a plugin-owned layer
13. slower flight remains visible after 1.3 seconds
14. submission emits a text orb without changing message text
15. emission completes and cleans overlay
16. live paragraph and structured blocks animate
17. stream updates never reblur existing text
18. failed send removes in-flight effects
19. rapid submissions keep one emission in flight
20. switching conversations hides parent agents and cancels pending emissions
21. completion dissolves all child orbs including hidden group members
22. reduced motion disables bubbling
23. reduced motion uses static send highlight
24. narrow desktop window has no horizontal overflow
25. settings use native modal focus containment
26. settings disable all plugin surface and sidebar effects
27. settings restore focus to trigger
28. high contrast keeps sidebar titles readable
29. unload releases shared job roster
30. unload cleans CSS, overlays, surface and sidebar classes
31. re-enable mounts exactly one stylesheet and dock
32. no browser runtime errors

## 验证边界

浏览器测试使用真实 React 与 Edge，输入为仿照官方 DOM 和标准 hooks 的隔离夹具，不等于已在正在使用的 Electron 会话中联调。官方契约测试使用本机同版本 npm 发布包。未向模型发送测试消息，未修改 Desktop profile。

界面改动限于侧边栏标题装饰、发送小球、顶部任务球和插件自身设置窗口；没有替换官方控件，没有改变对话根节点 position 或 isolation。持续 CSS 动画只改变 transform / opacity；一次性的入场仍包含短暂 blur 与尺寸收拢。共享官方任务列表订阅覆盖当前挂载的侧边栏会话行，卸载或关闭动效后释放；大量会话时仍存在相应的订阅成本。

尚未对用户真实 Electron 窗口进行耗电测量，因此不宣称完全消除重绘或已有实机功耗结论。
