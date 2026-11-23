/**
 * 插件：人格 / 文风（persona）。
 *
 * 拼在 system 最前面（head）：人格是"总纲"，先立身份再谈其它。
 * order 取 200，排在 nsfw（100）之后、custom-instructions（500）与 purge（900）之前，
 * 最终顺序为 PERSONA → NSFW → SYSTEM → CUSTOM → PURGE。
 *
 * 内置插件（不标 community）：普通用户也能在设置里直接开关，不需要进高级模式。
 *
 * 正文可在设置里编辑：config.text 非空时用用户版本，留空回退内置 PERSONA_PROMPT。
 * 预设列表不在这里 —— 设置页的编辑弹窗只认一段文本，预设由 UI 侧填入。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'
import { PERSONA_PRESETS } from './presets.js'
import { PERSONA_PROMPT } from './prompt.js'

interface PersonaConfig {
  readonly text?: unknown
}

const readText = (config: unknown): string => {
  if (!config || typeof config !== 'object') {
    return ''
  }
  const text = (config as PersonaConfig).text
  return typeof text === 'string' ? text.trim() : ''
}

export const personaPlugin: PromptPlugin = {
  name: 'persona',
  order: 200,
  ui: {
    labelKey: 'pluginPersonaLabel',
    descriptionKey: 'pluginPersonaDescription',
    hintKey: 'pluginPromptHintBuiltin',
    placeholderKey: 'pluginPersonaPlaceholder',
    editable: true,
    presets: PERSONA_PRESETS,
  },
  defaultText: PERSONA_PROMPT,
  apply({ config }): PromptPatch | undefined {
    const text = readText(config) || PERSONA_PROMPT
    return text ? { head: text } : undefined
  },
}
