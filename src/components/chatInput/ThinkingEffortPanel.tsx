import clsx from 'clsx'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import type { ThinkingEffort } from '../../services/api/types.js'
import styles from './ThinkingEffortPanel.module.css'

const EFFORTS: { value: ThinkingEffort; label: TranslationKey }[] = [
  { value: 'none', label: 'thinkingEffortNone' },
  { value: 'low', label: 'thinkingEffortLow' },
  { value: 'high', label: 'thinkingEffortHigh' },
  { value: 'max', label: 'thinkingEffortMax' },
]

/** 横向尺子：关闭 / 低 / 高 / 最大，四个节点等距排列。 */
export const ThinkingEffortPanel = ({
  value,
  onSelect,
}: {
  value: ThinkingEffort
  onSelect: (value: ThinkingEffort) => void
}) => {
  const t = useTranslate()
  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t('thinkingEffortLabel')}</div>
      <div className={styles.scale} role="radiogroup" aria-label={t('thinkingEffortLabel')}>
        {EFFORTS.map((effort) => (
          <button
            key={effort.value}
            type="button"
            role="radio"
            aria-checked={value === effort.value}
            className={clsx(styles.step, value === effort.value && styles.active)}
            onClick={() => onSelect(effort.value)}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.label}>{t(effort.label)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}