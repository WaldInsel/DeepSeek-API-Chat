import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

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

const androidIcons = 'src-tauri/icons/android'
const androidRes = 'android/app/src/main/res'

if (existsSync(androidIcons) && existsSync(androidRes)) {
  cpSync(androidIcons, androidRes, { recursive: true })
}
