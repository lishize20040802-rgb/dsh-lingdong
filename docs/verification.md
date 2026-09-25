# v0.4.1 验证报告

DSH Desktop 0.1.7-rc.2，Windows，2026-09-25。

9 项 Node 测试、3 组真实官方契约检查、源码构建字节一致性检查通过。44 项隔离 Edge 场景通过：

1. history mount has no entrance animations
2. selected idle conversation has its own flow
3. host positioning and stacking remain unchanged
4. AI task ball uses an unclipped layer outside the dock scroller
5. background process alone produces a truthful orb
6. background job activates its sidebar conversation
7. failed job settles instead of running forever
8. two tasks mutually orbit with opposite phases
9. three tasks use three phased trajectories
10. four tasks are represented by exactly three balls
11. six tasks remain three balls with a truthful count
12. selected and running sidebar styles coexist distinctly
13. running task orbs contain five staggered repeating bubbles
14. task orb color fields rotate continuously
15. keyboard focus exposes task tooltip
16. task list exposes all six tasks while keeping exactly three balls
17. native row background animates without overlays or changed host layout
18. native title retains opaque original color
19. button background itself flows over time
20. flight is clipped to a plugin-owned layer
21. message waits visually while its text gathers into the ball
22. confirmed row replacement remains hidden until arrival
23. slower flight remains visible after 1.3 seconds
24. user ball travels toward the message and never the header
25. submission emits a text orb without changing message text
26. message is restored after expansion
27. emission completes and cleans overlay
28. live paragraph and structured blocks animate
29. stream updates never reblur existing text
30. failed send removes in-flight effects and restores messages
31. rapid submissions keep one emission in flight
32. switching conversations hides parent agents and cancels pending emissions
33. completion dissolves all child orbs including hidden group members
34. reduced motion disables bubbling
35. reduced motion uses static send highlight
36. narrow desktop window has no horizontal overflow
37. settings use native modal focus containment
38. settings disable all plugin surface and sidebar effects
39. settings restore focus to trigger
40. high contrast keeps sidebar titles readable
41. unload releases shared job roster
42. unload cleans CSS, overlays, surface and sidebar classes
43. re-enable mounts exactly one stylesheet and dock
44. no browser runtime errors

测试使用真实 React 与 Chromium 的隔离夹具，不向模型发送真实消息。官方契约来自本机同版本发布包。实际 Electron 的发送观感仍需真实发送验证。

侧边栏直接改变原按钮的 background-image / background-position，文字、圆角、布局和子节点保持不变；不创建覆盖层或伪元素。原生背景动画会产生按钮区域的重绘，仅作用于选中或运行会话，隐藏窗口时暂停；不宣称属于纯合成动画；发送为输入框直达新消息，跟随临时节点替换，异常中止恢复透明度。顶部只接收 AI 区域产生的任务球。四种渐变色层持续变换，五组错峰气泡持续上升；2 球和 3 球采用周期轨迹，是视觉化环绕而非物理引力模拟。4 个以上任务以 3 球代表，完整任务列表保留全部状态。减少动态效果时球群静态排列，悬停或键盘聚焦暂停轨道以便阅读。
