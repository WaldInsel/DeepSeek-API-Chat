# src/plugins —— 编译期内置插件目录

这个目录不是"运行时加载的插件系统"，而是**编译期注册的扩展点**：插件随前端一起打包，
写进注册表即存在，没有安装、没有动态 import。是否参与某次请求由设置里的插件开关决定，
默认关闭。

## 目录约定

```text
src/plugins/
  index.ts             注册表 + composeSystemPrompt()：宿主唯一入口
  types.ts             插件契约（PromptPlugin / PluginContext / PromptPatch）
  custom-instructions/ 插件：自定义指令（tail，正文来自设置）
    index.ts
  nsfw/                插件：NSFW 创作模式注入（head）
    index.ts
    prompt.ts          正文（用 .ts 存，避免动构建配置加 raw loader）
  purge/               插件：拒答兜底（tail）
    index.ts
    prompt.ts
```

## 开关与配置

`composeSystemPrompt(system, messages, states)` 的第三个参数是宿主从设置里读出的插件状态：

```ts
interface PluginState {
  enabled?: boolean
  config?: unknown
}
```

- **默认关闭**：`states[name].enabled !== true` 的插件不执行，避免升级后静默改变请求。
- **配置由宿主注入**：插件不读 localStorage，配置通过 `PluginContext.config` 传入；
  具体形状由插件自己收窄。
- **正文可编辑**：插件导出 `defaultText`（内置正文）时，设置页的「编辑」弹窗以
  `config.text || defaultText` 为初值；保存值与内置正文一致时写空串，让插件继续回退到
  内置正文，避免把旧版本正文固化到本机设置里。
- 开关只影响之后的新请求，不改历史消息和已经生成的内容。

## 三条铁律

1. **单向依赖**：插件只 import 本目录的 `types.js`，不 import 宿主的 store / api / 组件。
2. **纯计算**：插件是纯函数，不写 localStorage、不发请求、不读 DOM。要数据由宿主通过
   `PluginContext` 传。
3. **只回补丁**：插件返回 `PromptPatch`（`head` / `tail`），由注册表统一拼接；插件抛错只记录，
   绝不中断请求。

## 加一个插件

1. 新建 `src/plugins/<名字>/index.ts`，导出 `<名字>Plugin`；有内置正文时可另建 `prompt.ts`。
2. 在 `src/plugins/index.ts` 的 `plugins` 数组里加一行。
3. 在设置页的插件列表里加对应文案与开关；需要持久化配置时，在 `src/services/settings.ts`
   的插件状态结构里使用该插件的 `name`。
4. 跑 `pnpm type` 与 `pnpm lint`。

## 宿主挂钩点

只有一处：`src/services/chat/store.ts` 组装请求时调用

```ts
composeSystemPrompt(SYSTEM_PROMPT, messages, settings.pluginSettings)
```

除此之外不改任何既有文件。