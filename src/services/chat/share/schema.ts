import type {
  ChatMessage,
  ChatMessageStatus,
  Fragment,
  SearchResult,
  SessionFile,
  TipStyle,
  ToolSearchFragment,
} from '../history/format.js'
import { failShare } from './errors.js'

/**
 * 分享接口的响应是外部数据，逐字段读取而不是直接断言类型：
 * 结构不认识的片段直接丢弃，整体缺消息则整条导入失败。
 */

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** 分享里的时间是秒级浮点，归档要求 UTC RFC 3339。 */
const secondsToIso = (value: unknown, fallback: number): string => {
  const seconds = finite(value)
  if (seconds !== null) {
    return new Date(seconds * 1000).toISOString()
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }
  return new Date(fallback).toISOString()
}

const optionalIso = (value: unknown): string | null => {
  const seconds = finite(value)
  if (seconds !== null) {
    return new Date(seconds * 1000).toISOString()
  }
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }
  return null
}

/** 正文里的 [reference:N] 是引用角标，归档产物里已被剥除。 */
const stripReferences = (content: string): string =>
  content.replace(/[ \t]*\[reference:\d+\]/g, '')

const STATUSES = new Set<ChatMessageStatus>([
  'WIP',
  'FINISHED',
  'CONTENT_FILTER',
  'FAILED',
  'INCOMPLETE',
  'CONTEXT_LENGTH_EXCEEDED',
  'TIMEOUT',
])

const TIP_STYLES = new Set<TipStyle>(['INFO', 'WARNING', 'CAUTION'])
const SEARCH_STATUSES = new Set<NonNullable<ToolSearchFragment['status']>>([
  'WIP',
  'FINISHED',
  'FAILED',
])

const queries = (value: unknown): string[] =>
  list(value).flatMap((item) => {
    if (typeof item === 'string') {
      return [item]
    }
    const query = isRecord(item) ? text(item.query) : ''
    return query ? [query] : []
  })

const searchResults = (value: unknown): SearchResult[] =>
  list(value).flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }
    const url = text(item.url)
    if (!url) {
      return []
    }
    const siteIcon = text(item.site_icon)
    return [
      {
        url,
        title: text(item.title),
        snippet: text(item.snippet),
        published_at: optionalIso(item.published_at),
        site_name: text(item.site_name) || null,
        ...(siteIcon ? { site_icon: siteIcon } : {}),
      },
    ]
  })

const fragment = (value: unknown): Fragment | null => {
  if (!isRecord(value)) {
    return null
  }
  switch (value.type) {
    case 'REQUEST':
      return { type: 'REQUEST', content: stripReferences(text(value.content)) }
    case 'RESPONSE':
      return { type: 'RESPONSE', content: stripReferences(text(value.content)) }
    case 'THINK':
      return {
        type: 'THINK',
        content: text(value.content),
        elapsed_secs: finite(value.elapsed_secs),
      }
    case 'TIP': {
      const content = text(value.content)
      if (!content) {
        return null
      }
      const style = TIP_STYLES.has(value.style as TipStyle) ? (value.style as TipStyle) : 'INFO'
      return { type: 'TIP', content, style }
    }
    case 'TOOL_SEARCH': {
      const status = SEARCH_STATUSES.has(value.status as NonNullable<ToolSearchFragment['status']>)
        ? (value.status as NonNullable<ToolSearchFragment['status']>)
        : undefined
      return {
        type: 'TOOL_SEARCH',
        queries: queries(value.queries),
        results: searchResults(value.results),
        ...(status === undefined ? {} : { status }),
      }
    }
    // 分享里的 TOOL_OPEN 只有引用标记、没有 URL，本地无法展示，直接丢弃。
    default:
      return null
  }
}

const message = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) {
    return null
  }
  const id = finite(value.message_id)
  if (id === null) {
    return null
  }
  const now = Date.now()
  const fragments = list(value.fragments).flatMap((item) => {
    const parsed = fragment(item)
    return parsed ? [parsed] : []
  })
  return {
    id,
    parent_id: finite(value.parent_id),
    role: value.role === 'ASSISTANT' ? 'ASSISTANT' : 'USER',
    status: STATUSES.has(value.status as ChatMessageStatus)
      ? (value.status as ChatMessageStatus)
      : 'INCOMPLETE',
    thinking_enabled: value.thinking_enabled === true,
    search_enabled: value.search_enabled === true,
    accumulated_token_usage: finite(value.accumulated_token_usage) ?? 0,
    inserted_at: secondsToIso(value.inserted_at, now),
    fragments,
  }
}

const title = (value: unknown, messages: ChatMessage[]): string | null => {
  const raw = text(value).trim()
  if (raw && raw !== 'Shared Conversation') {
    return raw
  }
  const request = messages.find((item) => item.role === 'USER')
  const content = request?.fragments.find((item) => item.type === 'REQUEST')
  const fallback = content?.type === 'REQUEST' ? content.content.replace(/\s+/g, ' ').trim() : ''
  return fallback ? fallback.slice(0, 30) : null
}

/** 把分享接口响应转换成归档侧 SessionFile，后续复用 toLocalSession。 */
export const toSessionFile = (payload: unknown, sessionId: string): SessionFile => {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
  if (!data || !isRecord(data.biz_data)) {
    return failShare('shareImportInvalidData')
  }
  const bizData = data.biz_data
  const messages = list(bizData.messages)
    .flatMap((item) => {
      const parsed = message(item)
      return parsed ? [parsed] : []
    })
    .toSorted((a, b) => a.id - b.id)
  if (messages.length === 0) {
    failShare('shareImportInvalidData')
  }
  const first = messages[0]
  const last = messages[messages.length - 1]
  return {
    id: sessionId,
    title: title(bizData.title, messages),
    pinned: false,
    current_message_id: last.id,
    inserted_at: first.inserted_at,
    updated_at: last.inserted_at,
    messages,
  }
}