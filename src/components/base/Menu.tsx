import clsx from 'clsx'
import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismiss } from './anchored.js'
import { usePresence } from './usePresence.js'
import styles from './Menu.module.css'

export type MenuOption = {
  key: string
  label: string
  icon: ReactNode
  danger?: boolean
  onSelect: () => void
}

/** 点击触发，向下展开；点外部或 Esc 关闭 */
export const Menu = ({
  options,
  children,
}: {
  options: MenuOption[]
  children: (props: { open: boolean; toggle: () => void }) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  // 左侧对齐并再左移 5px，让菜单文字与触发元素图标对齐
  const { anchorRef, floatingRef, position, side } = useAnchoredPosition<
    HTMLSpanElement,
    HTMLDivElement
  >(open, { align: 'start', alignOffset: -5, offset: 4 })
  useDismiss(open, [anchorRef, floatingRef], close)
  const { mounted, visible } = usePresence(open)
  // 收起动画期间沿用最后的位置，避免菜单一边淡出一边跑回视口左上角
  const lastPosition = useRef(position)
  if (position) {
    lastPosition.current = position
  }

  return (
    <>
      <span ref={anchorRef} className={styles.anchor}>
        {children({ open, toggle: () => setOpen((value) => !value) })}
      </span>
      {mounted
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.menu}
              data-state={visible ? 'open' : 'closed'}
              data-side={side}
              style={lastPosition.current ?? { top: 0, left: 0, visibility: 'hidden' }}
              role="menu"
            >
              {options.map((option) => (
                <div
                  key={option.key}
                  role="menuitem"
                  className={clsx(styles.option, option.danger && styles.danger)}
                  onClick={() => {
                    setOpen(false)
                    option.onSelect()
                  }}
                >
                  <span className={styles.icon}>{option.icon}</span>
                  {option.label}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
