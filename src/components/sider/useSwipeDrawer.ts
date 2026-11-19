import { useEffect } from 'react'
import {
  closeMobileSider,
  openMobileSider,
  setMobileSiderProgress,
  useMobileSider,
} from './mobileSiderState.js'

/** 从屏幕左侧多宽以内起手，才算在拉出侧边栏（避开安卓系统返回手势的触发带） */
const EDGE_WIDTH = 40
/** 横向移动超过这个距离才接管手势，避免误伤点击和纵向滚动 */
const ACTIVATE_DISTANCE = 12
/** 关闭态拖过这个比例就打开，留一点回弹区间 */
const OPEN_AT = 0.3
/** 打开态拖到这个比例以下就关闭 */
const CLOSE_AT = 0.7
/** 甩动速度阈值（px/ms）：手速快时不再要求拖够比例 */
const FLING_VELOCITY = 0.35

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** 与 CSS 的 300px / calc(100vw - 48px) 一致；抽屉已挂载时直接量实际宽度 */
const drawerWidth = () => {
  const drawer = document.querySelector('[data-mobile-sider]')
  if (drawer instanceof HTMLElement) {
    return drawer.getBoundingClientRect().width
  }
  return Math.min(300, window.innerWidth - 48)
}

/**
 * 移动端抽屉手势：左边缘右滑拉出、抽屉上左滑收起。
 * 拖动过程中实时更新抽屉位移，松手后按当前进度决定打开还是关闭；
 * 横向手势才接管，纵向滑动照常交给列表滚动。
 */
export const useSwipeDrawer = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    let startX = 0
    let startY = 0
    let width = 1
    let tracking = false
    let horizontal = false
    let openedAtStart = false
    /** 最近 100ms 的横向位置，用来算松手时的甩动速度 */
    const samples: { x: number; t: number }[] = []

    const record = (x: number) => {
      const now = performance.now()
      samples.push({ x, t: now })
      while (samples.length > 2 && now - samples[0].t > 100) {
        samples.shift()
      }
    }

    const velocity = () => {
      const now = performance.now()
      const recent = samples.filter((sample) => now - sample.t <= 100)
      if (recent.length < 2) {
        return 0
      }
      const first = recent[0]
      const last = recent[recent.length - 1]
      return last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
    }

    const start = (event: TouchEvent) => {
      tracking = false
      horizontal = false
      if (event.touches.length !== 1) {
        return
      }
      // 弹窗盖在上面时不响应，免得把背后的抽屉一起拖出来
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[role="dialog"]')) {
        return
      }
      const state = useMobileSider.getState()
      const touch = event.touches[0]
      openedAtStart = state.open
      tracking = openedAtStart || touch.clientX <= EDGE_WIDTH
      startX = touch.clientX
      startY = touch.clientY
      width = Math.max(1, drawerWidth())
      if (tracking) {
        samples.length = 0
        record(touch.clientX)
      }
    }

    const move = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) {
        return
      }
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (!horizontal) {
        // 纵向优先：让位给列表滚动
        if (Math.abs(dy) > Math.abs(dx)) {
          tracking = false
          return
        }
        if (Math.abs(dx) < ACTIVATE_DISTANCE) {
          return
        }
        // 关闭态只接管右滑，左滑没有任何可拖的内容
        if (!openedAtStart && dx < 0) {
          tracking = false
          return
        }
        horizontal = true
      }
      if (event.cancelable) {
        event.preventDefault()
      }
      record(touch.clientX)
      setMobileSiderProgress(openedAtStart ? clamp01(1 + dx / width) : clamp01(dx / width))
    }

    const end = () => {
      const state = useMobileSider.getState()
      const wasDragging = horizontal && state.dragging
      tracking = false
      horizontal = false
      if (!wasDragging) {
        return
      }
      // 手速优先：快速右甩直接打开、快速左甩直接关闭；慢速拖动才看拖过了多少比例
      const vx = velocity()
      let shouldOpen: boolean
      if (vx > FLING_VELOCITY) {
        shouldOpen = true
      } else if (vx < -FLING_VELOCITY) {
        shouldOpen = false
      } else {
        shouldOpen = state.open ? state.progress > CLOSE_AT : state.progress > OPEN_AT
      }
      // 先恢复 CSS 过渡，下一帧再落到终点，否则位移和过渡同帧切换会没有动画
      useMobileSider.setState({ dragging: false })
      requestAnimationFrame(() => {
        if (shouldOpen) {
          openMobileSider()
        } else {
          closeMobileSider()
        }
      })
    }

    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [enabled])
}