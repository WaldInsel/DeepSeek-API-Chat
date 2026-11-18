import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { setChatMode, useChatMode, type ChatMode } from '../../services/chatMode.js'
import { IconDiamondOutline16, IconLightningOutline16 } from '../base/icons.js'
import styles from './ModeSwitch.module.css'

const MODE_OPTIONS: { value: ChatMode; label: TranslationKey; icon: ReactNode }[] = [
  { value: 'flash', label: 'chatModeFlash', icon: <IconLightningOutline16 /> },
  { value: 'pro', label: 'chatModePro', icon: <IconDiamondOutline16 /> },
]

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
  const switcher = (
    <div
      className={clsx(styles.switcher, compact && styles.compact)}
      role="radiogroup"
      aria-label={t('chatModeLabel')}
    >
      <span className={styles.indicator} data-mode={mode} aria-hidden="true" />
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          data-mode={option.value}
          aria-checked={mode === option.value}
          className={clsx(styles.option, mode === option.value && styles.selected)}
          onClick={() => (onChange ? onChange(option.value) : setChatMode(option.value))}
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