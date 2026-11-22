import clsx from 'clsx'
import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from './icons.js'
import { IconButton } from './IconButton.js'
import styles from './Modal.module.css'

/** 当前打开的弹窗，后打开的在末尾；叠放时 Esc 只关闭最上层 */
const openModals: object[] = []

/** 向下拖过弹窗高度的这个比例就关闭 */
const PULL_CLOSE_RATIO = 0.25
/** 向下甩动速度阈值（px/ms）：手速快时不再要求拖够比例 */
const PULL_FLING_VELOCITY = 0.5

type PullState = {
  pointerId: number
  startY: number
  height: number
  samples: { y: number; t: number }[]
}

const pullVelocity = (samples: { y: number; t: number }[]) => {
  const now = performance.now()
  const recent = samples.filter((sample) => now - sample.t <= 100)
  if (recent.length < 2) {
    return 0
  }
  const first = recent[0]
  const last = recent[recent.length - 1]
  return last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
}

/** 遮罩 + 居中卡片，Esc / 点遮罩关闭 */
export const Modal = ({
  title,
  children,
  footer,
  closable = false,
  className,
  mainClassName,
  state = 'open',
  pullDownToClose = false,
  dismissible = true,
  onClose,
}: {
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** 标题栏右侧显示关闭按钮 */
  closable?: boolean
  className?: string
  /** 内容区的 class */
  mainClassName?: string
  /** 进出场状态，由 usePresence 驱动；关闭时保留 DOM 播放退出动画 */
  state?: 'open' | 'closed'
  /** 移动端在弹窗顶部显示可下拉关闭的小白条 */
  pullDownToClose?: boolean
  /** 是否允许点遮罩或按 Esc 关闭；为 false 时只能点标题栏的关闭按钮 */
  dismissible?: boolean
  onClose: () => void
}) => {
  const t = useTranslate()
  const titleId = useId()
  const isMobile = useIsMobile()
  const contentRef = useRef<HTMLDivElement>(null)
  const pullRef = useRef<PullState | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible
  useEffect(() => {
    const token = {}
    openModals.push(token)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals.at(-1) === token && dismissibleRef.current) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const pullEnabled = pullDownToClose && isMobile

  const settlePull = (content: HTMLElement) => {
    // 先恢复 CSS 过渡，下一帧再清掉内联位移，才有回弹动画
    content.style.transition = ''
    requestAnimationFrame(() => {
      content.style.removeProperty('transform')
    })
  }

  const onPullStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    const content = contentRef.current
    if (!content || pullRef.current) {
      return
    }
    pullRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      height: content.getBoundingClientRect().height,
      samples: [{ y: event.clientY, t: performance.now() }],
    }
    // 拖动时只改内联样式，不走 React 重渲染，跟手才不掉帧
    content.style.transition = 'none'
    try {
      // 按下就捕获：拖出弹窗范围松手也能收到 pointerup
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 指针已释放时忽略
    }
  }

  const onPullMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pull = pullRef.current
    const content = contentRef.current
    if (!pull || !content || event.pointerId !== pull.pointerId) {
      return
    }
    const now = performance.now()
    pull.samples.push({ y: event.clientY, t: now })
    while (pull.samples.length > 2 && now - pull.samples[0].t > 100) {
      pull.samples.shift()
    }
    // 只跟手向下；向上最多回到原位，避免把弹窗拖到状态栏上
    const dy = Math.min(pull.height, Math.max(0, event.clientY - pull.startY))
    content.style.transform = `translateY(${dy}px)`
  }

  const onPullEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pull = pullRef.current
    const content = contentRef.current
    if (!pull || !content || event.pointerId !== pull.pointerId) {
      return
    }
    pullRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pull.samples.push({ y: event.clientY, t: performance.now() })
    const dy = Math.max(0, event.clientY - pull.startY)
    const vy = pullVelocity(pull.samples)
    const shouldClose = vy > PULL_FLING_VELOCITY || (vy >= 0 && dy > pull.height * PULL_CLOSE_RATIO)
    if (!shouldClose) {
      settlePull(content)
      return
    }
    // 松手先把弹窗推到屏幕外，再交给 Modal 的关闭动画收尾，避免从当前位置先跳回去
    content.style.transition = ''
    content.style.transform = 'translateY(100%)'
    onClose()
    requestAnimationFrame(() => {
      content.style.removeProperty('transform')
    })
  }

  const onPullCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pull = pullRef.current
    if (!pull || event.pointerId !== pull.pointerId) {
      return
    }
    pullRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const content = contentRef.current
    if (content) {
      settlePull(content)
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      data-state={state}
      onMouseDown={(event) =>
        dismissible && event.target === event.currentTarget && onClose()
      }
    >
      <div
        ref={contentRef}
        className={clsx(styles.content, pullEnabled && styles.pullEnabled, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {pullEnabled ? (
          <div
            className={styles.pullHandle}
            aria-hidden="true"
            onPointerDown={onPullStart}
            onPointerMove={onPullMove}
            onPointerUp={onPullEnd}
            onPointerCancel={onPullCancel}
          >
            <span className={styles.pullBar} />
          </div>
        ) : null}
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          {closable ? (
            <IconButton
              className={styles.close}
              tone="primary"
              icon={<IconCloseOutline16 />}
              aria-label={t('close')}
              onClick={onClose}
            />
          ) : null}
        </div>
        {children ? <div className={clsx(styles.main, mainClassName)}>{children}</div> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}