# v0.3.0 验证报告

DSH Desktop 0.1.7-rc.2，Windows，2026-09-25。

8 项 Node 测试、3 组真实官方契约检查、源码构建字节一致性检查通过。38 项隔离 Edge 场景通过：

1. history mount has no entrance animations
2. selected idle conversation has its own flow
3. host positioning and stacking remain unchanged
4. AI task ball uses an unclipped layer outside the dock scroller
5. background process alone produces a truthful orb
6. background job activates its sidebar conversation
7. failed job settles instead of running forever
8. four child orbs plus aggregate control
9. selected and running sidebar styles coexist distinctly
10. keyboard focus exposes task tooltip
11. aggregate control exposes expanded state
12. color belongs to whole row; original title stays opaque
13. row color field moves over time
14. flight is clipped to a plugin-owned layer
15. message waits visually while its text gathers into the ball
16. confirmed row replacement remains hidden until arrival
17. slower flight remains visible after 1.3 seconds
18. user ball travels toward the message and never the header
19. submission emits a text orb without changing message text
20. message is restored after expansion
21. emission completes and cleans overlay
22. live paragraph and structured blocks animate
23. stream updates never reblur existing text
24. failed send removes in-flight effects and restores messages
25. rapid submissions keep one emission in flight
26. switching conversations hides parent agents and cancels pending emissions
27. completion dissolves all child orbs including hidden group members
28. reduced motion disables bubbling
29. reduced motion uses static send highlight
30. narrow desktop window has no horizontal overflow
31. settings use native modal focus containment
32. settings disable all plugin surface and sidebar effects
33. settings restore focus to trigger
34. high contrast keeps sidebar titles readable
35. unload releases shared job roster
36. unload cleans CSS, overlays, surface and sidebar classes
37. re-enable mounts exactly one stylesheet and dock
38. no browser runtime errors

验证使用真实 React 与 Chromium 的隔离夹具，不向模型发送真实消息。官方契约来自本机同版本发布包。发送动画的真实 Electron 观感仍需实际发送验证。

宿主对话根节点定位与层叠上下文保持原状。仅需要装饰的侧边栏行建立局部伪元素背景层，不改文本颜色、DOM 子节点或官方控件。短暂隐藏消息使用可取消 WAAPI，保留布局与可访问文本；失败、停用、切换会话、卸载时恢复。后台订阅、观察器与动画均在卸载后释放。
