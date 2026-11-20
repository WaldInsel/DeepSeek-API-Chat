import clsx from 'clsx'
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconEditOutline16,
  IconEllipsisOutline16,
  IconPinOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { renameSession, selectSession } from '../../services/chat/store.js'
import { togglePinnedSession } from '../../services/chat/pinned.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  pinned,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  pinned: boolean
  onDelete: () => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayTitle = session.title || t('untitledChat')

  // 改名时侧栏保持整屏高度，键盘一弹就把输入框滚到键盘上方
  useEffect(() => {
    if (!editing) {
      return
    }
    const viewport = window.visualViewport
    let frame = 0
    const reveal = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const input = inputRef.current
        const scroll = input?.closest<HTMLElement>('[data-sider-scroll]')
        if (!input || !scroll) {
          return
        }
        const visibleBottom = viewport
          ? Math.round(viewport.offsetTop + viewport.height)
          : window.innerHeight
        const scrollTopEdge = scroll.getBoundingClientRect().top
        const rect = input.getBoundingClientRect()
        const gap = 8
        if (rect.bottom > visibleBottom - gap) {
          scroll.scrollTop += rect.bottom - visibleBottom + gap
        } else if (rect.top < scrollTopEdge + gap) {
          scroll.scrollTop -= scrollTopEdge + gap - rect.top
        }
      })
    }
    reveal()
    viewport?.addEventListener('resize', reveal)
    viewport?.addEventListener('scroll', reveal)
    window.addEventListener('resize', reveal)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', reveal)
      viewport?.removeEventListener('scroll', reveal)
      window.removeEventListener('resize', reveal)
    }
  }, [editing])

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        ref={inputRef}
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <div
      className={clsx(styles.item, active && styles.active)}
      onClick={() => {
        selectSession(session.id)
        closeMobileSider()
      }}
    >
      <div className={styles.title}>{displayTitle}</div>
      <div className={styles.action} onClick={(event) => event.stopPropagation()}>
        <Menu
          options={[
            {
              key: 'pin',
              label: t(pinned ? 'sessionItemMenuUnpinOption' : 'sessionItemMenuPinOption'),
              icon: <IconPinOutline16 off={pinned} />,
              onSelect: () => togglePinnedSession(session.id),
            },
            {
              key: 'rename',
              label: t('sessionItemMenuRenameOption'),
              icon: <IconEditOutline16 />,
              onSelect: () => setEditing(true),
            },
            {
              key: 'delete',
              label: t('delete'),
              icon: <IconTrashOutline16 />,
              danger: true,
              onSelect: onDelete,
            },
          ]}
        >
          {({ open, toggle }) => (
            <IconButton
              icon={<IconEllipsisOutline16 />}
              aria-label={t('more')}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={toggle}
            />
          )}
        </Menu>
      </div>
    </div>
  )
})
