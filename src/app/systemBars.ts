/** MainActivity 注入的原生桥接，只有 Android 上有 */
type SystemBarsBridge = {
  /** 返回 {"top":<CSS px>,"bottom":<CSS px>} */
  getInsets: () => string
  setDarkIcons: (dark: boolean) => void
}

declare global {
  interface Window {
    SystemBars?: SystemBarsBridge
    __applySystemInsets?: (top: number, bottom: number) => void
  }
}

const toCssPixels = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

/** 把系统安全区写成 CSS 变量，组件只读变量，不依赖 WebView 的 env() */
export const applySystemInsets = (top: number, bottom: number) => {
  const style = document.documentElement.style
  style.setProperty('--safe-top', `${toCssPixels(top)}px`)
  style.setProperty('--safe-bottom', `${toCssPixels(bottom)}px`)
}

const parseInsets = (raw: string): [number, number] => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return [0, 0]
    }
    const { top, bottom } = value as { top?: unknown; bottom?: unknown }
    return [toCssPixels(top), toCssPixels(bottom)]
  } catch {
    return [0, 0]
  }
}

/** 状态栏和导航栏的图标明暗跟随应用主题 */
export const syncSystemBarIcons = (dark: boolean) => {
  window.SystemBars?.setDarkIcons(dark)
}

/** 接管全面屏留白；网页端没有桥接，保持 CSS 里的 env() 兜底 */
export const setupSystemBars = () => {
  // 即使桥接没注入，也允许原生主动推送（页面加载完成前后各推一次）
  window.__applySystemInsets = applySystemInsets
  const systemBars = window.SystemBars
  if (!systemBars) {
    return
  }
  const [top, bottom] = parseInsets(systemBars.getInsets())
  applySystemInsets(top, bottom)
}
