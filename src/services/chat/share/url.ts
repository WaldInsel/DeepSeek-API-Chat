/** 分享链接只接受 chat.deepseek.com/share/<id>，其余站点不交给网络层。 */
const SHARE_URL = /^https?:\/\/(?:www\.)?chat\.deepseek\.com\/share\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/

export const parseShareId = (input: string): string | null => {
  const match = SHARE_URL.exec(input.trim())
  return match ? match[1] : null
}