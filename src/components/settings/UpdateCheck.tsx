import { useState } from 'react'
import { openExternal } from '../../app/systemBars.js'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import {
  BAIDU_PAN_URL,
  GITEE_RELEASES_URL,
  PAN123_URL,
  RELEASES_URL,
  appVersion,
  checkLatestVersion,
  compareVersions,
} from '../../services/update.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { IconRightUpOutline14 } from '../base/icons.js'
import settingsStyles from './Settings.module.css'
import styles from './UpdateCheck.module.css'

const CHANNELS: { label: TranslationKey; url: string }[] = [
  { label: 'updateChannelGithub', url: RELEASES_URL },
  { label: 'updateChannelGitee', url: GITEE_RELEASES_URL },
  { label: 'updateChannelBaidu', url: BAIDU_PAN_URL },
  { label: 'updateChannel123', url: PAN123_URL },
]

/** 通用设置里的软件版本：手动检查更新，并提供四个下载入口。 */
export const UpdateCheck = () => {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [current, setCurrent] = useState(appVersion)
  const [latest, setLatest] = useState('')

  const runCheck = async () => {
    setChecking(true)
    setLatest('')
    try {
      const result = await checkLatestVersion()
      setCurrent(result.current)
      setLatest(result.latest)
    } finally {
      setChecking(false)
    }
  }

  const openDialog = () => {
    setOpen(true)
    void runCheck()
  }

  const hasUpdate = Boolean(current && latest && compareVersions(latest, current) > 0)

  return (
    <>
      <div className={settingsStyles.cell}>
        <div className={settingsStyles.row}>
          <div className={settingsStyles.text}>
            <div className={settingsStyles.label}>{t('updateSettingLabel')}</div>
            <div className={settingsStyles.description}>
              {t('updateCurrentVersion', { version: current || '—' })}
            </div>
          </div>
          <Button
            variant="outlined"
            size="m"
            className={settingsStyles.cellButton}
            onClick={openDialog}
          >
            {t('updateCheckButton')}
          </Button>
        </div>
      </div>
      {open ? (
        <Modal
          title={t('updateDialogTitle')}
          closable
          footer={
            <Button variant="outlined" size="m" onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
          }
          onClose={() => setOpen(false)}
        >
          <div className={styles.dialog}>
            {checking ? (
              <p className={styles.status}>{t('updateChecking')}</p>
            ) : hasUpdate ? (
              <p className={styles.status}>
                {t('updateAvailableMessage', { version: latest })}
              </p>
            ) : (
              <>
                <p className={styles.statusTitle}>{t('updateNotFoundTitle')}</p>
                <p className={styles.hint}>{t('updateNotFoundHint')}</p>
              </>
            )}
            <p className={styles.current}>
              {t('updateCurrentVersion', { version: current || '—' })}
            </p>
            <p className={styles.sectionTitle}>{t('updateManualDownload')}</p>
            <div className={styles.channels}>
              {CHANNELS.map((channel) => (
                <a
                  key={channel.url}
                  className={styles.channel}
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault()
                    openExternal(channel.url)
                  }}
                >
                  <span>{t(channel.label)}</span>
                  <IconRightUpOutline14 />
                </a>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}