import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pushBackHandler } from '../../app/backStack.js'
import { openExternal } from '../../app/systemBars.js'
import { useTranslate } from '../../i18n/index.js'
import marked from '../../vendor/marked-14.1.4.min.cjs'
import { IconButton } from '../base/IconButton.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { usePresence } from '../base/usePresence.js'
import { closeFileViewer, useFileViewer } from './fileViewerState.js'
import '../markdown/markdown.css'
import styles from './FileViewer.module.css'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  )

/** 只放行常见协议，javascript: / data: 之类一律降级成纯文本 */
const safeHref = (href: string) => {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
      ? url.href
      : ''
  } catch {
    return ''
  }
}

// md 里允许原始 HTML 会被本地文件注入脚本，这里统一转义；链接和图片只放行安全协议
marked.use({
  renderer: {
    html(token) {
      return escapeHtml(token.text ?? '')
    },
    link(token) {
      const text = this.parser.parseInline(token.tokens ?? [])
      const href = safeHref(token.href ?? '')
      return href ? `<a href="${escapeHtml(href)}" rel="noreferrer">${text}</a>` : text
    },
    image(token) {
      const href = token.href ?? ''
      return /^https?:\/\//i.test(href)
        ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(token.text ?? '')}" />`
        : escapeHtml(token.text ?? '')
    },
  },
})

/** 全屏文本查看器：txt 等纯文本等宽显示，md 用 marked 渲染；链接交给系统浏览器 */
export const FileViewer = () => {
  const t = useTranslate()
  const item = useFileViewer((state) => state.item)
  const { mounted, visible } = usePresence(item !== null)
  const [shown, setShown] = useState(item)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 关闭后 item 变为 null，退出动画期间继续用最后的内容
  useEffect(() => {
    if (item) {
      setShown(item)
      // 换文件时从顶部开始读
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0
      }
    }
  }, [item])

  useEffect(() => {
    if (!mounted) {
      return
    }
    return pushBackHandler(closeFileViewer)
  }, [mounted])

  useEffect(() => {
    if (!mounted) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      event.stopPropagation()
      closeFileViewer()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [mounted])

  const view = item ?? shown
  const html = useMemo(
    () => (view?.markdown ? marked.parse(view.text, { gfm: true, breaks: true }) : null),
    [view]
  )

  if (!mounted || !view) {
    return null
  }

  return createPortal(
    <div
      className={styles.overlay}
      data-state={visible ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={view.name}
      onClick={(event) => {
        const target = event.target
        const anchor = target instanceof Element ? target.closest('a[href]') : null
        if (!(anchor instanceof HTMLAnchorElement)) {
          return
        }
        event.preventDefault()
        openExternal(anchor.href)
      }}
    >
      <div className={styles.header}>
        <div className={styles.title} title={view.name}>
          {view.name}
        </div>
        <IconButton
          icon={<IconCloseOutline16 />}
          tooltip={t('close')}
          aria-label={t('close')}
          onClick={closeFileViewer}
        />
      </div>
      <div ref={bodyRef} className={styles.body}>
        {html !== null ? (
          <div
            className={clsx('ds-markdown', styles.markdown)}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className={styles.pre}>{view.text}</pre>
        )}
      </div>
    </div>,
    document.body
  )
}
