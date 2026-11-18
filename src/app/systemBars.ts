/** MainActivity 注入的原生桥接，只有 Android 上有 */
type SystemBarsBridge = {
  /** 返回 {"top":<CSS px>,"bottom":<CSS px>} */
  getInsets: () => string
  setDarkIcons: (dark: boolean) => void
  /** 交给系统浏览器打开链接（WebView 里 window.open 不可靠） */
  openExternal?: (url: string) => void
}

type Insets = { top: number; bottom: number }

declare global {
  interface Window {
    SystemBars?: SystemBarsBridge
    __applySystemInsets?: (top: number, bottom: number) => void
    __applyFontWeight?: (adjustment: number) => void
  }
}

const toCssPixels = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

/**
 * 把系统安全区写成 CSS 变量，组件只读变量，不依赖 WebView 的 env()。
 * 页面高度不再由这里下发：安卓原生直接把 WebView 容器 resize 到键盘顶部，
 * CSS 的 100dvh / visualViewport 会自然跟随，避免两套高度互相打架。
 */
export const applySystemInsets = (top: number, bottom: number) => {
  const style = document.documentElement.style
  style.setProperty('--safe-top', `${toCssPixels(top)}px`)
  style.setProperty('--safe-bottom', `${toCssPixels(bottom)}px`)
}

/**
 * 安卓系统「字体粗细」：Configuration.fontWeightAdjustment 是 -1000..1000 的偏移量，
 * 直接叠加到四个字重档位上。网页端没有字重设置，保持 :root 里的默认值。
 */
export const applyFontWeight = (adjustment: number) => {
  const delta = Number.isFinite(adjustment) ? Math.round(adjustment) : 0
  const clamp = (value: number) => Math.min(1000, Math.max(1, Math.round(value)))
  const style = document.documentElement.style
  style.setProperty('--fw-normal', String(clamp(400 + delta)))
  style.setProperty('--fw-medium', String(clamp(500 + delta)))
  style.setProperty('--fw-semibold', String(clamp(600 + delta)))
  style.setProperty('--fw-bold', String(clamp(700 + delta)))
}

const parseInsets = (raw: string): Insets => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return { top: 0, bottom: 0 }
    }
    const { top, bottom } = value as { top?: unknown; bottom?: unknown }
    return {
      top: toCssPixels(top),
      bottom: toCssPixels(bottom),
    }
  } catch {
    return { top: 0, bottom: 0 }
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
  window.__applyFontWeight = applyFontWeight
  const systemBars = window.SystemBars
  if (!systemBars) {
    return
  }
  // 标记「高度由原生键盘驱动」，只有这时才给 .app-frame 加高度过渡：
  // 网页端 dvh 会随地址栏伸缩变化，加过渡会拖影。
  document.documentElement.dataset.nativeInsets = ''
  const { top, bottom } = parseInsets(systemBars.getInsets())
  applySystemInsets(top, bottom)
}