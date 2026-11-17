/** MainActivity 注入的原生桥接，只有 Android 上有 */
type SystemBarsBridge = {
  /** 返回 {"top":<CSS px>,"bottom":<CSS px>,"ime":<CSS px>,"screen":<CSS px>} */
  getInsets: () => string
  setDarkIcons: (dark: boolean) => void
  /** 交给系统浏览器打开链接（WebView 里 window.open 不可靠） */
  openExternal?: (url: string) => void
}

type Insets = { top: number; bottom: number; ime: number; screen: number }

declare global {
  interface Window {
    SystemBars?: SystemBarsBridge
    __applySystemInsets?: (top: number, bottom: number, ime?: number, screen?: number) => void
  }
}

const toCssPixels = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

/**
 * 输入法实际遮挡的高度（CSS px）。
 * 部分机型会让窗口随输入法 resize（此时视觉视口已经变矮），部分机型只派发 ime insets，
 * 这里用「屏幕总高 - 当前视口高度」判断已缩掉多少，避免两边各扣一次把页面顶过头。
 */
const resolveKeyboardHeight = (ime: number, screen: number) => {
  const imePixels = toCssPixels(ime)
  if (imePixels === 0) {
    return 0
  }
  const viewportHeight = window.innerHeight
  const covered = screen > 0 ? Math.max(0, Math.round(screen) - viewportHeight) : 0
  return Math.max(0, imePixels - Math.min(covered, imePixels))
}

/**
 * 把系统安全区写成 CSS 变量，组件只读变量，不依赖 WebView 的 env()。
 * ime 是键盘高度：vivo / OPPO 这类不缩 visualViewport 的机器只能靠它把页面顶起来。
 */
export const applySystemInsets = (top: number, bottom: number, ime = 0, screen = 0) => {
  const style = document.documentElement.style
  style.setProperty('--safe-top', `${toCssPixels(top)}px`)
  style.setProperty('--safe-bottom', `${toCssPixels(bottom)}px`)
  style.setProperty('--ime-bottom', `${resolveKeyboardHeight(ime, screen)}px`)
}

const parseInsets = (raw: string): Insets => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return { top: 0, bottom: 0, ime: 0, screen: 0 }
    }
    const { top, bottom, ime, screen } = value as {
      top?: unknown
      bottom?: unknown
      ime?: unknown
      screen?: unknown
    }
    return {
      top: toCssPixels(top),
      bottom: toCssPixels(bottom),
      ime: toCssPixels(ime),
      screen: toCssPixels(screen),
    }
  } catch {
    return { top: 0, bottom: 0, ime: 0, screen: 0 }
  }
}

/** 当前页面被输入法遮挡的高度，0 表示键盘收起 */
export const getImeInset = () => {
  const value = Number.parseFloat(document.documentElement.style.getPropertyValue('--ime-bottom'))
  return Number.isFinite(value) && value > 0 ? value : 0
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
  // 标记「高度由原生键盘驱动」，只有这时才给 .app-frame 加高度过渡：
  // 网页端 dvh 会随地址栏伸缩变化，加过渡会拖影。
  document.documentElement.dataset.nativeInsets = ''
  const { top, bottom, ime, screen } = parseInsets(systemBars.getInsets())
  applySystemInsets(top, bottom, ime, screen)
}
