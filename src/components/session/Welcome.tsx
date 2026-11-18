import { useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { useChatMode } from '../../services/chatMode.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import { ModeSwitch } from './ModeSwitch.js'
import styles from './Welcome.module.css'

const GREETING_KEYS: TranslationKey[] = [
  'welcomeMessageChat250808',
  'welcomeMessageHelloCanHelp',
  'welcomeMessageWelcomeBackWhere',
  'welcomeMessageHelloAnything',
  'welcomeMessageHiChat',
  'welcomeMessageHelloStart',
  'welcomeMessageWelcomeBackReady',
]

const pickGreeting = (): TranslationKey =>
  GREETING_KEYS[Math.floor(Math.random() * GREETING_KEYS.length)] ?? 'welcomeMessageChat250808'

/** 新对话：问候语 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const chatMode = useChatMode((state) => state.mode)
  const [greeting] = useState(pickGreeting)
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.intro}>
          <div className={styles.greeting}>{t(greeting)}</div>
          <ModeSwitch
            hint={t(chatMode === 'pro' ? 'chatModeProHint' : 'chatModeFlashHint')}
          />
        </div>
        <div className={styles.inputSlot}>
          <ChatInput sessionId={null} />
        </div>
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}