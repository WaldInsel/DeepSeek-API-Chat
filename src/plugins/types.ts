/**
 * 插件契约（编译期注册，不是运行时加载）。
 *
 * 三条约定，插件作者必须遵守：
 * 1. 单向依赖：插件只 import 本目录的 types.js，不 import 宿主的 store / api / 组件。
 * 2. 纯计算：插件是纯函数，不写 localStorage、不发请求、不读 DOM；要数据就由宿主通过
 *    PluginContext 传进来。这样插件出错最坏只是这轮提示词没拼上，不会把请求搞炸。
 * 3. 只回补丁：插件不直接改 system 字符串，而是返回 PromptPatch，由 registry 统一拼接，
 *    保证多个插件叠加时顺序和换行永远一致。
 */

/** 宿主交给插件的只读上下文 */
export interface PluginContext {
  /** 宿主原本的 system 提示词（已包含前面插件的产物，只读） */
  readonly system: string
  /** 本轮已经组装好的 messages 快照，插件只读，仅用于判断场景 */
  readonly messages: readonly PluginMessage[]
  /** 宿主注入的插件配置；未配置时为 undefined，插件需自行收窄类型 */
  readonly config?: unknown
}

/** messages 的最小可读形状：只要 role 和 content，不依赖 api/types.js */
export interface PluginMessage {
  readonly role: string
  readonly content: unknown
}

/** 插件返回的补丁；返回 undefined 表示这轮不插手 */
export interface PromptPatch {
  /** 拼在 system 最前面：适合"角色/模式"这类总纲 */
  readonly head?: string
  /** 拼在 system 最后面：离用户提问最近，适合"压推脱 / 兜底规则" */
  readonly tail?: string
}

export interface PromptPlugin {
  /** 唯一名字，用于报错定位与将来 UI 展示 */
  readonly name: string
  /** 多个插件时的执行顺序，小的先跑；不写按注册顺序 */
  readonly order?: number
  /** 内置正文：设置页拿它当编辑初值与留空回退；真正拼什么仍以 apply() 为准 */
  readonly defaultText?: string
  /** 唯一的扩展点：拿上下文，回补丁 */
  apply(context: PluginContext): PromptPatch | undefined
}
