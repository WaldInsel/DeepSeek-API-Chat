import { useEffect } from 'react'
import { closeMobileSider, openMobileSider, useMobileSider } from './mobileSiderState.js'

/** 从屏幕左侧多宽以内起手，才算在拉出侧边栏（避开安卓系统返回手势的触发带） */
const EDGE_WIDTH = 40
/** 横向移动超过这个距离才接管手势，避免误伤点击和纵向滚动 */
const ACTIVATE_DISTANCE = 12
/** 右滑打开、左滑收起所需的距离 */
const OPEN_DISTANCE = 56
const CLOSE_DISTANCE = 64

/**
 * 移动端抽屉手势：屏幕左侧右滑拉出对话列表，抽屉上左滑收起。
 * 只接管横向手势，纵向滑动照常交给列表滚动。
 */
export const useSwipeDrawer = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    let startX = 0
    let startY = 0
    let tracking = false
    let horizontal = false

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
      const touch = event.touches[0]
      tracking = useMobileSider.getState().open || touch.clientX <= EDGE_WIDTH
      startX = touch.clientX
      startY = touch.clientY
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
        horizontal = true
      }
      if (event.cancelable) {
        event.preventDefault()
      }
      if (useMobileSider.getState().open) {
        if (dx <= -CLOSE_DISTANCE) {
          tracking = false
          closeMobileSider()
        }
        return
      }
      if (dx >= OPEN_DISTANCE) {
        tracking = false
        openMobileSider()
      }
    }

    const end = () => {
      tracking = false
      horizontal = false
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
