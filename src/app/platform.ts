/** 桌面端 Tauri：WebView 里注入 __TAURI_INTERNALS__，<a download> 会被静默写进下载目录且没有下载栏 */
export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 安卓 Capacitor：WebView 里注入 Capacitor 桥，不处理 <a download>，也不支持用 blob: 打开新页面 */
export const isCapacitor = () => typeof window !== 'undefined' && 'Capacitor' in window

/**
 * 普通浏览器（网页版）。
 * 原生 WebView 打开 blob: 链接会白屏甚至卡死（Tauri 新建窗口失败、安卓把主页面导航过去回不来），
 * 这类能力只对网页版开放。
 */
export const isWebApp = () => !isTauri() && !isCapacitor()
