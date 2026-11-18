/**
 * 安卓返回键的浮层关闭栈：后注册的优先。
 * 返回栈只在浮层挂载期间注册，退出动画播放期间仍然拦截返回，避免误关下面的页面。
 */
const handlers: (() => void)[] = []

export const pushBackHandler = (close: () => void) => {
  handlers.push(close)
  return () => {
    const index = handlers.lastIndexOf(close)
    if (index >= 0) {
      handlers.splice(index, 1)
    }
  }
}

/** 关闭最上层的浮层；没有注册的浮层时返回 false */
export const runBackHandler = (): boolean => {
  const close = handlers.at(-1)
  if (!close) {
    return false
  }
  close()
  return true
}