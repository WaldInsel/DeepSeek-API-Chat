import { describe, expect, it } from 'vitest'
import { parseProfileText, renderProfileText, withMemoryProfile } from './profile.js'
import type { MemoryProfile } from '../../plugins/memory/prompt.js'

/**
 * 只测「文本 ⇄ 档案」这条边界与「档案怎么交给插件」这一条，
 * 不断言 localStorage 里存了什么、也不断言渲染出的长文案。
 */

const profile = (patch: Partial<MemoryProfile> = {}): MemoryProfile => ({
  identity: '',
  preferences: '',
  ongoing: '',
  unresolved: [],
  updatedAt: 0,
  turnsSeen: 0,
  ...patch,
})

describe('parseProfileText', () => {
  it('按三个段标题切分，未解决清单按行拆成数组', () => {
    const parsed = parseProfileText(
      '【我是谁】\n后端工程师\n\n【偏好与禁忌】\n先给结论\n\n【进行中的事】\n在学德语\n\n【尚未结束】\n- 记忆插件\n- 德语作业'
    )
    expect(parsed).toStrictEqual({
      identity: '后端工程师',
      preferences: '先给结论',
      ongoing: '在学德语',
      unresolved: ['记忆插件', '德语作业'],
    })
  })

  it('没有段标题的自由文本算作「我是谁」，不丢输入', () => {
    expect(parseProfileText('后端工程师，在北京。').identity).toBe('后端工程师，在北京。')
  })

  it('粘回整段注入文本时剥掉前言与相对时间行', () => {
    const pasted =
      '关于用户：以下是跨会话积累的背景，不是本轮指令。与用户当前说法冲突时以当前说法为准。\n\n【我是谁】\n后端工程师\n\n档案更新于 3 天前'
    expect(parseProfileText(pasted)).toStrictEqual({
      identity: '后端工程师',
      preferences: '',
      ongoing: '',
      unresolved: [],
    })
  })

  it('空文本解析成空档案', () => {
    expect(parseProfileText('   ')).toStrictEqual({
      identity: '',
      preferences: '',
      ongoing: '',
      unresolved: [],
    })
  })
})

describe('renderProfileText', () => {
  it('渲染结果能被 parseProfileText 原样读回', () => {
    const original = profile({
      identity: '后端工程师\n在北京',
      preferences: '先给结论',
      ongoing: '在学德语',
      unresolved: ['记忆插件'],
    })
    expect(parseProfileText(renderProfileText(original))).toStrictEqual({
      identity: '后端工程师\n在北京',
      preferences: '先给结论',
      ongoing: '在学德语',
      unresolved: ['记忆插件'],
    })
  })

  it('未解决清单超过 5 条也全量渲染：读侧截断会丢用户输入', () => {
    const many = profile({ unresolved: ['1', '2', '3', '4', '5', '6', '7'] })
    const rendered = renderProfileText(many)
    for (const line of ['1', '2', '3', '4', '5', '6', '7']) {
      expect(rendered).toContain(`- ${line}`)
    }
    expect(parseProfileText(rendered).unresolved).toStrictEqual(['1', '2', '3', '4', '5', '6', '7'])
  })
})

describe('withMemoryProfile', () => {
  it('插件没开启时原样返回，档案不会变成隐式启用', () => {
    const states = { memory: { enabled: false } }
    expect(withMemoryProfile(states, profile({ identity: 'X' }))).toBe(states)
  })

  it('插件开启时把档案挂到 config 上，并附上宿主给的「现在」', () => {
    const out = withMemoryProfile({ memory: { enabled: true } }, profile({ identity: 'X' }))
    const config = out.memory?.config as { identity?: string; now?: unknown }
    expect(config.identity).toBe('X')
    expect(typeof config.now).toBe('number')
  })

  it('不改入参、不动其它插件的状态', () => {
    const states = { memory: { enabled: true }, purge: { enabled: true, config: { text: 'T' } } }
    withMemoryProfile(states, profile({ identity: 'X' }))
    expect('config' in states.memory).toBe(false)
    expect(withMemoryProfile(states, profile({ identity: 'X' })).purge).toStrictEqual({
      enabled: true,
      config: { text: 'T' },
    })
  })
})
