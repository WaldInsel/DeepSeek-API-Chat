/** MainActivity 注入的原生桥接，只有 Android 上有 */
type SystemBarsBridge = {
  /** 返回 {"top":<CSS px>,"bottom":<CSS px>,"frame":<CSS px>} */
  getInsets: () => string
  setDarkIcons: (dark: boolean) => void
  /** 交给系统浏览器打开链接（WebView 里 window.open 不可靠） */
  openExternal?: (url: string) => void
}

type Insets = { top: number; bottom: number; frame: number }

declare global {
  interface Window {
    SystemBars?: SystemBarsBridge
    __applySystemLayout?: (top: number, bottom: number, frame?: number) => void
  }
}

const toCssPixels = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

/**
 * 把原生算好的安全区和页面高度写成 CSS 变量，组件只读变量。
 * frame 是「页面应该显示多高」：键盘收起时等于整屏高，弹出时停在键盘顶部。
 * 页面不再自己拿 100dvh 去扣键盘，避免系统栏、手势条高度被重复计算。
 */
export const applySystemLayout = (top: number, bottom: number, frame = 0) => {
  const style = document.documentElement.style
  style.setProperty('--safe-top', `${toCssPixels(top)}px`)
  style.setProperty('--safe-bottom', `${toCssPixels(bottom)}px`)
  const frameHeight = toCssPixels(frame)
  if (frameHeight > 0) {
    style.setProperty('--app-frame-height', `${frameHeight}px`)
  } else {
    // 原生测量还没就绪，交给 CSS 的 100dvh 兜底
    style.removeProperty('--app-frame-height')
  }
}

const parseInsets = (raw: string): Insets => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return { top: 0, bottom: 0, frame: 0 }
    }
    const { top, bottom, frame } = value as {
      top?: unknown
      bottom?: unknown
      frame?: unknown
    }
    return {
      top: toCssPixels(top),
      bottom: toCssPixels(bottom),
      frame: toCssPixels(frame),
    }
  } catch {
    return { top: 0, bottom: 0, frame: 0 }
  }
}

/** 状态栏和导航栏的图标明暗跟随应用主题 */
export const syncSystemBarIcons = (dark: boolean) => {
  window.SystemBars?.setDarkIcons(dark)
}

/** 接管全面屏留白；网页端没有桥接，保持 CSS 里的 env() 兜底 */
export const setupSystemBars = () => {
  // 即使桥接没注入，也允许原生主动推送（页面加载完成前后各推一次）
  window.__applySystemLayout = applySystemLayout
  const systemBars = window.SystemBars
  if (!systemBars) {
    return
  }
  // 标记「高度由原生驱动」，只有这时才给 .app-frame 加高度过渡：
  // 网页端 dvh 会随地址栏伸缩变化，加过渡会拖影。
  document.documentElement.dataset.nativeInsets = ''
  const { top, bottom, frame } = parseInsets(systemBars.getInsets())
  applySystemLayout(top, bottom, frame)
}