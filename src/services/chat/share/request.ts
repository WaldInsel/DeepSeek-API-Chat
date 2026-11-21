import { isCapacitor, isTauri } from '../../../app/platform.js'
import { ShareError, failShare } from './errors.js'

const SHARE_API = 'https://chat.deepseek.com/api/v0/share/content?share_id='

/** 分享接口前面有 WAF 风控，缺少浏览器 UA 会被拦成 429。 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TIMEOUT_MS = 20_000

/**
 * 读取分享内容。
 *
 * 该接口不返回 `Access-Control-Allow-Origin`，预检也会被 WAF 拦，
 * 所以网页版无法直连；桌面端走 Rust 侧请求，安卓端走原生 HTTP。
 */
export const requestShareContent = async (shareId: string): Promise<unknown> => {
  const url = `${SHARE_API}${encodeURIComponent(shareId)}`
  const headers = { accept: 'application/json', 'user-agent': USER_AGENT }
  try {
    if (isTauri()) {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const response = await fetch(url, { method: 'GET', headers })
      if (!response.ok) {
        return failShare('shareImportNetworkFailed')
      }
      return (await response.json()) as unknown
    }
    if (isCapacitor()) {
      const { CapacitorHttp } = await import('@capacitor/core')
      const response = await CapacitorHttp.get({
        url,
        headers,
        connectTimeout: TIMEOUT_MS,
        readTimeout: TIMEOUT_MS,
      })
      if (response.status < 200 || response.status >= 300) {
        return failShare('shareImportNetworkFailed')
      }
      const { data } = response
      return typeof data === 'string' ? (JSON.parse(data) as unknown) : data
    }
  } catch (error) {
    if (error instanceof ShareError) {
      throw error
    }
    return failShare('shareImportNetworkFailed')
  }
  return failShare('shareImportWebUnsupported')
}