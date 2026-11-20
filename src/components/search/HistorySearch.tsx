import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pushBackHandler } from '../../app/backStack.js'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import {
  ensureSearchIndex,
  highlightTerms,
  searchConversations,
  type SearchHit,
} from '../../services/chat/search.js'
import { IconButton } from '../base/IconButton.js'
import { IconCloseOutline16, IconSearchOutline16 } from '../base/icons.js'
import { usePresence } from '../base/usePresence.js'
import { chooseSearchHit, closeHistorySearch, useHistorySearch } from './historySearchState.js'
import styles from './HistorySearch.module.css'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 会话搜索：桌面居中浮层，手机全屏；标题与当前可见消息正文一起搜 */
export const HistorySearch = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const open = useHistorySearch((state) => state.open)
  const { mounted, visible } = usePresence(open)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    inputRef.current?.blur()
    closeHistorySearch()
  }, [])

  // 打开时重建索引（首次全量读取，之后只补读更新过的会话），再允许输入搜索
  useEffect(() => {
    if (!open) {
      return
    }
    setQuery('')
    setHits([])
    setReady(false)
    setLoading(true)
    let cancelled = false
    void ensureSearchIndex().then(() => {
      if (cancelled) {
        return
      }
      setReady(true)
      setLoading(false)
    })
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [open])

  useEffect(() => {
    if (!ready) {
      return
    }
    setHits(query.trim() ? searchConversations(query) : [])
  }, [ready, query])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      event.stopPropagation()
      close()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, close])

  useEffect(() => {
    if (!mounted) {
      return
    }
    return pushBackHandler(close)
  }, [mounted, close])

  const terms = useMemo(() => highlightTerms(query), [query])
  const renderSnippet = (text: string) => {
    if (terms.length === 0) {
      return text
    }
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
    const matching = new Set(terms)
    return text
      .split(pattern)
      .map((part, index) =>
        matching.has(part.toLowerCase()) ? <mark key={index}>{part}</mark> : part
      )
  }

  const choose = (hit: SearchHit) => {
    inputRef.current?.blur()
    chooseSearchHit(hit.sessionId, hit.messageId)
  }

  if (!mounted) {
    return null
  }

  return (
    <div
      className={styles.overlay}
      data-state={visible ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={t('searchConversations')}
      onMouseDown={(event) => {
        if (!isMobile && event.target === event.currentTarget) {
          close()
        }
      }}
    >
      <div className={styles.panel}>
        <div className={styles.inputRow}>
          <div className={styles.field}>
            <span className={styles.searchIcon}>
              <IconSearchOutline16 />
            </span>
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchConversationsPlaceholder')}
              aria-label={t('searchConversationsPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              autoFocus
            />
            <IconButton
              tone="primary"
              icon={<IconCloseOutline16 />}
              aria-label={t('close')}
              tooltip={isMobile ? undefined : t('close')}
              onClick={close}
            />
          </div>
        </div>
        <div className={styles.results}>
          {loading ? (
            <div className={styles.state}>{t('searchLoading')}</div>
          ) : !query.trim() ? (
            <div className={styles.state}>{t('searchEmptyHint')}</div>
          ) : hits.length === 0 ? (
            <div className={styles.state}>{t('searchNoResults')}</div>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.messageId ? `${hit.sessionId}-${hit.messageId}` : `${hit.sessionId}-title`}
                type="button"
                className={styles.result}
                onClick={() => choose(hit)}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.resultSession}>
                    {hit.sessionTitle || t('untitledChat')}
                  </span>
                  <span className={styles.resultRole}>
                    {hit.messageId
                      ? t(hit.role === 'user' ? 'searchFromYou' : 'searchFromAssistant')
                      : t('searchTitleMatch')}
                  </span>
                </div>
                <div className={styles.resultSnippet}>{renderSnippet(hit.snippet)}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
