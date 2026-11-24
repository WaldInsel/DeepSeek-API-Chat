/**
 * 把冷路径接到真实世界：读本轮会话、读档案与便条、发请求、把结果写回去。
 *
 * `deriveProfile()` 刻意不认识网络与存储，所以这一层负责三件事：
 * 1. 取会话里「能进整理的轮次」（与上下文同规则：成对、且回答可用）；
 * 2. 用用户自己的 API Key 发一次 flash 请求，30 秒超时；
 * 3. 成功才落盘（档案 + 水位 + 便条回应 + 失败清零），失败只把失败计数 +1。
 *
 * 手动触发是这一步的唯一入口，自动调度留给下一步。
 */
import { createMessage } from '../api/client.js'
import type { CreateMessageRequest } from '../api/types.js'
import { loadSession } from '../chat/db.js'
import { useChatStore } from '../chat/store.js'
import type { Session } from '../chat/types.js'
import { useSettings } from '../settings.js'
import { deriveProfile, type DeriveOutcome } from './index.js'
import { readMemoryProfile, readMemoryState, writeMemoryProfile, writeMemoryState } from './store.js'
import { collectTurns } from './turns.js'

/** 整理请求的超时；超时算一次失败，旧档案一个字都不动 */
const DERIVE_TIMEOUT = 30 * 1000

/** 超时用 setTimeout + AbortController 手写：AbortSignal.timeout() 超出 legacy 目标 */
const sendWithTimeout = async (
  apiKey: string,
  request: CreateMessageRequest
): Promise<string> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DERIVE_TIMEOUT)
  try {
    return await createMessage(apiKey, request, controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

const readSession = async (sessionId: string): Promise<Session | undefined> => {
  const cached = useChatStore.getState().sessionCache[sessionId]
  return cached ?? (await loadSession(sessionId))
}

/**
 * 手动整理的结果，两态判别联合：`blocked` 表示根本没发请求（原因不同，UI 提示也不同），
 * 否则必有 `outcome`。别拿一个 null 兼表「缺 Key」和「会话读不出来」，那会让用户
 * 以为要填的 Key 已经填过了。
 */
export type DeriveResult =
  | { readonly blocked: 'no-key' | 'no-session' }
  | { readonly blocked?: undefined; readonly outcome: DeriveOutcome }

/**
 * 手动整理一次指定会话。
 *
 * 没有 Key 时「只留未处理计数」—— 活动记录由回答收尾处写，这里不动水位。
 */
export const deriveMemoryForSession = async (
  sessionId: string | null
): Promise<DeriveResult> => {
  const apiKey = useSettings.getState().apiKey ?? ''
  if (!apiKey) {
    return { blocked: 'no-key' }
  }
  // 欢迎页（没有活动会话）时不算「缺 Key」：没有东西可整理而已
  if (sessionId === null) {
    return { blocked: 'no-session' }
  }
  const session = await readSession(sessionId)
  if (!session) {
    return { blocked: 'no-session' }
  }
  const state = readMemoryState()
  const outcome = await deriveProfile({
    profile: readMemoryProfile(),
    notes: state.notes,
    messages: collectTurns(session),
    processedCount: state.watermarks[sessionId]?.processedCount ?? 0,
    failures: state.failures,
    now: Date.now(),
    send: (request) => sendWithTimeout(apiKey, request),
  })
  if (outcome.status === 'updated') {
    // 档案、水位、便条回应同一笔落盘：要么都成，要么都不成
    writeMemoryProfile(outcome.profile)
    writeMemoryState({
      ...state,
      notes: outcome.notes,
      watermarks: {
        ...state.watermarks,
        [sessionId]: { processedCount: outcome.processedCount, at: outcome.profile.updatedAt },
      },
      failures: 0,
      lastDerivedAt: outcome.profile.updatedAt,
    })
  } else if (outcome.status === 'failed') {
    writeMemoryState({ ...state, failures: outcome.failures })
  }
  return { outcome }
}
