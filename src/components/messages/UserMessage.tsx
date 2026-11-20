import { useTranslate } from '../../i18n/index.js'
import clsx from 'clsx'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  beginMessageEdit,
  endMessageEdit,
  useIsMobile,
  useMessageEditing,
} from '../../app/viewport.js'
import { IconEditOutline16 } from '../base/icons.js'
import { editMessage, retryUpload } from '../../services/chat/store.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import type { UserMessage as UserMessageType } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import {
  BranchSwitcher,
  type MessageVersions,
  type SelectMessageVersion,
} from './BranchSwitcher.js'
import { MessageFile } from './MessageFile.js'
import { CopyButton } from './CopyButton.js'
import styles from './UserMessage.module.css'

export const UserMessage = memo(function UserMessage({
  sessionId,
  message,
  retryUploadId,
  isFirst,
  isLast,
  busy,
  versions,
  onSelectVersion,
}: {
  sessionId: string
  message: UserMessageType
  /** 回答因补传附件失败可重试时为该回答 id */
  retryUploadId: string | null
  isFirst: boolean
  isLast: boolean
  busy: boolean
  versions: MessageVersions
  onSelectVersion: SelectMessageVersion
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const revealFrame = useRef(0)
  const isMobile = useIsMobile()
  const canSend = !busy && (draft.trim() !== '' || message.files.length > 0)

  // 编辑期间页面不再因键盘缩小，底部输入框留在原位；编辑框自己滚到键盘上方
  useEffect(() => {
    if (!editing) {
      return
    }
    beginMessageEdit(message.id)
    return () => endMessageEdit(message.id)
  }, [editing, message.id])

  // 外部（底部输入框）接管焦点时退出编辑，避免页面锁住高度把输入框留在键盘后面
  useEffect(() => {
    if (!editing) {
      return
    }
    return useMessageEditing.subscribe((state) => {
      if (!state.ids.has(message.id)) {
        setEditing(false)
      }
    })
  }, [editing, message.id])

  const revealEditor = useCallback(() => {
    const editor = editorRef.current
    const scroll = editor?.closest<HTMLElement>('[data-message-scroll]')
    if (!editor || !scroll) {
      return
    }
    const viewport = window.visualViewport
    const visibleBottom = viewport
      ? Math.round(viewport.offsetTop + viewport.height)
      : window.innerHeight
    const scrollTopEdge = scroll.getBoundingClientRect().top
    const rect = editor.getBoundingClientRect()
    const gap = 8
    if (rect.bottom > visibleBottom - gap) {
      scroll.scrollTop += rect.bottom - visibleBottom + gap
    } else if (rect.top < scrollTopEdge + gap) {
      scroll.scrollTop -= scrollTopEdge + gap - rect.top
    }
  }, [])

  const scheduleReveal = useCallback(() => {
    cancelAnimationFrame(revealFrame.current)
    revealFrame.current = requestAnimationFrame(revealEditor)
  }, [revealEditor])

  useEffect(() => () => cancelAnimationFrame(revealFrame.current), [])

  useEffect(() => {
    if (!editing || !isMobile) {
      return
    }
    const viewport = window.visualViewport
    scheduleReveal()
    viewport?.addEventListener('resize', scheduleReveal)
    viewport?.addEventListener('scroll', scheduleReveal)
    window.addEventListener('resize', scheduleReveal)
    return () => {
      viewport?.removeEventListener('resize', scheduleReveal)
      viewport?.removeEventListener('scroll', scheduleReveal)
      window.removeEventListener('resize', scheduleReveal)
    }
  }, [editing, isMobile, scheduleReveal])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (editing && textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 202)}px`
      // 输入到换行时编辑框变高，再校正一次滚动位置；放在帧后避免被列表贴底覆盖
      if (isMobile) {
        scheduleReveal()
      }
    }
  }, [editing, draft, isMobile, scheduleReveal])

  const sendEdit = () => {
    if (canSend && ensureApiKey() && editMessage(sessionId, message.id, draft.trim())) {
      stopReadAloud()
      setEditing(false)
    }
  }

  return (
    <div className={clsx(styles.container, isFirst && styles.isFirst)}>
      {message.files.length > 0 ? (
        <div
          className={clsx(
            styles.files,
            message.files.some((file) => !file.isImage) && styles.filesWithDocuments
          )}
        >
          {message.files.map((file) => (
            <MessageFile
              key={file.id}
              file={file}
              onRetry={retryUploadId ? () => retryUpload(sessionId, retryUploadId) : null}
            />
          ))}
        </div>
      ) : null}
      {editing ? (
        <div ref={editorRef} className={styles.editor}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            aria-label={t('editMessage')}
            autoFocus
            rows={1}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return
              }
              if (event.key === 'Escape') {
                setEditing(false)
              } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !isMobile) {
                event.preventDefault()
                sendEdit()
              }
            }}
          />
          <div className={styles.editorActions}>
            <Button size="s" variant="outlined" onClick={() => setEditing(false)}>
              {t('cancel')}
            </Button>
            <Button size="s" disabled={!canSend} onClick={sendEdit}>
              {t('send')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {message.content ? <div className={styles.bubble}>{message.content}</div> : null}
          <div className={styles.bottom}>
            <div className={clsx(styles.actions, isLast && styles.alwaysShow)}>
              {message.content ? <CopyButton text={message.content} /> : null}
              <IconButton
                icon={<IconEditOutline16 />}
                tooltip={t('editMessage')}
                tooltipPlacement="bottom"
                disabled={busy}
                onClick={() => {
                  setDraft(message.content)
                  // 先于自动聚焦锁定视口，等键盘弹起时页面不再上移
                  beginMessageEdit(message.id)
                  setEditing(true)
                }}
              />
            </div>
            <BranchSwitcher versions={versions} disabled={busy} onSelect={onSelectVersion} />
          </div>
        </>
      )}
    </div>
  )
})
