/**
 * 插件：purge（拒答兜底 / 破甲）。
 *
 * 拼在 system 最后面（tail）：压首轮推脱的规则要"离提问最近"才有效。
 *
 * 第二阶段的"检测到拒答自动重试"不在这一版里 —— 那需要在流式事件循环里插手
 * （src/services/chat/store.ts 的 streamReply），属于第二个扩展点，先不碰。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'
import { PURGE_PROMPT } from './prompt.js'

export const purgePlugin: PromptPlugin = {
  name: 'purge',
  order: 900,
  apply(): PromptPatch {
    return { tail: PURGE_PROMPT }
  },
}
