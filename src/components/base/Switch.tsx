import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'
import styles from './Switch.module.css'

/**
 * 开关：点击整块切换，不做拖动。
 * 关闭态是中性灰轨道，开启态用品牌蓝；拇指位移动画跟随项目过渡时长。
 */
export const Switch = ({
  checked,
  onChange,
  className,
  ...props
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'onChange' | 'role' | 'aria-checked'
>) => (
  <button
    {...props}
    type="button"
    role="switch"
    aria-checked={checked}
    className={clsx(styles.switch, checked && styles.checked, className)}
    onClick={() => onChange(!checked)}
  >
    <span className={styles.thumb} />
  </button>
)