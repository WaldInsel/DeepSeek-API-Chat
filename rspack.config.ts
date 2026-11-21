import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rspack/cli'
import { rspack, type Configuration } from '@rspack/core'

const dev = process.env.NODE_ENV
  ? process.env.NODE_ENV !== 'production'
  : process.argv.includes('serve')
/** 标准构建目标：网页、桌面端与常规 Android 包 */
const modernTargets = ['chrome >= 105', 'edge >= 105', 'safari >= 16', 'firefox >= 110']
/** 低内核兼容目标：覆盖 Android 9 出厂系统 WebView */
const legacyTargets = ['chrome >= 69']
const root = path.dirname(fileURLToPath(import.meta.url))
/** 站点图标源目录，构建时复制到 dist 根目录 */
const webIcons = path.join(root, 'assets/web')
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

type ConfigOptions = {
  /** 公开 API 的地址，注入为 __API_ORIGIN__ */
  apiOrigin?: string
  /** 开发服务器配置，支持本地接口代理 */
  devServer?: Configuration['devServer']
  /** 生成旧版系统 WebView 可解析的产物，依赖也一并降级 */
  legacy?: boolean
}

/** 创建构建配置，支持自定义 API 地址和开发服务器选项 */
export const createConfig = ({
  apiOrigin = 'https://api.deepseek.com',
  devServer,
  legacy = false,
}: ConfigOptions = {}): Configuration => {
  const targets = legacy ? legacyTargets : modernTargets
  const cssLoader = {
    loader: 'builtin:lightningcss-loader',
    options: { targets },
  }

  return {
    mode: dev ? 'development' : 'production',
    entry: legacy ? ['./src/legacy/polyfills.ts', './src/main.tsx'] : './src/main.tsx',
    output: {
      path: path.resolve(root, 'dist'),
      // 运行时按当前脚本地址推导资源路径，file:// 下异步 chunk、字体都按相对位置加载
      publicPath: 'auto',
      filename: 'static/js/[name].[contenthash:8].js',
      chunkFilename: 'static/js/async/[name].[contenthash:8].js',
      cssFilename: 'static/css/[name].[contenthash:8].css',
      cssChunkFilename: 'static/css/async/[name].[contenthash:8].css',
      assetModuleFilename: 'static/media/[name].[contenthash:8][ext]',
      clean: true,
    },
    devtool: dev ? 'cheap-module-source-map' : false,
    // 开发模式预编译异步模块，保持首次加载代码高亮和公式时的页面状态
    lazyCompilation: false,
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      // 将 .js 导入路径解析到同名 .ts、.tsx 或 .js 文件
      extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
    },
    module: {
      // CSS Modules 使用默认导出：`import styles from './x.module.css'`
      parser: { 'css/module': { namedExports: false } },
      generator: { 'css/module': { localIdentName: '[local]-[hash:6]' } },
      rules: [
        { test: /\.module\.css$/, type: 'css/module', use: [cssLoader] },
        { test: /\.css$/, exclude: /\.module\.css$/, type: 'css', use: [cssLoader] },
        {
          test: /\.(j|t)sx?$/,
          exclude: /[\\/]node_modules[\\/]/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic', development: dev } },
              externalHelpers: true,
            },
            env: { targets },
          },
          type: 'javascript/auto',
        },
        // 旧内核构建时把依赖里的可选链、空值合并等语法一并降级，避免异步 chunk 直接解析失败
        ...(legacy
          ? [
              {
                test: /\.m?js$/,
                include: /[\\/]node_modules[\\/]/,
                loader: 'builtin:swc-loader',
                options: {
                  jsc: { parser: { syntax: 'ecmascript' }, externalHelpers: true },
                  env: { targets },
                },
                type: 'javascript/auto' as const,
              },
            ]
          : []),
        { test: /\.(woff2?|ttf)$/, type: 'asset/resource' },
      ],
    },
    plugins: [
      // 经典 defer 脚本支持 file:// 页面的资源加载
      new rspack.HtmlRspackPlugin({
        template: './src/index.html',
        scriptLoading: 'defer',
        meta: {
          'application-version': version,
          ...(legacy ? { 'application-variant': 'legacy' } : {}),
        },
      }),
      new rspack.DefinePlugin({ __API_ORIGIN__: JSON.stringify(apiOrigin) }),
      new rspack.CopyRspackPlugin({
        patterns: [
          { from: path.resolve(root, 'LICENSE'), to: 'LICENSE', toType: 'file' },
          // 站点图标放在 dist 根目录，file:// 下也能按相对路径加载
          { from: path.join(webIcons, 'favicon.svg'), to: 'favicon.svg' },
          { from: path.join(webIcons, 'apple-touch-icon.png'), to: 'apple-touch-icon.png' },
        ],
      }),
    ],
    performance: { hints: false },
    devServer: { port: 8090, ...devServer },
  }
}

// eslint-disable-next-line import/no-default-export
export default defineConfig((env: Record<string, unknown> = {}) =>
  createConfig({ legacy: env.legacy === true || env.legacy === 'true' })
)
