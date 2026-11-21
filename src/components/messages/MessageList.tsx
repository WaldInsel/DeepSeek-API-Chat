import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile, useMessageEditing } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import {
  buildMessageVersions,
  getVisibleMessages,
  type MessageVersions,
} from '../../services/chat/branches.js'
import { selectMessageVersion } from '../../services/chat/store.js'
import type { Session } from '../../services/chat/types.js'
import { clearSearchFocus, useHistorySearch } from '../search/historySearchState.js'
import { closeSearchPanel } from '../search/searchPanelState.js'
import { AssistantMessage } from './AssistantMessage.js'
import { ScrollToBottomContext } from './scrollContext.js'
import { UserMessage } from './UserMessage.js'
import type { Message } from '../../services/chat/types.js'

/**
 * 会话共用可重试的附件上传失败入口，覆盖当前提问与历史消息中的附件。
 * 点击后按失败的回答重新补传附件并请求。
 */
const getUploadRetryId = (messages: Message[], streaming: boolean) => {
  const last = messages.at(-1)
  return !streaming &&
    last?.role === 'assistant' &&
    last.status === 'error' &&
    last.error?.kind === 'upload' &&
    last.error.retryable
    ? last.id
    : null
}
import styles from './MessageList.module.css'

/** 首屏与每次上滑补载的消息条数 */
const PAGE_SIZE = 25
/** 停在顶部时展示加载态的时间，留出一帧绘制 */
const LOADING_DELAY = 120
/** 距底部小于该值时视为在底部，流式内容增长时跟随 */
const STICKY_THRESHOLD = 40
const EMPTY_VERSIONS: MessageVersions = { ids: [], index: -1 }

export const MessageList = ({
  session,
  streaming,
  footer,
}: {
  session: Session
  streaming: boolean
  footer: React.ReactNode
}) => {
  const isMobile = useIsMobile()
  const t = useTranslate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef(true)
  const scrollTopRef = useRef(0)
  const restoreScrollRef = useRef<{ messageId: string; top: number } | null>(null)
  const loadAnchorRef = useRef<number | null>(null)
  const loadingOlderRef = useRef(false)
  const loadTimerRef = useRef<number | null>(null)
  const messages = getVisibleMessages(session)
  const [startIndex, setStartIndex] = useState(() =>
    Math.max(0, messages.length - PAGE_SIZE)
  )
  const [loadingOlder, setLoadingOlder] = useState(false)
  const previousLengthRef = useRef(messages.length)
  const [previousVersions, setPreviousVersions] = useState(() =>
    buildMessageVersions(session, new Map())
  )
  const versions = useMemo(
    () => buildMessageVersions(session, previousVersions),
    [session, previousVersions]
  )
  if (versions !== previousVersions) {
    setPreviousVersions(versions)
  }
  const visibleStart = Math.min(startIndex, Math.max(0, messages.length - 1))
  const visibleMessages = messages.slice(visibleStart)
  const lastMessageId = messages.at(-1)?.id
  const focusMessageId = useHistorySearch((state) =>
    state.focus?.sessionId === session.id ? state.focus.messageId : null
  )
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    // 移动端编辑消息时页面不随键盘缩小，贴底会把编辑框藏到键盘后面，交给编辑框自己校正
    const revealing = isMobile && useMessageEditing.getState().ids.size > 0
    if (el && stickyRef.current && !revealing) {
      el.scrollTop = el.scrollHeight
      scrollTopRef.current = el.scrollTop
    }
  }, [isMobile])

  // 内容、键盘和输入框高度变化时，继续遵循当前跟随状态。
  useLayoutEffect(() => {
    const content = contentRef.current
    const scroll = scrollRef.current
    if (!content || !scroll) {
      return
    }
    const observer = new ResizeObserver(scrollToBottom)
    observer.observe(content)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [isMobile, scrollToBottom])

  // 贴底时让窗口跟着末尾走，避免继续聊天把已加载的历史一直堆在 DOM 里。
  useLayoutEffect(() => {
    const length = messages.length
    const previous = previousLengthRef.current
    previousLengthRef.current = length
    if (length > previous && stickyRef.current) {
      setStartIndex((value) => Math.max(0, value + length - previous))
    }
  }, [messages.length])

  // 补载后把新增内容的高度加回滚动位置，保持视口内容不跳动。
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    const anchor = loadAnchorRef.current
    if (anchor !== null) {
      loadAnchorRef.current = null
      loadingOlderRef.current = false
      setLoadingOlder(false)
      const delta = el.scrollHeight - anchor
      if (delta > 0) {
        el.scrollTop += delta
        scrollTopRef.current = el.scrollTop
      }
    }
    // 消息不足一屏时滚动事件触发不了，主动补到能滚动或没有更早消息为止。
    if (startIndex > 0 && el.scrollHeight <= el.clientHeight && !loadingOlderRef.current) {
      loadingOlderRef.current = true
      loadAnchorRef.current = el.scrollHeight
      setStartIndex((value) => Math.max(0, value - PAGE_SIZE))
    }
  }, [startIndex, messages.length])

  useEffect(
    () => () => {
      if (loadTimerRef.current !== null) {
        window.clearTimeout(loadTimerRef.current)
      }
    },
    []
  )

  // 切换版本后将选择器留在原位置，避免回答长短变化导致操作区跳出视口。
  useLayoutEffect(() => {
    const anchor = restoreScrollRef.current
    const scroll = scrollRef.current
    if (anchor && scroll) {
      const switcher = scroll.querySelector<HTMLElement>(
        `[data-message-version="${CSS.escape(anchor.messageId)}"]`
      )
      if (switcher) {
        scroll.scrollTop += switcher.getBoundingClientRect().top - anchor.top
      }
      restoreScrollRef.current = null
      return
    }
    stickyRef.current = true
    scrollToBottom()
  }, [session.id, lastMessageId, scrollToBottom])

  // 搜索结果命中后滚到对应消息并居中；命中更早的消息时先把窗口扩到它所在位置。
  useLayoutEffect(() => {
    if (!focusMessageId) {
      return
    }
    const index = messages.findIndex((message) => message.id === focusMessageId)
    if (index < 0) {
      clearSearchFocus()
      return
    }
    if (index < visibleStart) {
      stickyRef.current = false
      setStartIndex(index)
      return
    }
    const scroll = scrollRef.current
    const target = scroll?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(focusMessageId)}"]`
    )
    if (!scroll || !target) {
      return
    }
    stickyRef.current = false
    const top = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top
    scroll.scrollTop += top - (scroll.clientHeight - target.clientHeight) / 2
    scrollTopRef.current = scroll.scrollTop
    clearSearchFocus()
  }, [focusMessageId, session.id, lastMessageId, visibleStart, messages])

  useEffect(closeSearchPanel, [session.id, lastMessageId])

  const selectVersion = useCallback(
    (messageId: string, anchorTop: number) => {
      if (streaming) {
        return
      }
      restoreScrollRef.current = { messageId, top: anchorTop }
      stickyRef.current = false
      closeSearchPanel()
      selectMessageVersion(session.id, messageId)
    },
    [session.id, streaming]
  )

  // 跨移动端断点时切换滚动层，并保持输入框及当前阅读位置。
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    if (stickyRef.current) {
      scrollToBottom()
    } else {
      el.scrollTop = scrollTopRef.current
    }
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD
      // 仅在用户向上滚动时停止跟随底部，布局或内容增高时保持跟随状态。
      if (nearBottom) {
        stickyRef.current = true
      } else if (el.scrollTop < scrollTopRef.current) {
        stickyRef.current = false
      }
      scrollTopRef.current = el.scrollTop
      // 滑到顶部先显示加载态，再补载更早的一页。
      if (el.scrollTop <= 1 && startIndex > 0 && !loadingOlderRef.current) {
        loadingOlderRef.current = true
        loadAnchorRef.current = el.scrollHeight
        setLoadingOlder(true)
        loadTimerRef.current = window.setTimeout(() => {
          loadTimerRef.current = null
          setStartIndex((value) => Math.max(0, value - PAGE_SIZE))
        }, LOADING_DELAY)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isMobile, scrollToBottom, startIndex])

  const lastIndex = messages.length - 1
  const uploadRetryId = getUploadRetryId(messages, streaming)
  return (
    <ScrollToBottomContext.Provider value={scrollToBottom}>
      <div ref={isMobile ? undefined : scrollRef} className={styles.container}>
        <div
          ref={isMobile ? scrollRef : undefined}
          className={styles.scroll}
          data-message-scroll=""
        >
          <div ref={contentRef} className={styles.column}>
            {visibleStart > 0 ? (
              <div className={styles.older} role="status" aria-live="polite">
                {loadingOlder ? t('loadingOlderMessages') : null}
              </div>
            ) : null}
            {visibleMessages.map((message, index) => {
              const absoluteIndex = visibleStart + index
              return message.role === 'user' ? (
                <UserMessage
                  key={message.id}
                  sessionId={session.id}
                  message={message}
                  retryUploadId={uploadRetryId}
                  isFirst={absoluteIndex === 0}
                  isLast={absoluteIndex === lastIndex || absoluteIndex === lastIndex - 1}
                  busy={streaming}
                  versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                  onSelectVersion={selectVersion}
                />
              ) : (
                <AssistantMessage
                  key={message.id}
                  sessionId={session.id}
                  message={message}
                  isLast={absoluteIndex === lastIndex}
                  streaming={streaming && absoluteIndex === lastIndex}
                  busy={streaming}
                  versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                  onSelectVersion={selectVersion}
                />
              )
            })}
          </div>
        </div>
        {footer}
      </div>
    </ScrollToBottomContext.Provider>
  )
}