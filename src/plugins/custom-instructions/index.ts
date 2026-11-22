/**
 * 插件：自定义指令。
 *
 * 用户填写的全局指令拼在 system 末尾（tail），离提问最近。
 * 正文来自设置，不存在内置默认文本；留空时这轮不插手。
 */
import type { PromptPatch, PromptPlugin } from '../types.js'

interface CustomInstructionsConfig {
  readonly text?: unknown
}

const readText = (config: unknown): string => {
  if (!config || typeof config !== 'object') {
    return ''
  }
  const text = (config as CustomInstructionsConfig).text
  return typeof text === 'string' ? text.trim() : ''
}

export const customInstructionsPlugin: PromptPlugin = {
  name: 'custom-instructions',
  order: 500,
  ui: {
    labelKey: 'pluginCustomInstructionsLabel',
    descriptionKey: 'pluginCustomInstructionsDescription',
    hintKey: 'pluginCustomInstructionsHint',
    placeholderKey: 'pluginCustomInstructionsPlaceholder',
    editable: true,
  },
  apply({ config }): PromptPatch | undefined {
    const text = readText(config)
    return text ? { tail: text } : undefined
  },
}