/** MainActivity 注入的原生桥接，只有 Android 上有 */
type SystemBarsBridge = {
  /** 返回 {"top":<CSS px>,"bottom":<CSS px>,"ime":<CSS px>} */
  getInsets: () => string
  setDarkIcons: (dark: boolean) => void
  /** 交给系统浏览器打开链接（WebView 里 window.open 不可靠） */
  openExternal?: (url: string) => void
}

type Insets = { top: number; bottom: number; ime: number }

declare global {
  interface Window {
    SystemBars?: SystemBarsBridge
    __applySystemInsets?: (top: number, bottom: number, ime?: number) => void
  }
}

const toCssPixels = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

/**
 * 把系统安全区写成 CSS 变量，组件只读变量，不依赖 WebView 的 env()。
 * ime 是原生算好的键盘遮挡高度（已经排除窗口被 resize 抵消的部分）。
 * oppo / vivo / 华为这类既拿不到 ime insets、又不缩 visualViewport 的机器，
 * 只能靠原生兜底后的这个值把页面顶起来。
 */
export const applySystemInsets = (top: number, bottom: number, ime = 0) => {
  const style = document.documentElement.style
  style.setProperty('--safe-top', `${toCssPixels(top)}px`)
  style.setProperty('--safe-bottom', `${toCssPixels(bottom)}px`)
  style.setProperty('--ime-bottom', `${toCssPixels(ime)}px`)
}

const parseInsets = (raw: string): Insets => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return { top: 0, bottom: 0, ime: 0 }
    }
    const { top, bottom, ime } = value as {
      top?: unknown
      bottom?: unknown
      ime?: unknown
    }
    return {
      top: toCssPixels(top),
      bottom: toCssPixels(bottom),
      ime: toCssPixels(ime),
    }
  } catch {
    return { top: 0, bottom: 0, ime: 0 }
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
  // 标记「高度由原生键盘驱动」，只有这时才给 .app-frame 加高度过渡：
  // 网页端 dvh 会随地址栏伸缩变化，加过渡会拖影。
  document.documentElement.dataset.nativeInsets = ''
  const { top, bottom, ime } = parseInsets(systemBars.getInsets())
  applySystemInsets(top, bottom, ime)
}