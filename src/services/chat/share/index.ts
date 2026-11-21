import { isWebApp } from '../../../app/platform.js'
import { createId } from '../../../utils/id.js'
import { BackupError } from '../history/errors.js'
import { toLocalSession } from '../history/toLocal.js'
import type { Session } from '../types.js'
import { failShare } from './errors.js'
import { requestShareContent } from './request.js'
import { toSessionFile } from './schema.js'
import { parseShareId } from './url.js'

/**
 * 读取分享链接并转换成一条本地会话。
 * 复用归档解析：分享数据先映射成 SessionFile，再交给 toLocalSession。
 */
export const importSharedChat = async (input: string): Promise<Session> => {
  if (isWebApp()) {
    return failShare('shareImportWebUnsupported')
  }
  const shareId = parseShareId(input) ?? failShare('shareImportInvalidUrl')
  const payload = await requestShareContent(shareId)
  const file = toSessionFile(payload, createId())
  try {
    return toLocalSession(file).session
  } catch (error) {
    if (error instanceof BackupError) {
      failShare('shareImportInvalidData')
    }
    throw error
  }
}