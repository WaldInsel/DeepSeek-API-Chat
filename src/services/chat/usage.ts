import type { MessageUsage } from '../api/types.js'

/** 当前两个模型的上下文长度均为 1M tokens */
export const CONTEXT_WINDOW_TOKENS = 1_000_000

export type TokenUsageSummary = {
  /** 本次请求的总输入，含缓存命中部分 */
  inputTokens: number
  /** 总输入中未命中缓存的部分 */
  uncachedTokens: number
  /** 总输入中命中缓存的部分 */
  cachedTokens: number
  outputTokens: number
  /** 总输入 + 输出 */
  totalTokens: number
  /** 这一轮结束时的上下文 token 数 */
  contextTokens: number
  /** 缓存命中率，0 ~ 1 */
  hitRate: number
  /** 上下文占用量，0 ~ 1 */
  contextRatio: number
}

const tokens = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0

/** 导入记录只还原上下文总量，没有输出与缓存拆分 */
export const hasTokenBreakdown = (usage: MessageUsage) =>
  tokens(usage.output_tokens) > 0 ||
  tokens(usage.cache_read_input_tokens) > 0 ||
  tokens(usage.cache_creation_input_tokens) > 0

export const summarizeUsage = (usage: MessageUsage): TokenUsageSummary => {
  const cachedTokens = tokens(usage.cache_read_input_tokens)
  const uncachedTokens = tokens(usage.input_tokens) + tokens(usage.cache_creation_input_tokens)
  const inputTokens = uncachedTokens + cachedTokens
  const outputTokens = tokens(usage.output_tokens)
  const totalTokens = inputTokens + outputTokens
  return {
    inputTokens,
    uncachedTokens,
    cachedTokens,
    outputTokens,
    totalTokens,
    contextTokens: totalTokens,
    hitRate: inputTokens > 0 ? cachedTokens / inputTokens : 0,
    contextRatio: Math.min(1, totalTokens / CONTEXT_WINDOW_TOKENS),
  }
}