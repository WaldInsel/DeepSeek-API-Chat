import clsx from 'clsx'
import { useTranslate } from '../../i18n/index.js'
import type { HistoryImportProgress } from './historyImportState.js'
import styles from './Settings.module.css'

/** 导入进度：解析阶段显示不确定条，写入阶段显示百分比。 */
export const ImportProgress = ({ progress }: { progress: HistoryImportProgress }) => {
  const t = useTranslate()
  const parsing = progress.phase === 'parsing'
  const label = parsing
    ? t('historyImportParsing')
    : t('historyImportProgress', { progress: progress.percent })
  return (
    <div
      className={styles.importProgress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={parsing ? undefined : progress.percent}
    >
      <span className={styles.importProgressTrack}>
        <span
          className={clsx(styles.importProgressFill, parsing && styles.importProgressIndeterminate)}
          style={parsing ? undefined : { width: `${progress.percent}%` }}
        />
      </span>
      <span className={styles.importProgressText}>{label}</span>
    </div>
  )
}