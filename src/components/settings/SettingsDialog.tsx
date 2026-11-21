import clsx from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  IconDataOutline16,
  IconDownloadOutline16,
  IconSettingsOutline16,
  IconUploadOutline14,
} from '../base/icons.js'
import {
  BackupError,
  clearHistory,
  exportHistory,
  importHistory,
} from '../../services/chat/backup.js'
import { isCapacitor, isTauri } from '../../app/platform.js'
import { pushBackHandler } from '../../app/backStack.js'
import { useIsMobile } from '../../app/viewport.js'
import { useChatStore } from '../../services/chat/store.js'
import {
  setLocale,
  setThemePreference,
  setThinkingCollapse,
  setTtsVoice,
  useSettings,
  type ThemePreference,
  type ThinkingCollapse,
} from '../../services/settings.js'
import { useTranslate, type TranslationKey, type TranslationMessage } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { Select } from '../base/Select.js'
import { showToast } from '../base/toastState.js'
import { usePresence } from '../base/usePresence.js'
import { ApiKeyConfirm, ApiKeyField, useApiKeyEditor } from './ApiKeyField.js'
import {
  setHistoryImportProgress,
  useHistoryImportProgress,
  type HistoryImportProgress,
} from './historyImportState.js'
import { closeSettings, useSettingsDialog, type SettingsSection } from './settingsDialogState.js'
import { ImportDialog } from './ImportDialog.js'
import { ImportProgress } from './ImportProgress.js'
import { UpdateCheck } from './UpdateCheck.js'
import styles from './Settings.module.css'

/**
 * 设置弹窗：分「通用设置」（主题、语言、朗读音色）与「数据管理」（API Key、导入、导出、删除）。
 * 桌面端为居中弹窗、左侧导航；移动端为底部弹层、导航横排在内容上方
 */
export const SettingsDialog = () => {
  const open = useSettingsDialog((state) => state.open)
  // 关闭时保留 DOM 播完动画：桌面端淡出，移动端向下划出
  const { mounted, visible } = usePresence(open)
  return mounted ? <SettingsContent state={visible ? 'open' : 'closed'} /> : null
}

const sections: { value: SettingsSection; label: TranslationKey; icon: ReactNode }[] = [
  {
    value: 'general',
    label: 'settingDialogAsideGeneralOptionLabel',
    icon: <IconSettingsOutline16 />,
  },
  { value: 'data', label: 'settingDialogAsideDataOptionLabel', icon: <IconDataOutline16 /> },
]

const SettingsContent = ({ state }: { state: 'open' | 'closed' }) => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  // 打开时按调用方指定的分组选中，之后在弹窗内切换
  const [section, setSection] = useState(() => useSettingsDialog.getState().section)
  const [importOpen, setImportOpen] = useState(false)
  // 切换分组不丢失正在输入的 API Key 与导入状态
  const apiKeyEditor = useApiKeyEditor()
  const historyImport = useHistoryImport()
  const historyDelete = useHistoryDelete()
  const historyImportProgress = useHistoryImportProgress((state) => state.progress)
  const replacingHistory = useChatStore((state) => state.importingHistory)
  const historyBusy = historyImport.busy || historyDelete.busy || replacingHistory
  return (
    <>
      <Modal
        title={t('settings')}
        closable
        className={styles.dialog}
        mainClassName={styles.dialogMain}
        state={state}
        onClose={() => {
          if (!historyDelete.busy) {
            closeSettings()
          }
        }}
      >
        <div role="tablist" className={styles.navigation}>
          {sections.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={section === item.value}
              className={clsx(styles.navItem, section === item.value && styles.navItemActive)}
              onClick={() => setSection(item.value)}
            >
              {item.icon}
              {t(item.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className={styles.content}>
          {section === 'general' ? (
            <>
              <ThemeSetting />
              <LocaleSetting />
              <ThinkingCollapseSetting />
              <TtsVoiceSetting />
              <UpdateCheck />
            </>
          ) : (
            <>
              <ApiKeyField editor={apiKeyEditor} />
              <ImportHistory
                historyImport={historyImport}
                disabled={historyBusy}
                progress={historyImportProgress}
                onOpen={() => setImportOpen(true)}
              />

              <ExportHistory disabled={historyBusy} />
              <SettingCell
                label={t('deleteAllSessions')}
                status={null}
                action={
                  <Button
                    variant="dangerOutlined"
                    size="m"
                    className={styles.cellButton}
                    disabled={historyBusy}
                    onClick={historyDelete.open}
                  >
                    {t('delete')}
                  </Button>
                }
              />
              {isMobile ? <ApiKeyConfirm editor={apiKeyEditor} /> : null}
            </>
          )}
        </div>
      </Modal>
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        disabled={historyBusy}
        archiveBusy={historyImport.busy}
        archiveProgress={historyImportProgress}
        archiveStatus={historyImport.status}
        onSelectArchive={historyImport.select}
      />
      {historyImport.file ? <ImportConfirm historyImport={historyImport} /> : null}
      {historyDelete.opened ? <DeleteAllConfirm historyDelete={historyDelete} /> : null}
    </>
  )
}

/** 删除确认保留在设置之上；失败可重试，成功只关闭确认弹窗。 */
const DeleteAllConfirm = ({
  historyDelete,
}: {
  historyDelete: ReturnType<typeof useHistoryDelete>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('deleteAllSessionsModalTitle')}
      className={styles.deleteConfirm}
      onClose={historyDelete.cancel}
      footer={
        <div className={styles.deleteActions} aria-busy={historyDelete.busy}>
          <Button
            variant="outlined"
            autoFocus
            disabled={historyDelete.busy}
            onClick={historyDelete.cancel}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={historyDelete.busy}
            onClick={() => void historyDelete.confirm()}
          >
            {t(historyDelete.busy ? 'historyDeleting' : 'deleteAllSessions')}
          </Button>
        </div>
      }
    >
      {t('deleteAllSessionsModalDescription')}
    </Modal>
  )
}

const useHistoryDelete = () => {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const deleting = useRef(false)

  const confirm = async () => {
    if (deleting.current) {
      return
    }
    deleting.current = true
    setBusy(true)
    try {
      await clearHistory()
      setOpened(false)
      showToast({ key: 'historyDeleted' })
    } catch {
      showToast({ key: 'historyDeleteFailed', type: 'error' })
    } finally {
      deleting.current = false
      setBusy(false)
    }
  }

  return {
    opened,
    busy,
    open: () => setOpened(true),
    cancel: () => {
      if (!deleting.current) {
        setOpened(false)
      }
    },
    confirm,
  }
}


const LocaleSetting = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  return (
    <SettingCell
      label={t('settingsLocalePreference')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsLocalePreference')}
          value={locale}
          options={[
            { value: 'zh-CN', label: t('settingsLocaleZhCN'), lang: 'zh-CN' },
            { value: 'en-US', label: t('settingsLocaleEnUS'), lang: 'en' },
          ]}
          onChange={setLocale}
        />
      }
    />
  )
}

/** 朗读音色：stella（海星，女声）/ tide（暗潮，男声） */
const TtsVoiceSetting = () => {
  const t = useTranslate()
  const ttsVoice = useSettings((state) => state.ttsVoice)
  return (
    <SettingCell
      label={t('settingsTtsVoice')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsTtsVoice')}
          value={ttsVoice}
          options={[
            { value: 'stella', label: t('settingsTtsVoiceStella') },
            { value: 'tide', label: t('settingsTtsVoiceTide') },
          ]}
          onChange={setTtsVoice}
        />
      }
    />
  )
}

/** 思考内容：完全折叠只保留标题；部分折叠展开时限高滚动、历史回复默认收起；不折叠完整展开。 */
const thinkingCollapseOptions: { value: ThinkingCollapse; label: TranslationKey }[] = [
  { value: 'full', label: 'settingsThinkingCollapseFull' },
  { value: 'partial', label: 'settingsThinkingCollapsePartial' },
  { value: 'none', label: 'settingsThinkingCollapseNone' },
]

const ThinkingCollapseSetting = () => {
  const t = useTranslate()
  const thinkingCollapse = useSettings((state) => state.thinkingCollapse)
  return (
    <SettingCell
      label={t('settingsThinkingCollapse')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsThinkingCollapse')}
          value={thinkingCollapse}
          options={thinkingCollapseOptions.map((option) => ({
            value: option.value,
            label: t(option.label),
          }))}
          onChange={setThinkingCollapse}
        />
      }
    />
  )
}

/** 覆盖导入的二次确认，叠在设置弹窗上 */
const ImportConfirm = ({
  historyImport,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
}) => {
  const t = useTranslate()
  const cancelRef = useRef(historyImport.cancel)
  cancelRef.current = historyImport.cancel
  // 返回键先关确认弹窗，再关下面的导入弹窗
  useEffect(() => pushBackHandler(() => cancelRef.current()), [])
  return (
    <Modal
      title={t('historyImportConfirmTitle')}
      className={styles.importConfirm}
      onClose={historyImport.cancel}
      footer={
        <>
          <Button variant="outlined" size="m" autoFocus onClick={historyImport.cancel}>
            {t('cancel')}
          </Button>
          <Button variant="dangerOutlined" size="m" onClick={() => void historyImport.confirm()}>
            {t('historyImportConfirm')}
          </Button>
        </>
      }
    >
      <div className={styles.importConfirmText}>{t('historyImportConfirmDescription')}</div>
    </Modal>
  )
}

const themeOptions: { value: ThemePreference; label: TranslationKey }[] = [
  { value: 'light', label: 'avatarMenuSettingsDialogThemeSelectLightOption' },
  { value: 'dark', label: 'avatarMenuSettingsDialogThemeSelectDarkOption' },
  { value: 'system', label: 'avatarMenuSettingsDialogThemeSelectSystemOption' },
]

/** 主题项：与语言、朗读音色、位置一致，用下拉框选择，未保存时默认跟随系统。 */
const ThemeSetting = () => {
  const t = useTranslate()
  const themePreference = useSettings((state) => state.themePreference)
  return (
    <SettingCell
      label={t('avatarMenuSettingsDialogThemeItemLabel')}
      status={null}
      action={
        <Select
          ariaLabel={t('avatarMenuSettingsDialogThemeItemLabel')}
          value={themePreference}
          options={themeOptions.map((option) => ({ value: option.value, label: t(option.label) }))}
          onChange={setThemePreference}
        />
      }
    />
  )
}

/** `reason` 为失败原因的文案 key，展示时按当前语言翻译后填入 `message` 参数。 */
type Status = (TranslationMessage & { error?: boolean; reason?: TranslationKey }) | null

/** 导出失败附带原因：预期的错误用对应文案作原因，其他错误用错误信息。 */
const errorStatus = (key: TranslationKey, error: unknown): Status => ({
  key,
  ...(error instanceof BackupError
    ? { reason: error.key }
    : { params: { message: error instanceof Error ? error.message : String(error) } }),
  error: true,
})

const SettingCell = ({
  label,
  description,
  status,
  action,
  className,
}: {
  label: string
  description?: ReactNode
  status: Status
  action: ReactNode
  className?: string
}) => {
  const t = useTranslate()
  return (
    <div className={clsx(styles.cell, styles.row, className)}>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
        {status || description ? (
          <div className={clsx(styles.description, status?.error && styles.error)}>
            {status
              ? t(status.key, status.reason ? { message: t(status.reason) } : status.params)
              : description}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** 选文件后先提示覆盖；确认后才检查文件并执行导入，任何错误都提示导入失败。 */
const useHistoryImport = () => {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const importing = useRef(false)

  const confirm = async () => {
    if (!file || importing.current) {
      return
    }
    importing.current = true
    setFile(null)
    setBusy(true)
    setStatus(null)
    // 解析 ZIP 中央目录期间没有字节进度，先显示不确定的「正在解析文件」。
    setHistoryImportProgress({ phase: 'parsing' })
    try {
      const count = await importHistory(file, (ratio) => {
        // 进度条只显示整数百分比，避免每个解压分块都触发渲染。
        const percent = Math.round(ratio * 100)
        const current = useHistoryImportProgress.getState().progress
        if (current?.phase !== 'importing' || current.percent !== percent) {
          setHistoryImportProgress({ phase: 'importing', percent })
        }
      })
      setStatus({ key: count === 1 ? 'historyImportedOne' : 'historyImported', params: { count } })
    } catch {
      setStatus({ key: 'historyImportFailed', error: true })
    } finally {
      importing.current = false
      setBusy(false)
      setHistoryImportProgress(null)
    }
  }

  return { file, busy, status, select: setFile, cancel: () => setFile(null), confirm }
}

/** 导入入口：打开导入弹窗；ZIP 仍是覆盖式导入。 */
const ImportHistory = ({
  historyImport,
  disabled,
  progress,
  onOpen,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
  disabled: boolean
  progress: HistoryImportProgress | null
  onOpen: () => void
}) => {
  const t = useTranslate()

  return (
    <SettingCell
      label={t('importEntry')}
      description={
        progress === null ? t('importEntryDescription') : <ImportProgress progress={progress} />
      }
      status={historyImport.status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={clsx(styles.cellButton, styles.uploadButton)}
          disabled={disabled}
          onClick={onOpen}
        >
          <IconUploadOutline14 />
          {t('importHistoryAction')}
        </Button>
      }
    />
  )
}


/** 读取 Blob 为 base64（Capacitor 的 Filesystem 只接受 base64 字符串） */
const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read export archive'))
    reader.readAsDataURL(blob)
  })

/** 将全部会话及图片导出为 ZIP 文件并下载 */
const ExportHistory = ({ disabled }: { disabled: boolean }) => {
  const t = useTranslate()
  const empty = useChatStore((state) => state.sessions.length === 0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const onExport = async () => {
    setBusy(true)
    setStatus(null)
    let savedToDocuments = false
    try {
      const { name, blob, count } = await exportHistory()
      if (isTauri()) {
        const [{ save }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-dialog'),
          import('@tauri-apps/plugin-fs'),
        ])
        const path = await save({
          defaultPath: name,
          filters: [{ name: 'ZIP', extensions: ['zip'] }],
        })
        if (!path) {
          return
        }
        await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
      } else if (isCapacitor()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const data = await blobToBase64(blob)
        try {
          // 写入系统「文档」目录，用户可在文件管理器里直接看到导出的 ZIP
          await Filesystem.writeFile({
            path: name,
            data,
            directory: Directory.Documents,
            recursive: true,
          })
          savedToDocuments = true
        } catch {
          // 个别系统不允许直接写公共目录，退回应用缓存并交给系统分享面板保存
          const { uri } = await Filesystem.writeFile({
            path: name,
            data,
            directory: Directory.Cache,
          })
          const { Share } = await import('@capacitor/share')
          try {
            await Share.share({
              title: name,
              files: [uri.startsWith('file:') ? uri : `file://${uri}`],
              dialogTitle: t('historyExportShare'),
            })
          } catch (error) {
            // 用户在系统分享面板取消，不算导出失败。
            if (/cancel/i.test(String((error as Error | undefined)?.message ?? error))) {
              return
            }
            throw error
          }
        }
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setStatus(
        savedToDocuments
          ? { key: 'historyExportedDocuments', params: { count } }
          : { key: count === 1 ? 'historyExportedOne' : 'historyExported', params: { count } }
      )
    } catch (error) {
      setStatus(errorStatus('historyExportFailed', error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingCell
      label={t('exportAllLabel')}
      description={t('historyExportDescription')}
      status={status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          disabled={disabled || busy || empty}
          onClick={() => void onExport()}
        >
          <IconDownloadOutline16 />
          {t('exportAllDownload')}
        </Button>
      }
    />
  )
}
