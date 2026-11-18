import type { ReactNode } from 'react'
import {
  IconAudioOffOutline20,
  IconAudioOutline20,
  IconMenuOutline20,
  IconNewChatOutline20,
} from '../base/icons.js'
import { useTranslate } from '../../i18n/index.js'
import { newChat } from '../../services/chat/store.js'
import { setTtsAutoPlay, useSettings } from '../../services/settings.js'
import { primeReadAloud, stopReadAloud } from '../../services/speech/readAloud.js'
import { IconButton } from '../base/IconButton.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

/** 移动端顶栏：左侧菜单打开侧边栏；右侧开启新对话，首页再显示自动朗读开关 */
export const MobileHeader = ({ title, extra }: { title?: string; extra?: ReactNode }) => {
  const t = useTranslate()
  const ttsAutoPlay = useSettings((state) => state.ttsAutoPlay)
  // 开启时借这次点击解锁音频上下文，后续回复完成后的自动朗读才能出声
  const toggleTtsAutoPlay = () => {
    const next = !ttsAutoPlay
    setTtsAutoPlay(next)
    if (next) {
      primeReadAloud()
    } else {
      stopReadAloud()
    }
  }
  return (
    <div className={styles.header}>
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconMenuOutline20 />}
        aria-label={t('expandSiderbarButton')}
        onClick={openMobileSider}
      />
      {title === undefined ? (
        <>
          <div className={styles.spacer} />
          <IconButton
            size="xl"
            tone="primary"
            icon={ttsAutoPlay ? <IconAudioOutline20 /> : <IconAudioOffOutline20 />}
            aria-label={t(ttsAutoPlay ? 'ttsAutoPlayOn' : 'ttsAutoPlayOff')}
            onClick={toggleTtsAutoPlay}
          />
        </>
      ) : (
        <>
          <div className={styles.title}>{title}</div>
          {extra}
        </>
      )}
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconNewChatOutline20 />}
        aria-label={t('newChat')}
        onClick={newChat}
      />
    </div>
  )
}
