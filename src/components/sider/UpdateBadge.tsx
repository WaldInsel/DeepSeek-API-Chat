import clsx from 'clsx'
import { useEffect } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { openUsage, useBalance } from '../../services/balance.js'
import { useSettings } from '../../services/settings.js'
import { openReleases, useUpdateStore } from '../../services/update.js'
import styles from './Sider.module.css'

/**
 * 设置按钮右侧的小徽标：有新版本时提示更新，没有新版本时显示人民币余额。
 */
export const UpdateBadge = () => {
  const t = useTranslate()
  const latest = useUpdateStore((state) => state.latest)
  const apiKey = useSettings((state) => state.apiKey)
  const amount = useBalance((state) => state.amount)
  const refresh = useBalance((state) => state.refresh)

  useEffect(() => {
    void refresh()
  }, [apiKey, refresh])

  // 从后台切回应用时刷新，避免余额停留在上次打开时的数值
  useEffect(() => {
    if (!apiKey) {
      return undefined
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [apiKey, refresh])

  if (latest) {
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

  return (
    <button
      type="button"
      className={clsx(styles.updateBadge, styles.balanceBadge)}
      title={t('usageBalanceHint')}
      onClick={openUsage}
    >
      {`¥ ${amount ?? '—'}`}
    </button>
  )
}