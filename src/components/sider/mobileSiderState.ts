import { create } from 'zustand'

/**
 * 移动端侧边栏抽屉状态。
 * progress 为 0～1 的实时打开比例，拖动时用于抽屉位移与遮罩透明度；
 * dragging 为 true 时关掉 CSS 过渡，保证手指拖动跟手。
 */
type MobileSiderState = {
  open: boolean
  progress: number
  dragging: boolean
}

export const useMobileSider = create<MobileSiderState>(() => ({
  open: false,
  progress: 0,
  dragging: false,
}))

export const openMobileSider = () => {
  const { open, progress } = useMobileSider.getState()
  if (open && progress === 1) {
    return
  }
  useMobileSider.setState({ open: true, dragging: false, progress })
  if (open || progress > 0) {
    // 拖拽松手或回弹：已经挂载且过渡已恢复，直接落到终点即可
    useMobileSider.setState({ progress: 1 })
    return
  }
  // 首次从按钮打开：先按收起状态挂载，等两帧再拉开，过渡才会从左侧开始
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (useMobileSider.getState().open) {
        useMobileSider.setState({ progress: 1 })
      }
    })
  })
}

export const closeMobileSider = () => {
  const { open, progress, dragging } = useMobileSider.getState()
  if (!open && progress === 0 && !dragging) {
    return
  }
  useMobileSider.setState({ open: false, progress: 0, dragging: false })
}

/** 手势拖动中更新打开比例；不改变 open，松手后才决定最终状态 */
export const setMobileSiderProgress = (progress: number) => {
  useMobileSider.setState({ progress, dragging: true })
}