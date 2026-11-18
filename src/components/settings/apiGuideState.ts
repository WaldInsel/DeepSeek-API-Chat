import { create } from 'zustand'

type ApiGuideState = { open: boolean }

export const useApiGuide = create<ApiGuideState>(() => ({ open: false }))

export const openApiGuide = () => useApiGuide.setState({ open: true })

export const closeApiGuide = () => useApiGuide.setState({ open: false })