import { useEffect, useRef } from 'react'
import { pushBackHandler } from '../../app/backStack.js'
import { openExternal } from '../../app/systemBars.js'
import { useTranslate, type TranslationKey } from '../../i18n/index.js'
import { IconArrowLeftOutline16, IconRightUpOutline14 } from '../base/icons.js'
import { usePresence } from '../base/usePresence.js'
import { closeApiGuide, useApiGuide } from './apiGuideState.js'
import styles from './ApiKeyGuide.module.css'

const STEPS: {
  title: TranslationKey
  description: TranslationKey
  url: string
  display: string
}[] = [
  {
    title: 'apiKeyGuideStep1Title',
    description: 'apiKeyGuideStep1Description',
    url: 'https://platform.deepseek.com',
    display: 'platform.deepseek.com',
  },
  {
    title: 'apiKeyGuideStep2Title',
    description: 'apiKeyGuideStep2Description',
    url: 'https://platform.deepseek.com/profile',
    display: 'platform.deepseek.com/profile',
  },
  {
    title: 'apiKeyGuideStep3Title',
    description: 'apiKeyGuideStep3Description',
    url: 'https://platform.deepseek.com/top_up',
    display: 'platform.deepseek.com/top_up',
  },
  {
    title: 'apiKeyGuideStep4Title',
    description: 'apiKeyGuideStep4Description',
    url: 'https://platform.deepseek.com/api_keys',
    display: 'platform.deepseek.com/api_keys',
  },
]

/** API 获取指引：全屏页面，四步整卡可点，统一用系统浏览器打开。 */
export const ApiKeyGuide = () => {
  const t = useTranslate()
  const open = useApiGuide((state) => state.open)
  const { mounted, visible } = usePresence(open)
  const pageRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    pageRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])

  useEffect(() => {
    if (!mounted) {
      return
    }
    // 退出动画期间继续拦截返回和 Esc，避免把下面的设置一起关掉
    return pushBackHandler(closeApiGuide)
  }, [mounted])

  useEffect(() => {
    if (!mounted) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      event.stopPropagation()
      if (open) {
        closeApiGuide()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [mounted, open])

  if (!mounted) {
    return null
  }

  return (
    <div
      ref={pageRef}
      className={styles.page}
      data-state={visible ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={t('apiKeyGuideTitle')}
      tabIndex={-1}
    >
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={closeApiGuide}>
          <IconArrowLeftOutline16 />
          {t('apiKeyGuideBack')}
        </button>
        <h1 className={styles.title}>{t('apiKeyGuideTitle')}</h1>
      </header>
      <div className={styles.content}>
        <p className={styles.intro}>{t('apiKeyGuideIntro')}</p>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.url}>
              <a
                className={styles.step}
                href={step.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.preventDefault()
                  openExternal(step.url)
                }}
              >
                <span className={styles.index} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{t(step.title)}</span>
                  <span className={styles.stepDescription}>{t(step.description)}</span>
                  <span className={styles.stepUrl}>{step.display}</span>
                </span>
                <span className={styles.external} aria-hidden="true">
                  <IconRightUpOutline14 />
                </span>
              </a>
            </li>
          ))}
        </ol>
        <p className={styles.note}>{t('apiKeyGuideNote')}</p>
      </div>
    </div>
  )
}