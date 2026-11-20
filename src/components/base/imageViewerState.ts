import { create } from 'zustand'

export type ImageViewerItem = {
  src: string
  alt: string
}

export const useImageViewer = create<{ item: ImageViewerItem | null }>(() => ({ item: null }))

/** 打开全屏图片查看器；src 可以是 blob:/http(s): 链接 */
export const openImageViewer = (src: string, alt = '') => {
  useImageViewer.setState({ item: { src, alt } })
}

export const closeImageViewer = () => {
  useImageViewer.setState({ item: null })
}