import { translate, type TranslationKey } from '../../../i18n/index.js'

/** 分享链接导入失败的原因，key 对应界面提示文案。 */
export class ShareError extends Error {
  constructor(readonly key: TranslationKey) {
    super(translate(key))
    this.name = 'ShareError'
  }
}

export const failShare = (key: TranslationKey): never => {
  throw new ShareError(key)
}