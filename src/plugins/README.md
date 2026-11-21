# src/plugins —— 编译期内置插件目录

这个目录不是"运行时加载的插件系统"，而是**编译期注册的扩展点**：插件随前端一起打包，
写进来就在生效，没有安装、没有开关、没有动态 import。

## 目录约定

```text
src/plugins/
  index.ts          注册表 + composeSystemPrompt()：宿主唯一入口
  types.ts          插件契约（PromptPlugin / PluginContext / PromptPatch）
  nsfw/             插件一：NSFW 创作模式注入（head）
    index.ts
    prompt.ts       正文（用 .ts 存，避免动构建配置加 raw loader）
  purge/            插件二：拒答兜底 / 破甲（tail）
    index.ts
    prompt.ts
```

## 三条铁律

1. **单向依赖**：插件只 import 本目录的 `types.js`，不 import 宿主的 store / api / 组件。
2. **纯计算**：插件是纯函数，不写 localStorage、不发请求、不读 DOM。要数据由宿主通过
   `PluginContext` 传。
3. **只回补丁**：插件返回 `PromptPatch`（`head` / `tail`），由注册表统一拼接；插件抛错只记录，
   绝不中断请求。

## 加一个插件

1. 新建 `src/plugins/<名字>/prompt.ts`（正文）与 `index.ts`（导出 `<名字>Plugin`）。
2. 在 `src/plugins/index.ts` 的 `plugins` 数组里加一行。
3. 跑 `pnpm type` 与 `pnpm lint`。

## 宿主挂钩点

只有一处：`src/services/chat/store.ts` 组装请求时调用 `composeSystemPrompt(SYSTEM_PROMPT, messages)`。
除此之外不改任何既有文件。
