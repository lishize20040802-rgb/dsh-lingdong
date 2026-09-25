# 官方插件规范对照

核对日期：2026-09-25。主要依据：本机官方 Desktop 及同版本 npm 包 **0.1.7-rc.2** 的 manifest、README、类型声明和实际代码；在线官方文档辅助确认来源。没有用社区插件示例替代接口契约。

| 约定 | 本插件 |
|---|---|
| Cordis 宿主插件导出 `apply` | `lib/index.js` 导出 `name = 'lingdong'`、`apply()`；宿主半边仅用于发现。 |
| 可安装 bundle | `dsh.manifestVersion: 1`，`dsh.bundle.patch: ./cordis.patch.yml`，patch 插入 `lingdong`，包名 `dsh-lingdong`。 |
| 客户端发现 | `exports["./client"]` → `lib/client.js`，`dsh.client.platform: web`。 |
| 客户端加载协议 | `window.__ModuleLoader__.load({id: 'dsh-lingdong', factory})`；执行脚本仅注册工厂，物化时返回 CJS exports。 |
| 模块共享 | React 使用桌面 shell 的共享 `require('react')`，没有打入另一份 React。没有非 baseline 的运行时模块导入，因此无需 `external` 声明。 |
| 依赖声明 | manifest `client.inject` 声明官方 UI 提供者；客户端 Cordis `inject` 声明 `slots`、`uiSession`、`uiConversation`、`jobs` 服务。 |
| 插槽 | 通过 `ctx.slots.inject` 等待已有插槽声明；向三个 list 插槽注册全新 id，不替换官方组件。 |
| 真实状态 | 组件消费官方标准 `useSession`、`useSessions`、`useSessionStatus` hooks。只读 session pending submissions、subagentCatalog、subagentTiming；通过插槽 inject hooks.jobs 获取 useJobs，并调用引用计数 watchRows。 |
| 生命周期 | 样式归 `ctx.effect`，组件观察器和动画归 React effect；卸载与重复启用都清理。 |
| 版本门槛 | 精确 DSH UI peer 版本供官方兼容性检查使用；引擎字段同时说明支持版本。UI peers 标为 optional，避免在外部插件目录安装另一份宿主 UI，但运行时 services 仍为必需。 |
| 桌面安装 | 官方应用内插件管理器操作 Electron 专属 profile；不改 app.asar、不注入预加载脚本、不注册 Electron 原生权限。 |

新增插槽项：

- `conversation.session.header.actions` / `lingdong-dock`
- `conversation.input.overlay` / `lingdong-surface`
- `shell.overlay` / `lingdong-sidebar`（只读侧边栏状态适配器，渲染结果为 null）

## 官方来源

- [第一个插件与资源清理](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)
- [Desktop 运行时与插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)
- [公开 package manifest](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/package-manifest/README.md)
- [客户端模块加载协议](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/modules/README.md)
- [UI 插槽契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-slots/README.md)
- [Conversation 标准状态与插槽](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-conversation/README.md)
- [Subagent 目录与状态](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-subagent/README.md)
- [插件管理器：本地目录安装与版本检查](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)

注意：官方插件装载符合性与 DOM 动效长期兼容性是两个问题。前者使用官方协议且已运行契约测试；后者绑定本次核对的版本，升级必须重新检验。

## v0.2.0 后台任务

依赖官方 @deepseek-ai/dsh-api-job-controller；JobView 的 id、kind、label、status、progress、detail 来自 dsh-jobs/view。watchRows 与官方任务菜单共享每会话列表流，不调用 observe、kill 或输出读取。subagent 工具的 continuable 分支调用 startContinuable，非持续后台分支注册 kind:subagent 的 Job；两者分别来自目录和任务列表。按原生标识展示，不按相似任务标题猜测合并。

设计参考：[Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion) 与 [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)。仅用于插件自身细节，不替换宿主界面。

