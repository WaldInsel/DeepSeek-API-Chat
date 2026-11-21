import clsx from 'clsx'
import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import type { SettingsSection } from './settingsDialogState.js'
import styles from './SettingsNavSwitch.module.css'

export type SettingsNavItem = {
  value: SettingsSection
  label: TranslationKey
  icon: ReactNode
}

/** 横向移动超过这个距离才接管拖动，避免误伤点击；小一点起手更轻 */
const DRAG_THRESHOLD = 2
/** 甩动速度阈值（px/ms）：手速足够快时才切到相邻分组 */
const FLING_VELOCITY = 0.6
/** 拖出轨道两端后还能继续跟手的极限余量（px），位移按海绵阻力递减；越小越轻 */
const RUBBER_LIMIT = 10

type DragState = {
  pointerId: number
  startX: number
  startY: number
  originIndex: number
  originLeft: number
  /** 三档指示块的绝对 left（px），也是海绵阻力的边界 */
  lefts: number[]
  /** 按下时命中的档位按钮；落在档位之间的空隙时为 null */
  pressedOption: HTMLElement | null
  active: boolean
  offset: number
  samples: { x: number; t: number }[]
}

/**
 * 海绵阻力：拖出轨道两端后位移按越界距离递减，越拖越沉但不会硬顶死，松手再落回档位。
 * 极限位移收敛到 RUBBER_LIMIT，手指继续走也不会突然卡住。
 */
const rubberBand = (value: number, min: number, max: number) => {
  if (value < min) {
    const over = min - value
    return min - (over * RUBBER_LIMIT) / (over + RUBBER_LIMIT)
  }
  if (value > max) {
    const over = value - max
    return max + (over * RUBBER_LIMIT) / (over + RUBBER_LIMIT)
  }
  return value
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

/** 位移越过分界的中点就落到对应档 */
const nearestIndex = (left: number, lefts: number[]) => {
  let next = 0
  for (let i = 1; i < lefts.length; i += 1) {
    if (left >= (lefts[i - 1] + lefts[i]) / 2) {
      next = i
    }
  }
  return next
}

/**
 * 移动端设置页顶部的分组滑块：通用设置 / 数据管理 / 插件管理。
 * 交互与首页快速 / 专家模式滑块一致（跟手、甩动、海绵阻尼、落位不回弹），配色改用灰色系。
 */
export const SettingsNavSwitch = ({
  items,
  value,
  onChange,
}: {
  items: SettingsNavItem[]
  value: SettingsSection
  onChange: (value: SettingsSection) => void
}) => {
  const t = useTranslate()
  const index = Math.max(
    0,
    items.findIndex((item) => item.value === value)
  )
  const [preview, setPreview] = useState<number | null>(null)
  const previewRef = useRef<number | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  /** 松手后需要从当前视觉位置单段滑到目标档的补偿量 */
  const pendingLeftRef = useRef<{ dragLeft: number; targetLeft: number } | null>(null)

  const commit = (target: number) => {
    const item = items[target]
    if (item && item.value !== value) {
      onChange(item.value)
    }
  }

  const settle = (indicator: HTMLElement) => {
    // 先恢复 CSS 过渡，下一帧再清掉拖动偏移，否则同帧切换没有吸附动画
    indicator.style.transition = ''
    void indicator.offsetWidth
    requestAnimationFrame(() => {
      indicator.style.removeProperty('--nav-drag-x')
    })
  }

  // 换档时 data-index 会立刻把 left 挪到目标；先把这段位移补进 transform 再从手指位置滑过去，
  // 避免「先弹回原来那一档、再滑到另一档」的两段动画
  useLayoutEffect(() => {
    const pending = pendingLeftRef.current
    if (!pending) {
      return
    }
    pendingLeftRef.current = null
    const indicator = indicatorRef.current
    if (!indicator) {
      return
    }
    indicator.style.transition = 'none'
    indicator.style.setProperty('--nav-drag-x', `${pending.dragLeft - pending.targetLeft}px`)
    void indicator.offsetWidth
    requestAnimationFrame(() => {
      indicator.style.transition = ''
      requestAnimationFrame(() => {
        indicator.style.removeProperty('--nav-drag-x')
      })
    })
  }, [index])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    const switcher = switcherRef.current
    const indicator = indicatorRef.current
    if (dragRef.current || !switcher || !indicator) {
      return
    }
    const options = Array.from(switcher.querySelectorAll<HTMLElement>('[data-nav-option]'))
    if (options.length === 0) {
      return
    }
    const base = switcher.getBoundingClientRect().left
    const lefts = options.map((option) => option.getBoundingClientRect().left - base)
    const now = performance.now()
    // 落点在档位按钮上还是档位之间的空隙，决定松手后要不要自己补一次点击
    const pressedOption =
      (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-option]') ?? null
    // 上一次落位动画还没被消费时先丢掉，避免这次交互补到旧位移
    pendingLeftRef.current = null
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originIndex: index,
      originLeft: lefts[index] ?? lefts[0],
      lefts,
      pressedOption,
      active: false,
      offset: 0,
      samples: [{ x: event.clientX, t: now }],
    }
    suppressClickRef.current = false
    // 不在按下时就捕获指针：没拖动时让按钮的原生 click 正常工作，
    // 纵向滑动也让位给弹层滚动；只有确认是横向拖动后才接管
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
      // 确认是横向拖动后才捕获指针：拖出轨道外松手也能收到 pointerup
      try {
        switcherRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // 指针已释放时忽略
      }
    }
    const now = performance.now()
    drag.samples.push({ x: event.clientX, t: now })
    while (drag.samples.length > 2 && now - drag.samples[0].t > 100) {
      drag.samples.shift()
    }
    const left = rubberBand(
      drag.originLeft + dx,
      drag.lefts[0],
      drag.lefts[drag.lefts.length - 1]
    )
    const offset = left - drag.originLeft
    drag.offset = offset
    indicatorRef.current?.style.setProperty('--nav-drag-x', `${offset}px`)
    const next = nearestIndex(left, drag.lefts)
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
    // 没拖动就是一次点击：落在按钮上交给按钮原生 click，落在档位空隙
    // 或按下后漂移出了原按钮时，按落点所在档兜底，避免出现点击死区
    if (!drag.active) {
      const releasedOption =
        (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-option]') ?? null
      if (releasedOption && releasedOption === drag.pressedOption) {
        return
      }
      const rect = switcherRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      suppressClickRef.current = true
      commit(nearestIndex(event.clientX - rect.left, drag.lefts))
      return
    }
    const switcher = switcherRef.current
    if (switcher?.hasPointerCapture(event.pointerId)) {
      switcher.releasePointerCapture(event.pointerId)
    }
    const indicator = indicatorRef.current
    if (!indicator) {
      return
    }
    drag.samples.push({ x: event.clientX, t: performance.now() })
    const vx = velocityOf(drag.samples)
    const last = drag.lefts.length - 1
    let target: number
    if (Math.abs(vx) > FLING_VELOCITY) {
      // 甩动一次只跨一档：从第一档快速甩也只会到第二档，不会直接冲到第三档
      target = Math.min(last, Math.max(0, drag.originIndex + (vx > 0 ? 1 : -1)))
    } else {
      target = nearestIndex(drag.originLeft + drag.offset, drag.lefts)
    }
    // 松手未换档就原地回落；换档走 pendingLeftRef 的单段补偿动画
    if (target === drag.originIndex) {
      settle(indicator)
      return
    }
    pendingLeftRef.current = {
      dragLeft: drag.originLeft + drag.offset,
      targetLeft: drag.lefts[target],
    }
    commit(target)
  }

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }
    dragRef.current = null
    previewRef.current = null
    setPreview(null)
    // 手势被系统取消（例如让位给了滚动）不会再有 click，清掉抑制标记
    suppressClickRef.current = false
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

  const activeIndex = preview ?? index

  return (
    <div
      ref={switcherRef}
      className={styles.navSwitcher}
      role="tablist"
      onClickCapture={onClickCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerCancel}
    >
      <span ref={indicatorRef} className={styles.indicator} data-index={index} aria-hidden="true" />
      {items.map((item, itemIndex) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          data-nav-option=""
          className={clsx(styles.option, activeIndex === itemIndex && styles.selected)}
          onClick={() => commit(itemIndex)}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{t(item.label)}</span>
        </button>
      ))}
    </div>
  )
}