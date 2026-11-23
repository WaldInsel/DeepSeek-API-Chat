import { useAdvancedMode } from '../services/advancedMode.js'
import { useSettings, type ChatFontSize } from '../services/settings.js'

/** 档位对应的缩放系数，乘在对话内容与对话列表的字号、行高和列表项高度上 */
const SCALES: Record<ChatFontSize, number> = {
  small: 0.9,
  standard: 1,
  large: 1.1,
  xlarge: 1.25,
}

let appliedScale: number | null = null

/** 只在高级模式下应用档位；退出高级模式时回到标准，已保存的档位保留 */
const syncChatFont = () => {
  const size = useAdvancedMode.getState().enabled
    ? useSettings.getState().chatFontSize
    : 'standard'
  const scale = SCALES[size]
  if (scale === appliedScale) {
    return
  }
  appliedScale = scale
  document.documentElement.style.setProperty('--chat-font-scale', String(scale))
}

/** 首屏渲染前同步应用一次，之后随字号设置与高级模式切换更新 */
export const setupChatFont = () => {
  syncChatFont()
  useSettings.subscribe(syncChatFont)
  useAdvancedMode.subscribe(syncChatFont)
}
