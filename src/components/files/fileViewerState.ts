import { create } from 'zustand'

/** 应用内文本文件查看器：文本已在打开前解码，原件仍留在 IndexedDB */
export type FileViewerItem = {
  name: string
  text: string
  /** md 按 Markdown 渲染，其余纯文本等宽显示 */
  markdown: boolean
}

type FileViewerState = { item: FileViewerItem | null }

export const useFileViewer = create<FileViewerState>(() => ({ item: null }))

export const openFileViewer = (item: FileViewerItem) => useFileViewer.setState({ item })

export const closeFileViewer = () => useFileViewer.setState({ item: null })
