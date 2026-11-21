/**
 * 插件注册表 —— 宿主唯一认的入口。
 *
 * 这个项目是"静态写死 + 编译期打包"的架构，没有运行时模块加载，所以插件也不做动态加载：
 * 加插件 = 在 plugins 数组里加一行；删插件 = 删一行。写进来即生效，没有开关。
 *
 * 宿主只在 src/services/chat/store.ts 组装请求时调用一次 composeSystemPrompt()。
 */
import type { PluginMessage, PromptPatch, PromptPlugin } from './types.js'
import { nsfwPlugin } from './nsfw/index.js'
import { purgePlugin } from './purge/index.js'

export type { PluginContext, PluginMessage, PromptPatch, PromptPlugin } from './types.js'

/** 注册表：顺序不重要，真正的执行顺序看各自的 order */
export const plugins: readonly PromptPlugin[] = [nsfwPlugin, purgePlugin]

/** 最近一次运行失败记录，供将来的设置页展示；不在控制台打印（项目 lint 禁 no-console） */
export interface PluginError {
  readonly plugin: string
  readonly message: string
  readonly at: number
}

/** 只留最近 20 条，避免长会话里数组无限增长 */
const ERROR_LIMIT = 20
const errors: PluginError[] = []

/** 读失败记录；UI 想展示时调用，不展示也没人调用 */
export const readPluginErrors = (): readonly PluginError[] => errors

const recordError = (plugin: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error)
  errors.unshift({ plugin, message, at: Date.now() })
  if (errors.length > ERROR_LIMIT) {
    errors.length = ERROR_LIMIT
  }
}

const byOrder = (left: PromptPlugin, right: PromptPlugin): number =>
  (left.order ?? 0) - (right.order ?? 0)

/** 头部内容 → 原文 → 尾部内容，中间统一空一行 */
const combine = (text: string, patch: PromptPatch): string => {
  const head = patch.head?.trim()
  const tail = patch.tail?.trim()
  let result = text
  if (head) {
    result = `${head}\n\n${result}`
  }
  if (tail) {
    result = `${result}\n\n${tail}`
  }
  return result
}

/**
 * 把 system 提示词过一遍所有插件，返回最终文本。
 *
 * 铁律：单个插件抛错只记录、不抛出 —— 一次提示词拼接失败，绝不能变成一次请求失败。
 */
export const composeSystemPrompt = (
  system: string,
  messages: readonly PluginMessage[] = []
): string => {
  let text = system
  for (const plugin of [...plugins].sort(byOrder)) {
    try {
      const patch = plugin.apply({ system: text, messages })
      if (patch) {
        text = combine(text, patch)
      }
    } catch (error) {
      recordError(plugin.name, error)
    }
  }
  return text
}
