import { closeSearchPanel, useSearchPanel } from '../components/search/searchPanelState.js'
import { closeApiGuide, useApiGuide } from '../components/settings/apiGuideState.js'
import { closeSettings, useSettingsDialog } from '../components/settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from '../components/sider/mobileSiderState.js'

declare global {
  interface Window {
    /** MainActivity 返回键回调：返回 true 表示页面已处理，false 交给系统退出 */
    __handleSystemBack?: () => boolean
  }
}

/** 依次关闭指引、设置、搜索结果与对话列表；全部关闭后返回 false，由原生退出应用。 */
export const handleSystemBack = (): boolean => {
  if (useApiGuide.getState().open) {
    closeApiGuide()
    return true
  }
  if (useSettingsDialog.getState().open) {
    closeSettings()
    return true
  }
  if (useSearchPanel.getState().entry !== null) {
    closeSearchPanel()
    return true
  }
  if (useMobileSider.getState().open) {
    closeMobileSider()
    return true
  }
  return false
}

/** 注册原生返回键回调；网页与 Tauri 没有调用方，保持浏览器默认返回。 */
export const setupSystemBack = () => {
  window.__handleSystemBack = handleSystemBack
  return () => {
    delete window.__handleSystemBack
  }
}