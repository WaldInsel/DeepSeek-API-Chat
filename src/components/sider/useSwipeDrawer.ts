import { useEffect } from 'react'
import {
  closeMobileSider,
  openMobileSider,
  setMobileSiderProgress,
  useMobileSider,
} from './mobileSiderState.js'

/** 从屏幕左侧多宽以内起手，直接算在拉出侧边栏（避开安卓系统返回手势的触发带） */
const EDGE_WIDTH = 40
/** 横向移动超过这个距离就接管手势；阈值很小，手一动抽屉就开始跟手 */
const ACTIVATE_DISTANCE = 6
/** 关闭态拖过这个比例就打开，留一点回弹区间 */
const OPEN_AT = 0.3
/** 打开态拖到这个比例以下就关闭 */
const CLOSE_AT = 0.7
/** 甩动速度阈值（px/ms）：手速快时不再要求拖够比例 */
const FLING_VELOCITY = 0.35

/** 这些区域自己处理横向手势：文字选择、滑块拖动、横向滚动的内容 */
const IGNORE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radiogroup"], [data-swipe-ignore]'

/** 内容真的能横向滚动时才让给内容；仅仅写了 overflow-x:auto 但没超宽不影响拉抽屉 */
const hasHorizontalScrollable = (target: Element) => {
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) {
      continue
    }
    const { overflowX } = getComputedStyle(node)
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      return true
    }
  }
  return false
}

/** 从这块内容起手时是否不该拉抽屉 */
const isSwipeBlocked = (target: Element | null) =>
  target !== null && (target.closest(IGNORE_SELECTOR) !== null || hasHorizontalScrollable(target))

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
 * 移动端抽屉手势：主界面与对话界面任意位置右滑拉出、抽屉上左滑收起。
 * 输入框、滑块、横向可滚动内容等会自己处理横向手势的区域不接管；
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
    let startTarget: Element | null = null
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
      startTarget = null
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
      // 关闭态整个界面都可能起手；输入框、滑块、横向滚动内容这类排除判断
      // 推迟到 move 里横向意图明确后做，普通点击和上下滚动不付这份开销
      tracking = true
      startTarget = target
      startX = touch.clientX
      startY = touch.clientY
      width = Math.max(1, drawerWidth())
      samples.length = 0
      record(touch.clientX)
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
        // 横向意图明确了，才判断这块内容是否自己处理横向手势；
        // 左边缘保持优先，系统返回手势带内直接交给抽屉
        if (!openedAtStart && startX > EDGE_WIDTH && isSwipeBlocked(startTarget)) {
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
      // 松手后保持 dragging 到下一帧：抽屉靠它维持挂载，落点时再恢复过渡，
      // 否则位移和过渡同帧切换会没有动画，还会让拖动中的抽屉提前卸载
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