import { useTranslate } from '../../i18n/index.js'
import clsx from 'clsx'
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  IconBrowseOutline16,
  IconBrowseWarningOutline16,
  IconChevronDownOutline14,
  IconChevronRightOutline14,
  IconCheckedOutline14,
  IconCloseFill14,
  IconLinkOutline16,
  IconRightUpOutline14,
  IconSearchOutline16,
  IconSearchWarningOutline16,
  IconThinkOutline16,
} from '../base/icons.js'
import type { AssistantMessage } from '../../services/chat/types.js'
import { useSettings, type ThinkingCollapse } from '../../services/settings.js'
import {
  getAreaTitle,
  isDeepSearchKind,
  isImageSearchKind,
  type FindStep,
  type OpenStep,
  type PageItem,
  type ReadLinkStep,
  type ReplyView,
  type SearchStep,
  type Source,
  type Step,
} from '../../services/chat/view.js'
import { Tooltip } from '../base/Tooltip.js'
import { Markdown } from '../markdown/Markdown.js'
import { SiteThumbnails } from '../search/SiteLogo.js'
import { toggleSearchPanel, useSearchPanel } from '../search/searchPanelState.js'
import styles from './ReplyArea.module.css'
import './thinking.markdown.css'

/** 进行中时每秒刷新，用于思考用时与搜索词轮播 */
const useTicker = (active: boolean, interval: number) => {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = setInterval(() => setTick((value) => value + 1), interval)
    return () => clearInterval(timer)
  }, [active, interval])
  return tick
}

/**
 * 思考与工具步骤的时间线：
 * 开启深度思考时带可折叠的标题（正在思考 / 正在搜索 / 正在浏览网页 / 已思考（用时 N 秒））；
 * 未开启时只有工具步骤（如普通搜索的「已阅读 N 个网页」）。
 */
export const ReplyArea = memo(function ReplyArea({
  message,
  view,
  streaming,
  hasResponse,
  isHistory,
}: {
  message: AssistantMessage
  view: ReplyView
  streaming: boolean
  hasResponse: boolean
  /** 会话加载时就存在的消息，思考内容默认收起 */
  isHistory: boolean
}) {
  useTranslate()
  const thinkingCollapse = useSettings((state) => state.thinkingCollapse)
  // 用户点过标题后以手动状态为准。完全折叠始终收起；部分折叠只展开正在生成或本次打开后
  // 新产生的回复，历史回复默认收起；不折叠始终展开。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const open =
    manualOpen ??
    (thinkingCollapse === 'none' ||
      (thinkingCollapse === 'partial' && (streaming || !isHistory)))
  useEffect(() => setManualOpen(null), [thinkingCollapse])
  const titleActive = streaming && !hasResponse
  useTicker(titleActive, 1000)
  if (view.steps.length === 0 && !(message.thinking && streaming)) {
    return null
  }
  // 未记录请求开关时，按是否有思考内容显示标题。
  const thinking = message.thinking ?? view.steps.some((step) => step.type === 'thinking')
  const title = thinking ? getAreaTitle(view, streaming, Date.now(), hasResponse) : null
  const stopped = !streaming && !hasResponse
  const steps = (
    <div className={styles.steps}>
      {view.steps.map((step, index) => (
        <StepItem
          key={stepKey(step, index)}
          step={step}
          message={message}
          sources={view.sources}
          streaming={streaming}
          isLast={index === view.steps.length - 1}
          thinkingCollapse={thinkingCollapse}
        />
      ))}
    </div>
  )
  return (
    <div className={styles.area}>
      {title ? (
        <div className={styles.title} onClick={() => setManualOpen(!open)}>
          <span className={clsx(styles.titleIcon, stopped && styles.stoppedIcon)}>
            <IconThinkOutline16 />
          </span>
          <span className={clsx(styles.titleText, titleActive && styles.shimmer)}>{title}</span>
          {open ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
        </div>
      ) : null}
      {title ? <Collapse open={open}>{steps}</Collapse> : steps}
    </div>
  )
})

/** 展开/收起过渡：展开时先挂载再动画，收起结束后卸载内容，折叠状态不保留思考 DOM。 */
const Collapse = ({ open, children }: { open: boolean; children: ReactNode }) => {
  const [mounted, setMounted] = useState(open)
  const [expanded, setExpanded] = useState(open)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let frame = 0
    if (open) {
      setMounted(true)
      // 先以收起状态插入，下一帧再展开，才能触发高度过渡。
      frame = requestAnimationFrame(() => setExpanded(true))
    } else {
      setExpanded(false)
    }
    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
    }
  }, [open])

  useEffect(() => {
    const el = ref.current
    if (open || !mounted || !el) {
      return
    }
    // 收起动画结束后再卸载；没有过渡时用定时器兜底。
    const done = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === 'grid-template-rows') {
        setMounted(false)
      }
    }
    el.addEventListener('transitionend', done)
    const fallback = window.setTimeout(() => setMounted(false), 320)
    return () => {
      el.removeEventListener('transitionend', done)
      window.clearTimeout(fallback)
    }
  }, [open, mounted])

  if (!mounted) {
    return null
  }
  return (
    <div
      ref={ref}
      className={clsx(styles.collapse, expanded && styles.collapseOpen)}
      aria-hidden={!open || undefined}
    >
      <div className={styles.collapseInner}>{children}</div>
    </div>
  )
}

const stepKey = (step: Step, index: number) =>
  step.type === 'thinking' || step.type === 'text' || step.type === 'search'
    ? step.key
    : `${step.type}-${index}`

const StepItem = ({
  step,
  message,
  sources,
  streaming,
  isLast,
  thinkingCollapse,
}: {
  step: Step
  message: AssistantMessage
  sources: Source[]
  streaming: boolean
  isLast: boolean
  thinkingCollapse: ThinkingCollapse
}) => {
  switch (step.type) {
    case 'thinking':
      return (
        <ThinkingRow
          step={step}
          message={message}
          streaming={streaming}
          isLast={isLast}
          thinkingCollapse={thinkingCollapse}
        />
      )
    case 'text':
      return (
        <ContentItem isLast={isLast} active={false}>
          <Markdown
            content={step.markdown}
            loading={streaming && isLast}
            cacheKey={`${message.id}-${step.key}`}
            disableLink={false}
            sources={sources}
          />
        </ContentItem>
      )
    case 'search':
      return <SearchRow step={step} message={message} streaming={streaming} isLast={isLast} />
    case 'open':
      return <OpenRow step={step} sources={sources} isLast={isLast} />
    case 'find':
      return <FindRow step={step} isLast={isLast} />
    case 'read_link':
      return <ReadLinkRow step={step} isLast={isLast} />
    default:
      return null
  }
}

/** 思考或过程性文字：左侧圆点 + 竖线，小号 markdown */
const ContentItem = ({
  children,
  active,
  isLast,
}: {
  children: ReactNode
  active: boolean
  isLast: boolean
}) => (
  <div className={clsx(styles.content, 'ds-think-content', isLast && styles.lastItem)}>
    <span className={styles.dot}>
      <span className={clsx(styles.dotInner, !active && styles.inactive)} />
    </span>
    {children}
  </div>
)

/** 思考内容按设置呈现：部分折叠时限制高度，思考进行中自动跟随到底部。 */
const ThinkingRow = ({
  step,
  message,
  streaming,
  isLast,
  thinkingCollapse,
}: {
  step: Extract<Step, { type: 'thinking' }>
  message: AssistantMessage
  streaming: boolean
  isLast: boolean
  thinkingCollapse: ThinkingCollapse
}) => {
  const lastBlock = step.blocks.at(-1)
  const thinking = streaming && lastBlock?.startedAt !== undefined && lastBlock.endedAt === undefined
  const text = step.blocks.map((block) => block.thinking).join('')
  return (
    <ContentItem isLast={isLast} active={thinking}>
      <ThinkingViewport mode={thinkingCollapse} active={thinking} text={text}>
        <Markdown
          content={text}
          loading={thinking}
          cacheKey={`${message.id}-${step.key}`}
          disableLink
        />
      </ThinkingViewport>
    </ContentItem>
  )
}

const ThinkingViewport = ({
  mode,
  active,
  text,
  children,
}: {
  mode: ThinkingCollapse
  active: boolean
  text: string
  children: ReactNode
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (mode !== 'partial' || !active) {
      return
    }
    // Markdown 渲染有节流，等两帧再滚，确保拿到最新内容高度。
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const element = viewportRef.current
        if (element) {
          element.scrollTop = element.scrollHeight
        }
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [mode, active, text])
  if (mode !== 'partial') {
    return <>{children}</>
  }
  return (
    <div ref={viewportRef} className={styles.thinkingViewport}>
      {children}
    </div>
  )
}

/** 搜索：普通搜索为「已阅读 N 个网页」，边想边搜为「搜索到 N 个网页」，点击打开搜索结果 */
const SearchRow = ({
  step,
  message,
  streaming,
  isLast,
}: {
  step: SearchStep
  message: AssistantMessage
  streaming: boolean
  isLast: boolean
}) => {
  const t = useTranslate()
  const entry = useSearchPanel((state) => state.entry)
  const wip = step.status === 'wip'
  const tick = useTicker(wip && step.queries.length > 1, 2000)
  const count = step.results.length
  const clickable = !wip && count > 0
  const panelEntry = `${message.id}-search-${step.key}`
  const failed = step.status === 'failed'
  const interrupted = failed && !streaming && message.status === 'stopped'

  let body: ReactNode
  if (wip) {
    body =
      step.queries.length > 0 ? (
        <>
          <span className={styles.prefix}>{t('toolSearchIntro')}</span>
          <span className={styles.query} key={tick}>
            {step.queries[tick % step.queries.length]}
          </span>
        </>
      ) : (
        <span>{t(isImageSearchKind(step.kind) ? 'imageSearching' : 'messageSearching')}</span>
      )
  } else if (interrupted) {
    body = <span>{t('searchStopped')}</span>
  } else if (failed) {
    body = <span>{t('toolSearchFail')}</span>
  } else if (count === 0) {
    body = (
      <span>{t(isDeepSearchKind(step.kind) ? 'toolSearchNoResult' : 'messageSearchNoResult')}</span>
    )
  } else {
    const text = t(
      isDeepSearchKind(step.kind)
        ? count === 1
          ? 'toolSearch1Result'
          : 'toolSearchResults'
        : count === 1
          ? 'messageSearchResult'
          : 'messageSearchResults',
      { count }
    )
    body = (
      <>
        <span className={styles.summary}>{text}</span>
        <SiteThumbnails sources={step.results} />
      </>
    )
  }
  return (
    <div
      className={clsx(
        styles.row,
        !isLast && styles.withLine,
        clickable && styles.clickable,
        entry === panelEntry && styles.active
      )}
      onClick={clickable ? () => toggleSearchPanel(panelEntry, step.results) : undefined}
    >
      <span className={styles.rowIcon}>
        {failed ? <IconSearchWarningOutline16 /> : <IconSearchOutline16 />}
      </span>
      {body}
    </div>
  )
}

/** 工具行外壳：左侧图标，右侧可换行的内容 */
const ToolRow = ({
  icon,
  children,
  isLast,
}: {
  icon: ReactNode
  children: ReactNode
  isLast: boolean
}) => (
  <div className={clsx(styles.tool, !isLast && styles.withLine)}>
    <span className={clsx(styles.rowIcon, styles.toolIcon)}>{icon}</span>
    <div className={styles.toolBody}>{children}</div>
  </div>
)

const PageLink = ({ page, failedTip }: { page: PageItem; failedTip?: string }) => (
  <span
    className={clsx(
      styles.page,
      page.status === 'failed' || !page.url ? styles.pageFailed : styles.pageDone
    )}
  >
    {page.status === 'failed' ? (
      <Tooltip content={failedTip}>
        <span className={styles.pageText}>{page.title}</span>
      </Tooltip>
    ) : (
      <a className={styles.pageText} href={page.url} target="_blank" rel="noreferrer">
        {page.title}
      </a>
    )}
    <span className={styles.pageIcon}>
      <IconRightUpOutline14 />
    </span>
  </span>
)

/** 边想边搜打开的网页：「浏览 N 个页面」+ 最多 5 个页面 */
const OpenRow = ({
  step,
  sources,
  isLast,
}: {
  step: OpenStep
  sources: Source[]
  isLast: boolean
}) => {
  const t = useTranslate()
  const allFailed = step.pages.every((page) => page.status === 'failed')
  const count = step.pages.length
  const intro = t(count === 1 ? 'toolOpenOneIntro' : 'toolOpensIntro', { count })
  const panelEntry = `open-${step.pages[0]?.id}`
  return (
    <ToolRow
      icon={allFailed ? <IconBrowseWarningOutline16 /> : <IconBrowseOutline16 />}
      isLast={isLast}
    >
      {allFailed ? (
        t('toolOpenFail')
      ) : (
        <>
          <span className={styles.intro}>{intro}</span>
          {step.pages.slice(0, 5).map((page) => (
            <PageLink key={page.id} page={page} failedTip={t('toolOpenFailTooltip')} />
          ))}
          {count > 5 ? (
            <span
              className={styles.chip}
              onClick={() =>
                toggleSearchPanel(
                  panelEntry,
                  sources.filter((source) => step.pages.some((page) => page.url === source.url))
                )
              }
            >
              {t('toolOpenViewAll')}
            </span>
          ) : null}
        </>
      )}
    </ToolRow>
  )
}

/** 边想边搜的页内查找：「查找关键词」+ 关键词标签 */
const FindRow = ({ step, isLast }: { step: FindStep; isLast: boolean }) => {
  const t = useTranslate()
  const allFailed = step.patterns.every((item) => item.status === 'failed')
  return (
    <ToolRow
      icon={allFailed ? <IconBrowseWarningOutline16 /> : <IconBrowseOutline16 />}
      isLast={isLast}
    >
      {allFailed ? (
        t('toolFindFail')
      ) : (
        <>
          <span className={styles.intro}>{t('toolFindIntro')}</span>
          {step.patterns.map((item) => (
            <Tooltip
              key={item.id}
              content={item.status === 'failed' ? t('toolFindFailTooltip') : null}
            >
              <span className={clsx(styles.chip, item.status === 'failed' && styles.chipFailed)}>
                {item.status === 'wip' ? null : (
                  <span className={styles.chipIcon}>
                    {item.status === 'failed' ? <IconCloseFill14 /> : <IconCheckedOutline14 />}
                  </span>
                )}
                <span className={styles.chipText}>{item.pattern}</span>
              </span>
            </Tooltip>
          ))}
        </>
      )}
    </ToolRow>
  )
}

/** 阅读用户消息中的链接：视图只保留仍在读取的链接。 */
const ReadLinkRow = ({ step, isLast }: { step: ReadLinkStep; isLast: boolean }) => {
  const t = useTranslate()
  return (
    <ToolRow icon={<IconLinkOutline16 />} isLast={isLast}>
      <span className={clsx(styles.intro, styles.shimmer)}>{t('readingLink')}</span>
      {step.links.map((link) => (
        <PageLink key={link.id} page={link} />
      ))}
    </ToolRow>
  )
}
