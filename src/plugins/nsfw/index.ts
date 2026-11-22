/**
 * 插件：NSFW 创作注入。
 *
 * 拼在 system 最前面（head）：它是"模式总纲"，先立角色再谈其它。
 * 想换成尾部（离用户提问最近、服从率更高），把 head 改成 tail 即可。
 *
 * 正文可在设置里编辑：config.text 非空时用用户版本，留空回退内置 NSFW_PROMPT。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'
import { NSFW_PROMPT } from './prompt.js'

interface NsfwConfig {
  readonly text?: unknown
}

const readText = (config: unknown): string => {
  if (!config || typeof config !== 'object') {
    return ''
  }
  const text = (config as NsfwConfig).text
  return typeof text === 'string' ? text.trim() : ''
}

export const nsfwPlugin: PromptPlugin = {
  name: 'nsfw',
  order: 100,
  community: true,
  ui: {
    labelKey: 'pluginNsfwLabel',
    descriptionKey: 'pluginNsfwDescription',
    hintKey: 'pluginPromptHintBuiltin',
    editable: true,
  },
  defaultText: NSFW_PROMPT,
  apply({ config }): PromptPatch {
    return { head: readText(config) || NSFW_PROMPT }
  },
}