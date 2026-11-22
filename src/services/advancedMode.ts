import { create } from 'zustand'

const KEY = 'deepseek-api-chat:advanced-mode'
/** 连续点击版本号多少次才能进入高级模式 */
const REQUIRED_TAPS = 5
/** 两次点击的最大间隔，超过后重新计数，避免零星点击被累计 */
const TAP_WINDOW_MS = 1_500

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

/** 高级模式：全局开关，存 localStorage，进入后一直保持，再次点五次版本号退出 */
export const useAdvancedMode = create<{ enabled: boolean }>(() => ({ enabled: read() }))

export const setAdvancedMode = (enabled: boolean) => {
  try {
    if (enabled) {
      localStorage.setItem(KEY, 'true')
    } else {
      localStorage.removeItem(KEY)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
  useAdvancedMode.setState({ enabled })
}

let taps = 0
let timer = 0

const resetTaps = () => {
  taps = 0
}

/**
 * 版本号被点击一次：攒满五次后切换高级模式。
 * 返回切换后的状态；未攒满五次返回 null。
 */
export const registerVersionTap = (): boolean | null => {
  window.clearTimeout(timer)
  taps += 1
  if (taps < REQUIRED_TAPS) {
    timer = window.setTimeout(resetTaps, TAP_WINDOW_MS)
    return null
  }
  resetTaps()
  const enabled = !useAdvancedMode.getState().enabled
  setAdvancedMode(enabled)
  return enabled
}