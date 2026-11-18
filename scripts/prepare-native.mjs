import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

// 全面屏适配：声明应用自己处理状态栏与手势条，并把真实安全区交给页面。
// WebView 的 env(safe-area-inset-*) 在安卓上大多返回 0（尤其是底部导航栏），
// 所以由原生读出 WindowInsets，通过 SystemBars 接口和 window.__applySystemLayout 下发。
const mainActivitySource = (packageName) => `package ${packageName};

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 全面屏适配：状态栏与导航栏全透明、页面铺满整屏，
 * 安全区尺寸由页面自己读取，页面底部抬高、顶部压低。
 */
public class MainActivity extends BridgeActivity {

  private int safeTop = 0;
  private int safeBottom = 0;
  private int pageSafeBottom = 0;
  private int frameHeight = 0;
  private int imeInsetPx = 0;
  private final Rect visibleFrame = new Rect();

  @Override
  @SuppressWarnings("deprecation")
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(Color.TRANSPARENT);
    window.setNavigationBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams attributes = window.getAttributes();
      attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      window.setAttributes(attributes);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // 去掉手势条后面的半透明遮罩，页面底色才能连成一片
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }
    // 显式声明 adjustResize：清单里不写时系统可能挑 adjustPan，
    // 那样窗口不 resize，ime insets 也不会派发（vivo / OPPO 上就是这样）。
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView != null) {
      webView.addJavascriptInterface(new SystemBars(), "SystemBars");
      // 首次布局时页面还没就绪，补发一次
      webView.postDelayed(this::dispatchLayout, 1000);
    }

    View decorView = window.getDecorView();
    // 老系统（API 30 以下）拿不到 ime insets，靠布局变化和可见区域兜底判断键盘
    decorView
        .getViewTreeObserver()
        .addOnGlobalLayoutListener(() -> refreshLayout(false));

    ViewCompat.setOnApplyWindowInsetsListener(
        decorView,
        (view, insets) -> {
          int top =
              toCssPixels(
                  insets
                      .getInsets(
                          WindowInsetsCompat.Type.systemBars()
                              | WindowInsetsCompat.Type.displayCutout())
                      .top);
          int bottom = toCssPixels(insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom);
          boolean systemBarsChanged = top != safeTop || bottom != safeBottom;
          safeTop = top;
          safeBottom = bottom;
          imeInsetPx = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
          refreshLayout(systemBarsChanged);
          return insets;
        });
  }

  /** BridgeActivity 里的 onResume 是 public，重写时不能收窄访问级别。 */
  @Override
  public void onResume() {
    super.onResume();
    // 从后台回来时视口可能变了（分屏、旋转），补发一次
    refreshLayout(true);
  }

  /**
   * 系统返回键 / 返回手势：先让页面按「设置 → 搜索结果 → 对话列表」逐层关闭，
   * 页面返回 false（已经回到主界面）才退出应用。
   */
  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView == null) {
      super.onBackPressed();
      return;
    }
    webView.evaluateJavascript(
        "window.__handleSystemBack?window.__handleSystemBack():false",
        handled -> {
          if (!"true".equals(handled)) {
            runOnUiThread(this::exitApp);
          }
        });
  }

  private void exitApp() {
    super.onBackPressed();
  }

  /** 物理像素换算成页面用的 CSS 像素（等于 dp）。 */
  private int toCssPixels(int pixels) {
    return Math.round(pixels / getResources().getDisplayMetrics().density);
  }

  private int dpToPx(int dp) {
    return Math.round(dp * getResources().getDisplayMetrics().density);
  }

  /**
   * 直接把「页面应该显示多高」算好下发，页面不用再拿 100dvh 做减法。
   * 键盘高度优先读 ime insets（Android 11+）；更老的系统以及把键盘交给
   * 系统处理的 ROM（oppo / vivo / 华为）拿不到 ime insets，用「根视图高度 -
   * 可见区域底边」兜底，两条路取较大值。不足 120dp 的变化不算键盘，
   * 避免导航栏、手势条的高度被误判成键盘，把页面永久砍掉一截。
   */
  private void refreshLayout(boolean force) {
    View decorView = getWindow().getDecorView();
    decorView.getWindowVisibleDisplayFrame(visibleFrame);
    int rootPx = decorView.getRootView().getHeight();
    int measuredPx = visibleFrame.bottom > 0 ? Math.max(0, rootPx - visibleFrame.bottom) : 0;
    // 窗口已经被输入法 resize 时可见区域跟着缩，measuredPx 接近 0；
    // 个别 ROM 仍会同时派发 ime insets，这时以「窗口已缩」为准，避免页面扣两次。
    int screenPx = getResources().getDisplayMetrics().heightPixels;
    boolean windowShrunk = screenPx - rootPx >= dpToPx(120);
    boolean resizedWithIme =
        measuredPx == 0 && imeInsetPx >= dpToPx(120) && windowShrunk;
    int keyboardPx = resizedWithIme ? 0 : Math.max(measuredPx, imeInsetPx);
    boolean keyboardVisible = keyboardPx >= dpToPx(120);

    // 键盘收起时按整屏高度铺满，保证内容延伸到屏幕底端（含小白条区域）；
    // 分屏、自由窗口下窗口本身比屏幕小，仍然用根视图高度。
    int restFramePx = windowShrunk ? rootPx : Math.max(rootPx, screenPx);
    int nextFrame =
        toCssPixels(keyboardVisible ? Math.max(0, rootPx - keyboardPx) : restFramePx);
    // 键盘弹出时导航栏被键盘盖住，页面不用再给它留白；收起时恢复，
    // 输入框停在小白条上方，背景一直铺到屏幕底端。
    int nextSafeBottom = keyboardVisible ? 0 : safeBottom;
    if (force || nextFrame != frameHeight || nextSafeBottom != pageSafeBottom) {
      frameHeight = nextFrame;
      pageSafeBottom = nextSafeBottom;
      dispatchLayout();
    }
  }

  private void dispatchLayout() {
    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView == null) {
      return;
    }
    String script =
        "window.__applySystemLayout&&window.__applySystemLayout("
            + safeTop
            + ", "
            + pageSafeBottom
            + ", "
            + frameHeight
            + ")";
    webView.post(() -> webView.evaluateJavascript(script, null));
  }

  private void applyIconTheme(boolean dark) {
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.setAppearanceLightStatusBars(!dark);
    controller.setAppearanceLightNavigationBars(!dark);
  }

  /** 页面通过 window.SystemBars 读取安全区、同步系统栏图标明暗。 */
  public class SystemBars {

    @JavascriptInterface
    public String getInsets() {
      return "{\\"top\\":"
          + safeTop
          + ",\\"bottom\\":"
          + pageSafeBottom
          + ",\\"frame\\":"
          + frameHeight
          + "}";
    }

    @JavascriptInterface
    public void setDarkIcons(boolean dark) {
      runOnUiThread(() -> applyIconTheme(dark));
    }

    /** 页面里 window.open 打不开外部链接，交给系统浏览器 */
    @JavascriptInterface
    public void openExternal(String url) {
      runOnUiThread(
          () -> {
            try {
              Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
              intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
              startActivity(intent);
            } catch (Exception ignored) {
              // 没有能处理该链接的应用时保持安静
            }
          });
    }
  }
}
`

const androidBuildGradle = 'android/app/build.gradle'

if (existsSync(androidBuildGradle)) {
  const gradle = readFileSync(androidBuildGradle, 'utf8')
  const packageName = /namespace\s+["']([^"']+)["']/.exec(gradle)?.[1]
  if (packageName) {
    const activityDir = join('android/app/src/main/java', ...packageName.split('.'))
    mkdirSync(activityDir, { recursive: true })
    writeFileSync(join(activityDir, 'MainActivity.java'), mainActivitySource(packageName))
  }
}

// 版本号统一从 package.json 取：安卓的 versionName/versionCode 由这里写入，
// 桌面端 Tauri 的 version 字段本来就指向 package.json。
const packageJsonPath = 'package.json'

if (existsSync(androidBuildGradle) && existsSync(packageJsonPath)) {
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (version) {
    const [major, minor, patch] = String(version)
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
    const versionCode = major * 10000 + (minor ?? 0) * 100 + (patch ?? 0)
    const gradle = readFileSync(androidBuildGradle, 'utf8')
    const patched = gradle
      .replace(/versionCode \d+/, `versionCode ${versionCode}`)
      .replace(/versionName "[^"]*"/, `versionName "${version}"`)
    if (patched !== gradle) {
      writeFileSync(androidBuildGradle, patched)
    }
  }
}

// 发布签名：android/ 不入库，签名配置只能在工程生成之后补进去。
// keystore 由 workflow 解码到 android/app/release.keystore，密码走环境变量；
// 三者缺一就不注入，release 包保持未签名，不影响其它构建。
const releaseKeystore = 'android/app/release.keystore'
// PKCS12 不支持「库密码 != 密钥密码」，keyPassword 缺省时复用 store 密码
const signingEnvKeys = ['ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS']

if (
  existsSync(androidBuildGradle) &&
  existsSync(releaseKeystore) &&
  signingEnvKeys.every((key) => process.env[key])
) {
  const gradle = readFileSync(androidBuildGradle, 'utf8')
  if (!gradle.includes('signingConfigs.release')) {
    appendFileSync(
      androidBuildGradle,
      `
// 发布签名（由 scripts/prepare-native.mjs 注入）
android {
  signingConfigs {
    release {
      storeFile file("release.keystore")
      storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
      keyAlias System.getenv("ANDROID_KEY_ALIAS")
      keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
`
    )
  }
}
