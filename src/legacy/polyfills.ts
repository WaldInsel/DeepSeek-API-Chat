/**
 * 旧版系统 WebView 兼容层，仅由 legacy 构建在入口前置加载。
 * 覆盖 Android 9 出厂内核（Chrome 69）缺失的标准 API。
 */

if (typeof (Object as unknown as { hasOwn?: unknown }).hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value(target: object, property: PropertyKey): boolean {
      return Object.prototype.hasOwnProperty.call(target, property)
    },
    configurable: true,
    writable: true,
  })
}

if (!('at' in Array.prototype)) {
  Object.defineProperty(Array.prototype, 'at', {
    value<T>(this: T[], index: number): T | undefined {
      const length = this.length
      let position = Math.trunc(index) || 0
      if (position < 0) {
        position += length
      }
      return position < 0 || position >= length ? undefined : this[position]
    },
    configurable: true,
    writable: true,
  })
}

if (!('at' in String.prototype)) {
  Object.defineProperty(String.prototype, 'at', {
    value(this: string, index: number): string | undefined {
      const length = this.length
      let position = Math.trunc(index) || 0
      if (position < 0) {
        position += length
      }
      return position < 0 || position >= length ? undefined : this[position]
    },
    configurable: true,
    writable: true,
  })
}

if (typeof (Object as unknown as { fromEntries?: unknown }).fromEntries !== 'function') {
  Object.defineProperty(Object, 'fromEntries', {
    value(entries: Iterable<readonly [PropertyKey, unknown]>): Record<PropertyKey, unknown> {
      const result: Record<PropertyKey, unknown> = {}
      for (const [key, value] of entries) {
        result[key] = value
      }
      return result
    },
    configurable: true,
    writable: true,
  })
}

if (!('allSettled' in Promise)) {
  Object.defineProperty(Promise, 'allSettled', {
    value<T>(values: Iterable<T | PromiseLike<T>>) {
      return Promise.all(
        Array.from(values, (item) =>
          Promise.resolve(item).then(
            (value) => ({ status: 'fulfilled' as const, value }),
            (reason: unknown) => ({ status: 'rejected' as const, reason })
          )
        )
      )
    },
    configurable: true,
    writable: true,
  })
}

if (!('replaceAll' in String.prototype)) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value(this: string, search: string, replacement: string): string {
      return this.split(search).join(replacement)
    },
    configurable: true,
    writable: true,
  })
}
