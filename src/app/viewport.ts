import { useEffect, useRef, useSyncExternalStore } from 'react'

/** 窄于 768px 按移动端布局 */
const query = window.matchMedia('not all and (min-width: 768px)')

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export const useIsMobile = () => useSyncExternalStore(subscribe, () => query.matches)

/** 原生下发的高度，0 表示原生还没算出结果 */
const readNativeFrameHeight = () => {
  const value = Number.parseFloat(
    document.documentElement.style.getPropertyValue('--app-frame-height')
  )
  return Number.isFinite(value) ? value : 0
}

/**
 * 部分内核（小米等）的 visualViewport 会随键盘一起变矮，但 MainActivity 的
 * ime insets / 可见区域在另一些 ROM（oppo、vivo、华为）上拿不到。这里只做兜底：
 * 视觉视口明显矮于原生高度时才覆盖页面高度，键盘收起后立刻交回原生，
 * 所以不会把底部导航栏（小白条）的区域一起吃掉。
 */
export const useNativeKeyboardFallback = (enabled: boolean) => {
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const viewport = window.visualViewport
    const frame = frameRef.current
    if (!viewport || !frame || !window.SystemBars) {
      return
    }

    let animationFrame = 0
    const reset = () => frame.style.removeProperty('--app-frame-height')
    const update = () => {
      if (viewport.scale !== 1) {
        reset()
        return
      }
      const nativeHeight = readNativeFrameHeight()
      const baseline = nativeHeight > 0 ? nativeHeight : window.innerHeight
      if (viewport.height < baseline - 40) {
        frame.style.setProperty('--app-frame-height', `${Math.round(viewport.height)}px`)
      } else {
        reset()
      }
    }
    const schedule = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(update)
    }

    update()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(animationFrame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reset()
    }
  }, [enabled])

  return frameRef
}

const preventPageScroll = (event: TouchEvent) => {
  if (event.touches.length !== 1) {
    return
  }
  for (
    let element = event.target instanceof Element ? event.target : null;
    element && element !== document.body;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element)
    const scrollsY =
      /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight
    const scrollsX =
      /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth
    if (scrollsY || scrollsX) {
      return
    }
  }
  event.preventDefault()
}

/** 阻止移动端整页滚动，保留内部可滚动区域的滚动和双指缩放。 */
export const usePreventPageScroll = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    document.addEventListener('touchmove', preventPageScroll, { passive: false })
    return () => document.removeEventListener('touchmove', preventPageScroll)
  }, [enabled])
}