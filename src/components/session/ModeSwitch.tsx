import clsx from 'clsx'
import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { setChatMode, useChatMode, type ChatMode } from '../../services/chatMode.js'
import { IconDiamondOutline16, IconLightningOutline16 } from '../base/icons.js'
import styles from './ModeSwitch.module.css'

const MODE_OPTIONS: { value: ChatMode; label: TranslationKey; icon: ReactNode }[] = [
  { value: 'flash', label: 'chatModeFlash', icon: <IconLightningOutline16 /> },
  { value: 'pro', label: 'chatModePro', icon: <IconDiamondOutline16 /> },
]

/** 横向移动超过这个距离才接管拖动，避免误伤点击 */
const DRAG_THRESHOLD = 3
/** 甩动速度阈值（px/ms）：手速快时直接切到对应模式 */
const FLING_VELOCITY = 0.35
/** 拖动时滑块允许超出轨道两端的余量，只留一点点缓冲 */
const OVERSHOOT = 3

type DragState = {
  pointerId: number
  startX: number
  startY: number
  origin: ChatMode
  active: boolean
  /** 两档滑块的绝对 left（px），用来把拖动锁在轨道范围内 */
  flashLeft: number
  proLeft: number
  originLeft: number
  /** 两档 left 的中点，越过即切换 */
  midLeft: number
  offset: number
  samples: { x: number; t: number }[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const parseLength = (value: string, base: number) => {
  const text = value.trim()
  const num = parseFloat(text)
  if (Number.isNaN(num)) {
    return 0
  }
  return text.endsWith('%') ? (num / 100) * base : num
}

const velocityOf = (samples: { x: number; t: number }[]) => {
  const now = performance.now()
  const recent = samples.filter((sample) => now - sample.t <= 100)
  if (recent.length < 2) {
    return 0
  }
  const first = recent[0]
  const last = recent[recent.length - 1]
  return last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
}

/** 快速 / 专家模式切换：默认改全局模型；首页和对话标题右侧共用。 */
export const ModeSwitch = ({
  compact = false,
  hint,
  onChange,
}: {
  compact?: boolean
  hint?: ReactNode
  onChange?: (mode: ChatMode) => void
}) => {
  const t = useTranslate()
  const mode = useChatMode((state) => state.mode)
  const [preview, setPreview] = useState<ChatMode | null>(null)
  const previewRef = useRef<ChatMode | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)

  const commit = (target: ChatMode) => {
    if (onChange) {
      onChange(target)
    } else {
      setChatMode(target)
    }
  }

  const settle = (indicator: HTMLElement, onSettled?: () => void) => {
    // 先恢复 CSS 过渡，下一帧再清掉拖动偏移和落定模式，否则同帧切换没有吸附动画
    indicator.style.transition = ''
    void indicator.offsetWidth
    requestAnimationFrame(() => {
      indicator.style.removeProperty('--mode-drag-x')
      onSettled?.()
    })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    const switcher = switcherRef.current
    const indicator = indicatorRef.current
    if (dragRef.current || !switcher || !indicator) {
      return
    }
    const switcherRect = switcher.getBoundingClientRect()
    const computed = getComputedStyle(switcher)
    const flashLeft = parseLength(computed.getPropertyValue('--indicator-flash-left'), switcherRect.width)
    const proLeft = parseLength(computed.getPropertyValue('--indicator-pro-left'), switcherRect.width)
    const now = performance.now()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: mode,
      active: false,
      flashLeft,
      proLeft,
      originLeft: mode === 'pro' ? proLeft : flashLeft,
      midLeft: (flashLeft + proLeft) / 2,
      offset: 0,
      samples: [{ x: event.clientX, t: now }],
    }
    suppressClickRef.current = false
    try {
      // 按下就捕获指针：拖到轨道外松手也能收到 pointerup，不会留下半截拖动状态
      switcher.setPointerCapture(event.pointerId)
    } catch {
      // 指针已释放时忽略
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.active) {
      // 纵向手势优先：让位给页面滚动
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > DRAG_THRESHOLD) {
        dragRef.current = null
        return
      }
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        return
      }
      drag.active = true
      suppressClickRef.current = true
      const indicator = indicatorRef.current
      if (indicator) {
        indicator.style.transition = 'none'

      }
    }
    const now = performance.now()
    drag.samples.push({ x: event.clientX, t: now })
    while (drag.samples.length > 2 && now - drag.samples[0].t > 100) {
      drag.samples.shift()
    }
    const left = clamp(
      drag.originLeft + dx,
      drag.flashLeft - OVERSHOOT,
      drag.proLeft + OVERSHOOT,
    )
    const offset = left - drag.originLeft
    drag.offset = offset
    indicatorRef.current?.style.setProperty('--mode-drag-x', `${offset}px`)
    const next: ChatMode = left > drag.midLeft ? 'pro' : 'flash'
    if (next !== previewRef.current) {
      previewRef.current = next
      setPreview(next)
    }
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }
    dragRef.current = null
    previewRef.current = null
    setPreview(null)
    const switcher = switcherRef.current
    const indicator = indicatorRef.current
    if (switcher?.hasPointerCapture(event.pointerId)) {
      switcher.releasePointerCapture(event.pointerId)
    }
    if (!switcher || !indicator) {
      return
    }
    drag.samples.push({ x: event.clientX, t: performance.now() })
    if (!drag.active) {
      // 没拖动就是一次点击：按落点在哪一侧切换，再吞掉后面的原生 click 避免重复
      const rect = switcher.getBoundingClientRect()
      const target: ChatMode = event.clientX - rect.left > rect.width / 2 ? 'pro' : 'flash'
      suppressClickRef.current = true
      commit(target)
      return
    }
    const vx = velocityOf(drag.samples)
    let target: ChatMode
    if (vx > FLING_VELOCITY) {
      target = 'pro'
    } else if (vx < -FLING_VELOCITY) {
      target = 'flash'
    } else {
      target = drag.originLeft + drag.offset > drag.midLeft ? 'pro' : 'flash'
    }
    // 偏移清掉后再换边，left 与 transform 两段位移同向叠加不跳变
    settle(indicator, target !== drag.origin ? () => commit(target) : undefined)
  }

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }
    dragRef.current = null
    previewRef.current = null
    setPreview(null)
    const switcher = switcherRef.current
    if (switcher?.hasPointerCapture(event.pointerId)) {
      switcher.releasePointerCapture(event.pointerId)
    }
    const indicator = indicatorRef.current
    if (drag.active && indicator) {
      settle(indicator)
    }
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return
    }
    // 拖动结束时抑制这次误触 click，避免又按当前位置切一次
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const activeMode = preview ?? mode
  const switcher = (
    <div
      ref={switcherRef}
      className={clsx(styles.switcher, compact && styles.compact)}
      role="radiogroup"
      aria-label={t('chatModeLabel')}
      onClickCapture={onClickCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerCancel}
    >
      <span ref={indicatorRef} className={styles.indicator} data-mode={mode} aria-hidden="true" />
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          data-mode={option.value}
          aria-checked={activeMode === option.value}
          className={clsx(styles.option, activeMode === option.value && styles.selected)}
          onClick={() => commit(option.value)}
        >
          <span className={styles.icon}>{option.icon}</span>
          <span className={styles.label}>{t(option.label)}</span>
        </button>
      ))}
    </div>
  )

  if (!hint) {
    return switcher
  }

  return (
    <div className={styles.block}>
      {switcher}
      <div className={styles.hint}>{hint}</div>
    </div>
  )
}