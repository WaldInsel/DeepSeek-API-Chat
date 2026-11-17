import clsx from 'clsx'
import { useRef } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { usePresence } from '../base/usePresence.js'
import { closeSearchPanel, useSearchPanel } from './searchPanelState.js'
import { SourceCard } from './SourceCard.js'
import styles from './SearchPanel.module.css'

/** 右侧「搜索结果」面板：桌面端从右向左展开，移动端从底部划入、向下划出 */
export const SearchPanel = () => {
  const t = useTranslate()
  const entry = useSearchPanel((state) => state.entry)
  const sources = useSearchPanel((state) => state.sources)
  // 关闭时保留 DOM 播完收起动画
  const { mounted, visible } = usePresence(entry !== null)
  // 收起过程中沿用最后一份结果，避免面板一边收起一边变空
  const lastSources = useRef(sources)
  if (entry !== null) {
    lastSources.current = sources
  }
  if (!mounted) {
    return null
  }
  return (
    <aside
      className={clsx(styles.panel, visible && styles.panelOpen)}
      aria-hidden={!visible || undefined}
    >
      <div className={styles.panelInner}>
        <div className={styles.header}>
          <div role="heading" className={styles.title}>
            {t('searchResult')}
          </div>
          <IconButton
            icon={<IconCloseOutline16 />}
            aria-label={t('close')}
            onClick={closeSearchPanel}
          />
        </div>
        <div className={styles.content}>
          {(entry === null ? lastSources.current : sources).map((source) => (
            <SourceCard key={source.url} source={source} className={styles.item} />
          ))}
        </div>
      </div>
    </aside>
  )
}
