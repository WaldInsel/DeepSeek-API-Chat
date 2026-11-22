import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 只跑 src 下的单元测试；浏览器/DOM 相关代码不在这里测，走 dev server 实点
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // 不引入 globals：测试文件显式 import { describe, it, expect }，
    // 这样 tsc 不需要额外 types，也不必改 tsconfig
    globals: false,
  },
})
