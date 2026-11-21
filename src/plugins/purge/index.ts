/**
 * 插件：purge（拒答兜底 / 破甲）。
 *
 * 拼在 system 最后面（tail）：压首轮推脱的规则要"离提问最近"才有效。
 * 正文可在设置里编辑：config.text 非空时用用户版本，留空回退内置 PURGE_PROMPT。
 *
 * 第二阶段的"检测到拒答自动重试"不在这一版里 —— 那需要在流式事件循环里插手
 * （src/services/chat/store.ts 的 streamReply），属于第二个扩展点，先不碰。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'
import { PURGE_PROMPT } from './prompt.js'

interface PurgeConfig {
  readonly text?: unknown
}

const readText = (config: unknown): string => {
  if (!config || typeof config !== 'object') {
    return ''
  }
  const text = (config as PurgeConfig).text
  return typeof text === 'string' ? text.trim() : ''
}

export const purgePlugin: PromptPlugin = {
  name: 'purge',
  order: 900,
  defaultText: PURGE_PROMPT,
  apply({ config }): PromptPatch {
    return { tail: readText(config) || PURGE_PROMPT }
  },
}