type MarkdownToken = {
  type: string
  raw?: string
  text?: string
  href?: string
  title?: string | null
  tokens?: MarkdownToken[]
}

type MarkdownRendererContext = {
  parser: { parseInline(tokens: MarkdownToken[]): string }
}

type MarkdownRenderer = {
  html?: (this: MarkdownRendererContext, token: MarkdownToken) => string
  link?: (this: MarkdownRendererContext, token: MarkdownToken) => string
  image?: (this: MarkdownRendererContext, token: MarkdownToken) => string
}

type MarkdownOptions = {
  gfm?: boolean
  breaks?: boolean
  renderer?: MarkdownRenderer
}

type MarkedApi = {
  parse: (source: string, options?: MarkdownOptions) => string
  use: (options: MarkdownOptions | MarkdownOptions[]) => void
  setOptions: (options: MarkdownOptions) => void
}

declare const marked: MarkedApi

export = marked
