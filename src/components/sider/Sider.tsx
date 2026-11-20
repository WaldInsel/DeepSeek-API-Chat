import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconPanelLeftOutline16, IconSettingsOutline16, NewChatIcon } from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions, PINNED_GROUP_KEY } from '../../services/chat/sessionGroups.js'
import { usePinnedSessions } from '../../services/chat/pinned.js'
import { newChat, removeSession, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { usePresence } from '../base/usePresence.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import { UpdateBadge } from './UpdateBadge.js'
import styles from './Sider.module.css'

/** 展开的侧边栏：名称与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({
  mobile = false,
  collapsed = false,
}: {
  mobile?: boolean
  /** 桌面端收起：整块向左滑出，宽度由 App 的布局回收 */
  collapsed?: boolean
}) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const pinnedIds = usePinnedSessions((state) => state.ids)
  const groups = useMemo(
    () => groupSessions(sessions, now, t, pinnedIds),
    [sessions, now, t, pinnedIds]
  )
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div
      className={clsx(styles.sider, mobile && styles.mobile, collapsed && styles.siderCollapsed)}
      aria-hidden={collapsed || undefined}
    >
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        <IconButton
          size="m"
          icon={<IconPanelLeftOutline16 />}
          tooltip={t('collapseSiderbarButton')}
          tooltipPlacement="bottom"
          onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
        />
      </div>
      <button
        type="button"
        className={styles.newChat}
        onClick={() => {
          newChat()
          closeMobileSider()
        }}
      >
        <span className={styles.newChatIcon}>
          <NewChatIcon />
        </span>
        {t('newChat')}
      </button>
      <div className={styles.listWrap}>
        <div className={styles.list} data-sider-scroll="">
          {groups.map((group, index) => {
            // 置顶分组下面还有内容时，在两者的间距中间加一条浅灰分割线
            const divider = group.key === PINNED_GROUP_KEY && index < groups.length - 1
            return (
              <div
                key={group.key}
                className={clsx(styles.section, divider && styles.sectionDivider)}
              >
                <div className={styles.sectionHeader}>{group.label}</div>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeId}
                    pinned={pinnedIds.includes(session.id)}
                    onDelete={() => setDeleting(session)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className={styles.bottom}>
        <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
          <span className={styles.settingsIcon}>
            <IconSettingsOutline16 />
          </span>
          <span className={styles.settingsLabel}>{t('settings')}</span>
        </button>
        <UpdateBadge />
      </div>
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭；从左侧滑入、滑出 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  // 关闭时保留 DOM 播完滑出动画
  const { mounted, visible } = usePresence(open)
  const drawerRef = useRef<HTMLDivElement>(null)
  const maskRef = useRef<HTMLDivElement>(null)

  // 拖动时只改 CSS 变量和过渡类，不触发 React 重渲染，长列表才不会掉帧
  useEffect(() => {
    const apply = (state: { progress: number; dragging: boolean }) => {
      const progress = String(state.progress)
      drawerRef.current?.style.setProperty('--drawer-progress', progress)
      maskRef.current?.style.setProperty('--drawer-progress', progress)
      drawerRef.current?.classList.toggle(styles.drawerDragging, state.dragging)
    }
    apply(useMobileSider.getState())
    return useMobileSider.subscribe(apply)
  }, [])

  if (!mounted) {
    return null
  }
  return (
    <>
      <div
        ref={maskRef}
        className={clsx(styles.drawerMask, visible && styles.drawerOpen)}
        onClick={closeMobileSider}
      />
      <div
        ref={drawerRef}
        className={clsx(styles.drawer, visible && styles.drawerOpen)}
        data-mobile-sider
        aria-hidden={!visible || undefined}
      >
        <Sider mobile />
      </div>
    </>
  )
}
