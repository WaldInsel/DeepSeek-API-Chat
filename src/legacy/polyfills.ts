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
if (!('toReversed' in Array.prototype)) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value<T>(this: T[]): T[] {
      return this.slice().reverse()
    },
    configurable: true,
    writable: true,
  })
}

if (!('toSorted' in Array.prototype)) {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value<T>(this: T[], compareFn?: (a: T, b: T) => number): T[] {
      return this.slice().sort(compareFn)
    },
    configurable: true,
    writable: true,
  })
}

const createAbortError = () =>
  typeof DOMException === 'function'
    ? new DOMException('This operation was aborted', 'AbortError')
    : Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })

if (!('reason' in AbortSignal.prototype)) {
  Object.defineProperty(AbortSignal.prototype, 'reason', {
    get(this: AbortSignal): unknown {
      return this.aborted ? createAbortError() : undefined
    },
    configurable: true,
  })
}

if (!('throwIfAborted' in AbortSignal.prototype)) {
  Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', {
    value(this: AbortSignal): void {
      if (this.aborted) {
        throw this.reason ?? createAbortError()
      }
    },
    configurable: true,
    writable: true,
  })
}

if (!('arrayBuffer' in Blob.prototype)) {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    value(this: Blob): Promise<ArrayBuffer> {
      return new Response(this).arrayBuffer()
    },
    configurable: true,
    writable: true,
  })
}

if (!('text' in Blob.prototype)) {
  Object.defineProperty(Blob.prototype, 'text', {
    value(this: Blob): Promise<string> {
      return new Response(this).text()
    },
    configurable: true,
    writable: true,
  })
}
// location.ts 在模块顶层构造 DisplayNames，缺失会让首屏直接白屏
if (typeof (Intl as unknown as { DisplayNames?: unknown }).DisplayNames !== 'function') {
  class DisplayNamesPolyfill {
    of(code: string): string {
      return code
    }
  }
  Object.defineProperty(Intl, 'DisplayNames', {
    value: DisplayNamesPolyfill,
    configurable: true,
    writable: true,
  })
}

if (typeof queueMicrotask !== 'function') {
  Object.defineProperty(window, 'queueMicrotask', {
    value(callback: () => void): void {
      Promise.resolve().then(callback)
    },
    configurable: true,
    writable: true,
  })
}
