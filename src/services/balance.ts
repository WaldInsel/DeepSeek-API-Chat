import { create } from 'zustand'
import { openExternal } from '../app/systemBars.js'
import { API_ORIGIN, request } from './api/client.js'
import { useSettings } from './settings.js'

/** DeepSeek 开放平台的用量页 */
export const USAGE_URL = 'https://platform.deepseek.com/usage'

export const openUsage = () => openExternal(USAGE_URL)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 余额接口可能返回多种币种，这里只取人民币账户 */
const readCnyBalance = (value: unknown): string | null => {
  if (!isRecord(value) || !Array.isArray(value.balance_infos)) {
    return null
  }
  for (const info of value.balance_infos) {
    if (isRecord(info) && info.currency === 'CNY' && typeof info.total_balance === 'string') {
      return info.total_balance
    }
  }
  return null
}

type BalanceState = {
  /** 人民币总余额；未配置 Key、请求失败或接口没有 CNY 账户时为 null */
  amount: string | null
  refresh: () => Promise<void>
}

let controller: AbortController | null = null

export const useBalance = create<BalanceState>((set) => ({
  amount: null,
  refresh: async () => {
    controller?.abort()
    const apiKey = useSettings.getState().apiKey
    if (!apiKey) {
      set({ amount: null })
      return
    }
    const current = new AbortController()
    controller = current
    try {
      const response = await request(`${API_ORIGIN}/user/balance`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: current.signal,
      })
      set({ amount: readCnyBalance(await response.json()) })
    } catch {
      // 余额只做展示，失败时保留 ¥—，不打断对话流程
      if (!current.signal.aborted) {
        set({ amount: null })
      }
    } finally {
      if (controller === current) {
        controller = null
      }
    }
  },
}))