# v0.4.0 验证报告

DSH Desktop 0.1.7-rc.2，Windows，2026-09-25。

9 项 Node 测试、3 组真实官方契约检查、源码构建字节一致性检查通过。43 项隔离 Edge 场景通过：

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
17. color belongs to whole row; original title stays opaque
18. row color field moves over time
19. flight is clipped to a plugin-owned layer
20. message waits visually while its text gathers into the ball
21. confirmed row replacement remains hidden until arrival
22. slower flight remains visible after 1.3 seconds
23. user ball travels toward the message and never the header
24. submission emits a text orb without changing message text
25. message is restored after expansion
26. emission completes and cleans overlay
27. live paragraph and structured blocks animate
28. stream updates never reblur existing text
29. failed send removes in-flight effects and restores messages
30. rapid submissions keep one emission in flight
31. switching conversations hides parent agents and cancels pending emissions
32. completion dissolves all child orbs including hidden group members
33. reduced motion disables bubbling
34. reduced motion uses static send highlight
35. narrow desktop window has no horizontal overflow
36. settings use native modal focus containment
37. settings disable all plugin surface and sidebar effects
38. settings restore focus to trigger
39. high contrast keeps sidebar titles readable
40. unload releases shared job roster
41. unload cleans CSS, overlays, surface and sidebar classes
42. re-enable mounts exactly one stylesheet and dock
43. no browser runtime errors

测试使用真实 React 与 Chromium 的隔离夹具，不向模型发送真实消息。官方契约来自本机同版本发布包。实际 Electron 的发送观感仍需真实发送验证。

侧边栏使用整行伪元素背景，文字颜色不变；发送为输入框直达新消息，跟随临时节点替换，异常中止恢复透明度。顶部只接收 AI 区域产生的任务球。四种渐变色层持续变换，五组错峰气泡持续上升；2 球和 3 球采用周期轨迹，是视觉化环绕而非物理引力模拟。4 个以上任务以 3 球代表，完整任务列表保留全部状态。减少动态效果时球群静态排列，悬停或键盘聚焦暂停轨道以便阅读。
