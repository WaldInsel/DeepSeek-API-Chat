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
// 所以由原生读出 WindowInsets，通过 SystemBars 接口和 window.__applySystemInsets 下发。
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
  private int imeBottom = 0;
  private int imeInset = 0;
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
      webView.postDelayed(this::dispatchInsets, 1000);
    }

    View decorView = window.getDecorView();
    // 老系统（API 30 以下）拿不到 ime insets，靠布局变化和可见区域兜底判断键盘高度
    decorView
        .getViewTreeObserver()
        .addOnGlobalLayoutListener(() -> refreshKeyboardHeight(false));

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
          imeInset = toCssPixels(insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
          refreshKeyboardHeight(systemBarsChanged);
          return insets;
        });
  }

  /** BridgeActivity 里的 onResume 是 public，重写时不能收窄访问级别。 */
  @Override
  public void onResume() {
    super.onResume();
    // 从后台回来时视口可能变了（分屏、旋转），补发一次
    dispatchInsets();
  }

  /** 物理像素换算成页面用的 CSS 像素（等于 dp）。 */
  private int toCssPixels(int pixels) {
    return Math.round(pixels / getResources().getDisplayMetrics().density);
  }

  /**
   * 页面需要额外让出的键盘高度。Android 11+ 直接读 ime insets；更老的系统
   * 以及部分把键盘交给系统处理的 ROM（oppo / vivo / 华为）拿不到 ime insets，
   * 改用「根视图高度 - 可见区域底边」兜底，两条路取较大值。
   * 窗口已经被输入法 resize 时根视图本身变矮，这里算出的值接近 0，
   * 页面高度由 100dvh 自动跟随，不会重复扣减。
   */
  private void refreshKeyboardHeight(boolean force) {
    View decorView = getWindow().getDecorView();
    decorView.getWindowVisibleDisplayFrame(visibleFrame);
    int hidden = Math.max(0, decorView.getRootView().getHeight() - visibleFrame.bottom);
    int keyboard = Math.max(imeInset, toCssPixels(hidden));
    if (force || keyboard != imeBottom) {
      imeBottom = keyboard;
      dispatchInsets();
    }
  }

  private void dispatchInsets() {
    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView == null) {
      return;
    }
    String script =
        "window.__applySystemInsets&&window.__applySystemInsets("
            + safeTop
            + ", "
            + safeBottom
            + ", "
            + imeBottom
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
          + safeBottom
          + ",\\"ime\\":"
          + imeBottom

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
