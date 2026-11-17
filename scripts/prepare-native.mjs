import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const androidManifest = 'android/app/src/main/AndroidManifest.xml'
// RECORD_AUDIO：麦克风录音；MODIFY_AUDIO_SETTINGS：Capacitor 处理 WebView 的
// AUDIO_CAPTURE 权限请求时会一并申请，缺了它 request.grant 永远不会发生，
// getUserMedia 会一直报 NotAllowedError（即使系统设置里已允许麦克风）。
const androidPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
]

if (existsSync(androidManifest)) {
  let source = readFileSync(androidManifest, 'utf8')
  for (const permission of androidPermissions) {
    if (source.includes(permission)) {
      continue
    }
    source = source.replace(
      /(\s*)<application/,
      (_match, whitespace) => `${whitespace}<uses-permission android:name="${permission}" />${whitespace}<application`
    )
  }
  writeFileSync(androidManifest, source)
}

const androidIcons = 'src-tauri/icons/android'
const androidRes = 'android/app/src/main/res'

if (existsSync(androidIcons) && existsSync(androidRes)) {
  cpSync(androidIcons, androidRes, { recursive: true })
}
