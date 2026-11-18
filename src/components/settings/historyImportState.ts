import { create } from 'zustand'

/** 历史导入进度（0–100）；null 表示当前没有导入任务。 */
type HistoryImportProgressState = { progress: number | null }

export const useHistoryImportProgress = create<HistoryImportProgressState>(() => ({
  progress: null,
}))

export const setHistoryImportProgress = (progress: number | null) =>
  useHistoryImportProgress.setState({ progress })