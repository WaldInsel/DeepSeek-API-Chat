import { create } from 'zustand'

/** parsing：读取并校验 ZIP 中央目录；importing：已开始解压写入，percent 为 0–100。 */
export type HistoryImportProgress =
  | { phase: 'parsing' }
  | { phase: 'importing'; percent: number }

type HistoryImportProgressState = { progress: HistoryImportProgress | null }

export const useHistoryImportProgress = create<HistoryImportProgressState>(() => ({
  progress: null,
}))

export const setHistoryImportProgress = (progress: HistoryImportProgress | null) =>
  useHistoryImportProgress.setState({ progress })