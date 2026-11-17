import { useTranslate } from '../../i18n/index.js'
import { openReleases, useUpdateStore } from '../../services/update.js'
import styles from './Sider.module.css'

/** 有新版时在设置按钮右边显示的小徽标，点击打开 GitHub Releases */
export const UpdateBadge = () => {
  const t = useTranslate()
  const latest = useUpdateStore((state) => state.latest)
  if (!latest) {
    return null
  }
  return (
    <button
      type="button"
      className={styles.updateBadge}
      title={t('updateAvailableHint', { version: latest })}
      onClick={openReleases}
    >
      {t('updateAvailable')}
    </button>
  )
}
