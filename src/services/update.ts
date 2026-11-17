import { create } from 'zustand'
import { isCapacitor, isTauri } from '../app/platform.js'

const REPOSITORY = 'ckckh2023/DeepSeek-API-Chat'
export const RELEASES_URL = `https://github.com/${REPOSITORY}/releases/latest`
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
/** 启动后等半分钟再查，避开首屏渲染和初始化请求 */
const CHECK_DELAY_MS = 30_000

/** 打包时由 rspack 写进 index.html，见 rspack.config.ts 的 HtmlRspackPlugin meta */
export const appVersion = (): string =>
  document
    .querySelector('meta[name="application-version"]')
    ?.getAttribute('content')
    ?.trim() ?? ''

const toParts = (version: string): number[] =>
  version
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((value) => (Number.isFinite(value) ? value : 0))

/** 逐段比较，返回正数表示 left 更新 */
export const compareVersions = (left: string, right: string): number => {
  const a = toParts(left)
  const b = toParts(right)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }
  return 0
}

const readTag = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) {
    return ''
  }
  const tag = (value as { tag_name?: unknown }).tag_name
  return typeof tag === 'string' ? tag.trim() : ''
}

const fetchLatestVersion = async (): Promise<string> => {
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) {
      return ''
    }
    return readTag(await response.json())
  } catch {
    return ''
  }
}

type UpdateState = {
  /** 存在比当前更新的版本时是它的 tag，空字符串表示没有更新 */
  latest: string
  check: () => Promise<void>
}

export const useUpdateStore = create<UpdateState>((set) => ({
  latest: '',
  check: async () => {
    const current = appVersion()
    const latest = await fetchLatestVersion()
    if (!current || !latest || compareVersions(latest, current) <= 0) {
      return
    }
    set({ latest })
  },
}))

/** 启动后延迟检查一次；只在 App 的 WebView 里跑，网页版不检查 */
export const setupUpdateCheck = () => {
  if (!isTauri() && !isCapacitor()) {
    return undefined
  }
  const timer = window.setTimeout(() => {
    void useUpdateStore.getState().check()
  }, CHECK_DELAY_MS)
  return () => window.clearTimeout(timer)
}

/** 跳转 Releases；安卓走原生 Intent，桌面端交给系统浏览器 */
export const openReleases = () => {
  if (isCapacitor() && window.SystemBars?.openExternal) {
    window.SystemBars.openExternal(RELEASES_URL)
    return
  }
  window.open(RELEASES_URL, '_blank', 'noopener,noreferrer')
}
