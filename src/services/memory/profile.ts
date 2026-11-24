/**
 * 记忆档案的宿主侧读写。
 *
 * 铁律二规定插件不读 localStorage，所以 Profile 由宿主在这里读出来、塞进插件状态传进去。
 *
 * Profile 存独立键（不复用 pluginSettings.memory.config）：
 * - 开关、正文、档案挤在一份 JSON 里，等于给档案开第二套写入路径；
 * - `config.text` 的语义是「覆盖插件内置正文」，档案不是正文。
 *
 * 第一步只做读写与「贴进来的文本 ⇄ 三段档案」的转换，整理环节在第二步才加。
 */
import type { PluginState } from '../../plugins/index.js'
import type { MemoryProfile } from '../../plugins/memory/prompt.js'
import {
  MEMORY_HEADER_PREFIX,
  MEMORY_SECTIONS,
  readProfile,
  renderProfileSections,
  UNRESOLVED_TITLE,
  type ProfileSections,
} from '../../plugins/memory/prompt.js'

const KEY = 'deepseek-api-chat:memory-profile'

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** 读当前档案；没有或坏数据时给一份空档案 */
export const readMemoryProfile = (): MemoryProfile => {
  try {
    return readProfile(JSON.parse(read() ?? '{}'))
  } catch {
    return readProfile(undefined)
  }
}

/** 写档案；只写三段 + 未解决清单 + 更新时间与已看轮数 */
export const writeMemoryProfile = (profile: MemoryProfile): void => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        identity: profile.identity,
        preferences: profile.preferences,
        ongoing: profile.ongoing,
        unresolved: profile.unresolved,
        updatedAt: profile.updatedAt,
        turnsSeen: profile.turnsSeen,
      })
    )
  } catch {
    // 存储不可用（隐私模式 / 配额满）时静默跳过：记忆最坏只是这一轮没注入
  }
}

const SECTION_TITLES: ReadonlyArray<string> = MEMORY_SECTIONS.map((section) => section.title)

/** 注入文本结尾的相对时间那一行：粘整段回来时剥掉，避免写进档案 */
const FOOTER = '档案更新于'

/**
 * 把设置页文本框里的内容解析成三段落。
 *
 * 认三个段标题；标题之前的自由文本算「我是谁」，这样直接粘一段自我介绍也能用。
 * 认不出的行归当前段，不丢用户输入。
 */
export const parseProfileText = (text: string): ProfileSections => {
  const sections: Record<string, string[]> = {
    identity: [],
    preferences: [],
    ongoing: [],
    unresolved: [],
  }
  let current: 'identity' | 'preferences' | 'ongoing' | 'unresolved' = 'identity'
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith(MEMORY_HEADER_PREFIX) || line.startsWith(FOOTER)) {
      continue
    }
    if (line === UNRESOLVED_TITLE) {
      current = 'unresolved'
      continue
    }
    const index = SECTION_TITLES.indexOf(line)
    if (index >= 0) {
      current = MEMORY_SECTIONS[index].key
      continue
    }
    if (current === 'unresolved' && line.startsWith('- ')) {
      sections.unresolved.push(line.slice(2).trim())
      continue
    }
    sections[current].push(raw)
  }
  const join = (lines: string[]): string => lines.join('\n').trim()
  return {
    identity: join(sections.identity),
    preferences: join(sections.preferences),
    ongoing: join(sections.ongoing),
    unresolved: sections.unresolved.filter((line) => line.length > 0),
  }
}

/** 反向：把档案渲染成设置页文本框里的形状，与注入文本同一套标题 */
export const renderProfileText = (profile: ProfileSections): string =>
  renderProfileSections(profile)

/**
 * 把 Profile 塞进插件状态。
 *
 * 插件只拿得到 pluginSettings，所以宿主在组装请求前同步读一次档案挂到 memory.config 上。
 * 不改入参、不打开关：开关没开时原样返回（也不读存储），档案不该成为「隐式启用」。
 * profile 参数只为测试注入，生产调用只传 states。
 */
export const withMemoryProfile = (
  states: Readonly<Record<string, PluginState>>,
  profile?: MemoryProfile
): Readonly<Record<string, PluginState>> => {
  if (states.memory?.enabled !== true) {
    return states
  }
  const current = profile ?? readMemoryProfile()
  // 「现在」也由宿主给：插件不自己取时钟，同样的档案与时刻必须拼出同样的文本
  return { ...states, memory: { ...states.memory, config: { ...current, now: Date.now() } } }
}
