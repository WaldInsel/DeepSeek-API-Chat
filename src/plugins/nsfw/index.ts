/**
 * 插件：NSFW 创作注入。
 *
 * 拼在 system 最前面（head）：它是"模式总纲"，先立角色再谈其它。
 * 想换成尾部（离用户提问最近、服从率更高），把 head 改成 tail 即可。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'
import { NSFW_PROMPT } from './prompt.js'

export const nsfwPlugin: PromptPlugin = {
  name: 'nsfw',
  order: 100,
  apply(): PromptPatch {
    return { head: NSFW_PROMPT }
  },
}
