# 0.6.1

只改兼容声明，不动任何动效代码。

`peerDependencies` 里的 6 个官方 UI 包与 `engines.dsh` 原先锁死 `0.1.7-rc.2`。app-boot 用 `semver.satisfies(..., { includePrerelease: true })` 校验 peer，精确锁定会让宿主升到 0.2.0-rc.1 后把本插件判为不兼容，profile 在启动时直接拒绝加载，插件页显示「异常」。现改为 `>=0.1.7`。

注意范围语义：`>=0.1.7` 覆盖 `0.2.0-rc.1`，但按 semver 不覆盖 `0.1.7-rc.2`（预发布版排序低于其正式版）。若仍需支持官方 0.1.7-rc.2 宿主，应写 `>=0.1.7-rc.2`。

`test/official.mjs` 原先硬编码断言「对 0.1.7-rc.2 兼容」，现改为用参照运行时自身 app-boot 的版本断言，宿主再升级也不会失效。

验证：`npm test` 10/10；`npm run test:official` 对本机官方 0.2.0-rc.1 运行时 3 项全 PASS（含 `evaluatePluginCompatibility` 与真实 SlotCore 的注册/销毁）。DOM 选择器尚未在新宿主上重新核验，动效需实机确认。
