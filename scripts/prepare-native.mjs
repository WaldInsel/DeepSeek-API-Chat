import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const androidManifest = 'android/app/src/main/AndroidManifest.xml'
const recordAudio = '<uses-permission android:name="android.permission.RECORD_AUDIO" />'

if (existsSync(androidManifest)) {
  const source = readFileSync(androidManifest, 'utf8')
  if (!source.includes('android.permission.RECORD_AUDIO')) {
    const patched = source.replace(
      /(\s*)<application/,
      (_match, whitespace) => `${whitespace}${recordAudio}${whitespace}<application`
    )
    writeFileSync(androidManifest, patched)
  }
}

const infoPlist = 'ios/App/App/Info.plist'
const microphoneKey = 'NSMicrophoneUsageDescription'

if (existsSync(infoPlist)) {
  const source = readFileSync(infoPlist, 'utf8')
  if (!source.includes(microphoneKey)) {
    const entry = `\t<key>${microphoneKey}</key>\n\t<string>语音输入需要访问麦克风，录音会发送到配置的语音识别服务。</string>\n`
    const patched = source.replace(/<\/dict>(\s*)<\/plist>/, `${entry}</dict>$1</plist>`)
    writeFileSync(infoPlist, patched)
  }
}