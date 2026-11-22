import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const plistPath = 'ios/App/App/Info.plist'

if (existsSync(plistPath)) {
  let plist = readFileSync(plistPath, 'utf8')
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

  const parts = String(version)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const shortVersion = parts.slice(0, 3).join('.')
  const buildVersion = String((parts[0] ?? 0) * 10000 + (parts[1] ?? 0) * 100 + (parts[2] ?? 0))

  plist = plist.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${shortVersion}$2`
  )
  plist = plist.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${buildVersion}$2`
  )

  const microphoneKey = 'NSMicrophoneUsageDescription'

  if (!plist.includes(microphoneKey)) {
    const before = plist
    plist = plist.replace(
      /([\t ]*)<\/dict>(\r?\n)<\/plist>/,
      (_match, indent, newline) =>
        `${indent}<key>${microphoneKey}</key>${newline}${indent}<string>用于语音输入和录音</string>${newline}${indent}</dict>${newline}</plist>`
    )
    if (plist === before) {
      throw new Error('iOS Info.plist: failed to add microphone usage description')
    }
  }

  writeFileSync(plistPath, plist)

  if (process.env.GITHUB_ENV) {
    appendFileSync(
      process.env.GITHUB_ENV,
      `IOS_SHORT_VERSION=${shortVersion}\nIOS_BUILD_VERSION=${buildVersion}\n`
    )
  }
}

const appIconSource = 'assets/icon-ios.png'
const appIconDir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'

if (existsSync(appIconDir)) {
  if (!existsSync(appIconSource)) {
    throw new Error(`iOS app icon source not found: ${appIconSource}`)
  }

  copyFileSync(appIconSource, `${appIconDir}/AppIcon-512@2x.png`)

  const contentsPath = `${appIconDir}/Contents.json`

  if (!existsSync(contentsPath)) {
    writeFileSync(
      contentsPath,
      `${JSON.stringify(
        {
          images: [
            {
              filename: 'AppIcon-512@2x.png',
              idiom: 'universal',
              platform: 'ios',
              size: '1024x1024',
            },
          ],
          info: { author: 'xcode', version: 1 },
        },
        null,
        2
      )}\n`
    )
  }
} else if (existsSync('ios')) {
  throw new Error(`iOS app icon set not found: ${appIconDir}`)
}
