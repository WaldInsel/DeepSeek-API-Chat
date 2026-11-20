import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { pushBackHandler } from '../../app/backStack.js'
import { useTranslate } from '../../i18n/index.js'
import { closeImageViewer, useImageViewer } from './imageViewerState.js'
import { IconButton } from './IconButton.js'
import { IconCloseOutline16 } from './icons.js'
import { usePresence } from './usePresence.js'
import styles from './ImageViewer.module.css'

const MIN_SCALE = 1
const MAX_SCALE = 5
/** 滚轮缩放灵敏度 */
const WHEEL_STEP = 0.0015

type Transform = { scale: number; x: number; y: number }

type Gesture = {
  mode: 'none' | 'pan' | 'pinch'
  startX: number
  startY: number
  startTx: number
  startTy: number
  startScale: number
  startDist: number
  startMidX: number
  startMidY: number
  baseLeft: number
  baseTop: number
  moved: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 全屏图片查看器：深色遮罩 + 自适应图片，左上角 X 关闭。
 * 支持滚轮 / 双指缩放、放大后拖动平移；点击遮罩、Esc、安卓返回键关闭。
 */
export const ImageViewer = () => {
  const t = useTranslate()
  const item = useImageViewer((state) => state.item)
  const { mounted, visible } = usePresence(item !== null)
  const [shown, setShown] = useState(item)
  const overlayRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<Gesture>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    startScale: 1,
    startDist: 0,
    startMidX: 0,
    startMidY: 0,
    baseLeft: 0,
    baseTop: 0,
    moved: false,
  })
  const suppressClickRef = useRef(false)

  // 关闭后 item 变为 null，退出动画期间仍用最后一次的内容渲染
  useEffect(() => {
    if (item) {
      setShown(item)
    }
  }, [item])

  const applyTransform = () => {
    const el = imageRef.current
    if (!el) {
      return
    }
    const { scale, x, y } = transformRef.current
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    el.style.cursor = scale > MIN_SCALE ? 'grab' : 'zoom-in'
  }

  // 换图或关闭时回到 1x 居中
  useEffect(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 }
    applyTransform()
  }, [item])

  // 退出动画期间也拦截返回键，避免误关下面的页面
  useEffect(() => {
    if (!mounted) {
      return
    }
    return pushBackHandler(closeImageViewer)
  }, [mounted])

  useEffect(() => {
    if (!mounted) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      event.stopPropagation()
      closeImageViewer()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [mounted])

  // 桌面滚轮缩放：以光标为锚点，阻止页面跟随滚动
  useEffect(() => {
    if (!mounted) {
      return
    }
    const overlay = overlayRef.current
    if (!overlay) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const image = imageRef.current
      if (!image) {
        return
      }
      const prev = transformRef.current
      const rect = image.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        return
      }
      const nextScale = clamp(prev.scale * Math.exp(-event.deltaY * WHEEL_STEP), MIN_SCALE, MAX_SCALE)
      if (nextScale === prev.scale) {
        return
      }
      const baseLeft = rect.left - prev.x
      const baseTop = rect.top - prev.y
      const contentX = (event.clientX - baseLeft - prev.x) / prev.scale
      const contentY = (event.clientY - baseTop - prev.y) / prev.scale
      if (nextScale <= MIN_SCALE) {
        transformRef.current = { scale: MIN_SCALE, x: 0, y: 0 }
      } else {
        transformRef.current = {
          scale: nextScale,
          x: event.clientX - baseLeft - contentX * nextScale,
          y: event.clientY - baseTop - contentY * nextScale,
        }
      }
      applyTransform()
    }
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => overlay.removeEventListener('wheel', onWheel)
  }, [mounted])

  const beginPinch = () => {
    const image = imageRef.current
    const points = [...pointersRef.current.values()]
    if (!image || points.length < 2) {
      return
    }
    const [a, b] = points
    const gesture = gestureRef.current
    const prev = transformRef.current
    const rect = image.getBoundingClientRect()
    gesture.mode = 'pinch'
    gesture.startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    gesture.startMidX = (a.x + b.x) / 2
    gesture.startMidY = (a.y + b.y) / 2
    gesture.startScale = prev.scale
    gesture.startTx = prev.x
    gesture.startTy = prev.y
    gesture.baseLeft = rect.left - prev.x
    gesture.baseTop = rect.top - prev.y
    gesture.moved = true
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    const prev = transformRef.current
    if (pointersRef.current.size === 1) {
      gesture.mode = prev.scale > MIN_SCALE ? 'pan' : 'none'
      gesture.startX = event.clientX
      gesture.startY = event.clientY
      gesture.startTx = prev.x
      gesture.startTy = prev.y
      gesture.moved = false
    } else if (pointersRef.current.size === 2) {
      beginPinch()
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    const image = imageRef.current
    if (!image) {
      return
    }
    if (gesture.mode === 'pinch' && pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()]
      const [a, b] = points
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const nextScale = clamp(gesture.startScale * (dist / gesture.startDist), MIN_SCALE, MAX_SCALE)
      const contentX = (gesture.startMidX - gesture.baseLeft - gesture.startTx) / gesture.startScale
      const contentY = (gesture.startMidY - gesture.baseTop - gesture.startTy) / gesture.startScale
      if (nextScale <= MIN_SCALE) {
        transformRef.current = { scale: MIN_SCALE, x: 0, y: 0 }
      } else {
        transformRef.current = {
          scale: nextScale,
          x: midX - gesture.baseLeft - contentX * nextScale,
          y: midY - gesture.baseTop - contentY * nextScale,
        }
      }
      applyTransform()
      return
    }
    if (gesture.mode === 'pan') {
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        gesture.moved = true
      }
      transformRef.current = {
        scale: transformRef.current.scale,
        x: gesture.startTx + dx,
        y: gesture.startTy + dy,
      }
      applyTransform()
    }
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    const gesture = gestureRef.current
    if (gesture.moved) {
      suppressClickRef.current = true
    }
    if (pointersRef.current.size === 0) {
      gesture.mode = 'none'
    } else if (gesture.mode === 'pinch' && pointersRef.current.size === 1) {
      // 双指变单指：继续用剩下这根手指拖动
      const [point] = [...pointersRef.current.values()]
      const current = transformRef.current
      gesture.mode = current.scale > MIN_SCALE ? 'pan' : 'none'
      gesture.startX = point.x
      gesture.startY = point.y
      gesture.startTx = current.x
      gesture.startTy = current.y
      gesture.moved = true
    }
  }

  const view = item ?? shown
  if (!mounted || !view) {
    return null
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-state={visible ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={view.alt || t('imagePreview')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        if (event.target === event.currentTarget) {
          closeImageViewer()
        }
      }}
    >
      <IconButton
        className={styles.close}
        size="m"
        icon={<IconCloseOutline16 />}
        tooltip={t('close')}
        onClick={closeImageViewer}
      />
      <img ref={imageRef} className={styles.image} src={view.src} alt={view.alt} draggable={false} />
    </div>,
    document.body
  )
}