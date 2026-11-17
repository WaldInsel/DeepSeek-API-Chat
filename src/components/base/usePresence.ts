import { useEffect, useState } from 'react'

/** 进出场动画时长（毫秒），需与 CSS 里的过渡时长一致；JS 只用来决定何时卸载 */
export const MOTION_DURATION = 240

/**
 * 打开 / 关闭的进出场状态。
 *
 * 关闭时先切成退出状态让 CSS 播完动画，等 `duration` 后再卸载，
 * 这样调用方只传一个布尔值，也能同时拿到进入和退出两个方向的过渡。
 * 返回 `mounted` 决定是否渲染，`visible` 决定用打开态还是关闭态的 class。
 */
export const usePresence = (open: boolean, duration = MOTION_DURATION) => {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), duration)
      return () => clearTimeout(timer)
    }
    setMounted(true)
    // 挂载后先按关闭状态画一帧，再切到打开状态，过渡才会从起点开始
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [open, duration])

  return { mounted, visible }
}
