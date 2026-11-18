import { useEffect, useRef, useSyncExternalStore } from 'react'

/** 窄于 768px 按移动端布局 */
const query = window.matchMedia('not all and (min-width: 768px)')

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export const useIsMobile = () => useSyncExternalStore(subscribe, () => query.matches)

/**
 * 手机端页面跟随视觉视口，键盘弹出后顶栏和输入框仍留在可见区域。
 * 安卓 App 里 MainActivity 会把 WebView 容器直接 resize 到键盘顶部
 * （Capacitor Keyboard 插件同款做法），visualViewport 高度和 WebView 高度一致，
 * 这里设置的是同一个值，不会重复扣减；键盘收起后变量回到整屏高度，
 * 底部导航栏（小白条）区域也能完整覆盖。
 */
export const useMobileViewport = (enabled: boolean) => {
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const frame = frameRef.current
    const viewport = window.visualViewport
    if (!frame || !viewport) {
      return
    }

    let animationFrame = 0
    const reset = () => {
      frame.style.removeProperty('--app-viewport-height')
      frame.style.removeProperty('--app-viewport-top')
    }
    const update = () => {
      if (viewport.scale !== 1) {
        reset()
        return
      }
      frame.style.setProperty('--app-viewport-height', `${Math.round(viewport.height)}px`)
      frame.style.setProperty('--app-viewport-top', `${Math.round(viewport.offsetTop)}px`)
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