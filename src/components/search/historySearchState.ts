import { create } from 'zustand'
import { stopMessageEdits } from '../../app/viewport.js'
import { selectSession } from '../../services/chat/store.js'

type HistorySearchState = {
  open: boolean
  /** 搜索命中后等待消息列表定位的目标；定位完成后清空 */
  focus: { sessionId: string; messageId: string } | null
}

export const useHistorySearch = create<HistorySearchState>(() => ({ open: false, focus: null }))

export const openHistorySearch = () => {
  // 内联编辑会锁住页面高度，搜索框弹键盘时会被挡住；先退出编辑
  stopMessageEdits()
  useHistorySearch.setState({ open: true })
}

export const closeHistorySearch = () => useHistorySearch.setState({ open: false })

/** 点击搜索结果：收起搜索、切到会话；命中消息时留给列表定位 */
export const chooseSearchHit = (sessionId: string, messageId: string | null) => {
  useHistorySearch.setState({
    open: false,
    focus: messageId ? { sessionId, messageId } : null,
  })
  selectSession(sessionId)
}

export const clearSearchFocus = () => {
  if (useHistorySearch.getState().focus) {
    useHistorySearch.setState({ focus: null })
  }
}
