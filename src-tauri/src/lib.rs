#[cfg(target_os = "linux")]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .on_permission_request(|_webview, kind| {
            // WebKitGTK 没有系统授权弹窗，麦克风请求直接放行；
            // Windows/macOS 保持 Default，继续由系统弹出权限提示。
            #[cfg(target_os = "linux")]
            {
                if matches!(kind, tauri::webview::PermissionKind::Microphone) {
                    return tauri::webview::PermissionResponse::Allow;
                }
            }
            #[cfg(not(target_os = "linux"))]
            let _ = kind;
            tauri::webview::PermissionResponse::Default
        })
        .setup(|app| {
            // WebKitGTK 的 getUserMedia 依赖 enable-media-stream，默认是关闭的。
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{SettingsExt, WebViewExt};

                if let Some(window) = app.get_webview_window("main") {
                    window.with_webview(|webview| {
                        let view = webview.inner();
                        if let Some(settings) = view.settings() {
                            settings.set_enable_media_stream(true);
                            settings.set_enable_webrtc(true);
                        }
                    })?;
                }
            }
            #[cfg(not(target_os = "linux"))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
