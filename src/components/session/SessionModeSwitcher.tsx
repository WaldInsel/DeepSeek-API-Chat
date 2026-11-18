import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { setChatMode, useChatMode } from '../../services/chatMode.js'
import { useDismiss } from '../base/anchored.js'
import { IconDiamondOutline16, IconLightningOutline16 } from '../base/icons.js'
import { ModeSwitch } from './ModeSwitch.js'
import styles from './SessionModeSwitcher.module.css'

/** 对话标题右侧的模型入口：显示当前全局模式，点开即切换。 */
export const SessionModeSwitcher = () => {
  const t = useTranslate()
  const mode = useChatMode((state) => state.mode)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  /** 切换后等待滑块动画结束，再开始退出动画 */
  const switchTimer = useRef(0)
  /** 退出动画结束后卸载弹层 */
  const closeTimer = useRef(0)

  const clearTimers = () => {
    window.clearTimeout(switchTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  const close = () => {
    if (closing) {
      return
    }
    window.clearTimeout(switchTimer.current)
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 190)
  }

  const toggle = () => {
    if (open && !closing) {
      close()
      return
    }
    clearTimers()
    setClosing(false)
    setOpen(true)
  }

  useEffect(() => () => clearTimers(), [])

  useDismiss(open, [wrapperRef], close)

  const isPro = mode === 'pro'
  return (
    <div ref={wrapperRef} className={styles.anchor}>
      <button
        type="button"
        className={styles.pill}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {isPro ? <IconDiamondOutline16 /> : <IconLightningOutline16 />}
        {t(isPro ? 'chatModePro' : 'chatModeFlash')}
      </button>
      {open ? (
        <div
          className={styles.popover}
          data-state={closing ? 'closed' : 'open'}
          role="dialog"
          aria-label={t('chatModeLabel')}
        >
          <ModeSwitch
            compact
            onChange={(next) => {
              setChatMode(next)
              // 等蓝色滑块滑到目标位置后再播放退出动画
              window.clearTimeout(switchTimer.current)
              switchTimer.current = window.setTimeout(close, 260)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}