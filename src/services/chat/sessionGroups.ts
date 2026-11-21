import { translate } from '../../i18n/index.js'
import { monthKey } from '../../utils/format.js'
import type { SessionSummary } from './types.js'

const DAY = 86_400_000

const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0)

export const PINNED_GROUP_KEY = 'sessionHistoryTimelineLabelPinned' as const

export type SessionGroup = { key: string; label: string; sessions: SessionSummary[] }

/** 只保留前 limit 个会话，分组标题随剩余内容保留。 */
export const limitSessionGroups = (groups: SessionGroup[], limit: number): SessionGroup[] => {
  let remaining = limit
  const result: SessionGroup[] = []
  for (const group of groups) {
    if (remaining <= 0) {
      break
    }
    const sessions = group.sessions.slice(0, remaining)
    remaining -= sessions.length
    result.push({ ...group, sessions })
  }
  return result
}

/** 分组：置顶 / 今天 / 昨天 / 7 天内 / 30 天内 / 按月 */
export const groupSessions = (
  sessions: SessionSummary[],
  now: number,
  t = translate,
  pinnedIds: readonly string[] = []
) => {
  const groups: SessionGroup[] = []
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const pinned = pinnedIds.flatMap((id) => {
    const session = byId.get(id)
    return session ? [session] : []
  })
  const pinnedSet = new Set(pinned.map((session) => session.id))
  if (pinned.length > 0) {
    groups.push({ key: PINNED_GROUP_KEY, label: t(PINNED_GROUP_KEY), sessions: pinned })
  }
  for (const session of sessions) {
    if (pinnedSet.has(session.id)) {
      continue
    }
    const diff = Math.floor((now - startOfDay(session.updatedAt)) / DAY)
    const key =
      diff <= 0
        ? 'sessionHistoryTimelineLabelToday'
        : diff <= 1
          ? 'sessionHistoryTimelineLabelYesterday'
          : diff < 7
            ? 'sessionHistoryTimelineLabel7days'
            : diff < 30
              ? 'sessionHistoryTimelineLabel30days'
              : null
    const groupKey = key ?? monthKey(session.updatedAt) ?? ''
    const last = groups.at(-1)
    if (last?.key === groupKey) {
      last.sessions.push(session)
    } else {
      groups.push({ key: groupKey, label: key ? t(key) : groupKey, sessions: [session] })
    }
  }
  return groups
}
