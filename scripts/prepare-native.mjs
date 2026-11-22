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
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.util.List;

/**
 * 全面屏适配：状态栏与导航栏全透明、页面铺满整屏，
 * 安全区尺寸由页面自己读取，页面底部抬高、顶部压低。
 */
public class MainActivity extends BridgeActivity {

  private int safeTop = 0;
  private int safeBottom = 0;
  private int pageSafeBottom = 0;
  private View contentChild;
  private FrameLayout.LayoutParams contentChildParams;
  private int usableHeightPrevious = 0;
  private final Rect visibleRect = new Rect();

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
    // 不要声明 adjustResize：全屏（decorFitsSystemWindows=false）下它会被部分 ROM
    // 当成“系统自己处理键盘”，既不 resize WebView 也不派发 ime insets。
    // 键盘改由下面手动 resize WebView 容器（Capacitor Keyboard 插件同款做法）。

    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView != null) {
      webView.addJavascriptInterface(new SystemBars(), "SystemBars");
      webView.getSettings().setSupportZoom(false);
      webView.getSettings().setBuiltInZoomControls(false);
      webView.getSettings().setDisplayZoomControls(false);
      // 跟随系统「字体大小」；WebView 自己默认固定在 100%
      webView
          .getSettings()
          .setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
      // 首次布局时页面还没就绪，补发一次
      webView.postDelayed(this::dispatchLayout, 1000);
    }

    FrameLayout content = (FrameLayout) window.getDecorView().findViewById(android.R.id.content);
    contentChild = content.getChildAt(0);
    if (contentChild != null) {
      contentChildParams = (FrameLayout.LayoutParams) contentChild.getLayoutParams();
      // 老系统拿不到 ime insets，靠可见区域变化兜底（Capacitor Keyboard 插件同款思路）
      contentChild.getViewTreeObserver().addOnGlobalLayoutListener(this::refreshKeyboard);
    }

    ViewCompat.setOnApplyWindowInsetsListener(
        content,
        (view, insets) -> {
          safeTop =
              toCssPixels(
                  insets
                      .getInsets(
                          WindowInsetsCompat.Type.systemBars()
                              | WindowInsetsCompat.Type.displayCutout())
                      .top);
          safeBottom = toCssPixels(insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom);
          refreshKeyboard();
          view.onApplyWindowInsets(insets.toWindowInsets());
          return insets;
        });

    ViewCompat.setWindowInsetsAnimationCallback(
        content.getRootView(),
        new WindowInsetsAnimationCompat.Callback(
            WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
          @NonNull
          @Override
          public WindowInsetsCompat onProgress(
              @NonNull WindowInsetsCompat insets,
              @NonNull List<WindowInsetsAnimationCompat> runningAnimations) {
            return insets;
          }

          @NonNull
          @Override
          public WindowInsetsAnimationCompat.BoundsCompat onStart(
              @NonNull WindowInsetsAnimationCompat animation,
              @NonNull WindowInsetsAnimationCompat.BoundsCompat bounds) {
            refreshKeyboard();
            return super.onStart(animation, bounds);
          }

          @Override
          public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
            super.onEnd(animation);
            refreshKeyboard();
          }
        });
  }

  /** BridgeActivity 里的 onResume 是 public，重写时不能收窄访问级别。 */
  @Override
  public void onResume() {
    super.onResume();
    // 从后台回来时视口可能变了（分屏、旋转），重新对齐一次
    refreshKeyboard();
    dispatchLayout();
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
   * 全屏下 Android 不会自动 resize WebView（Capacitor Keyboard 插件注释里的已知 bug），
   * 这里手动把 WebView 容器的高度改成键盘顶部；键盘收起时恢复 MATCH_PARENT。
   * 页面因此不需要拿 100dvh 或 insets 做任何减法，内容位置和 WebView 完全一致。
   */
  private void refreshKeyboard() {
    if (contentChild == null || contentChildParams == null) {
      return;
    }
    contentChild.getWindowVisibleDisplayFrame(visibleRect);
    int rootHeight = contentChild.getRootView().getHeight();
    int covered = Math.max(0, rootHeight - visibleRect.bottom);
    // 导航栏、手势条只有几十 dp，忽略它们，只把真正的键盘当作键盘
    boolean keyboardShown = covered >= dpToPx(120);
    int nextHeight = keyboardShown ? visibleRect.bottom : FrameLayout.LayoutParams.MATCH_PARENT;
    int nextSafeBottom = keyboardShown ? 0 : safeBottom;
    if (nextHeight == usableHeightPrevious && nextSafeBottom == pageSafeBottom) {
      return;
    }
    usableHeightPrevious = nextHeight;
    pageSafeBottom = nextSafeBottom;
    contentChildParams.height = nextHeight;
    contentChild.requestLayout();
    dispatchLayout();
  }

  private void dispatchLayout() {
    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView == null) {
      return;
    }
    int fontWeightAdjustment = 0;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      int value = getResources().getConfiguration().fontWeightAdjustment;
      // FONT_WEIGHT_ADJUSTMENT_UNDEFINED 的取值是 Integer.MAX_VALUE
      if (value != Integer.MAX_VALUE) {
        fontWeightAdjustment = value;
      }
    }
    String script =
        "window.__applySystemInsets&&window.__applySystemInsets("
            + safeTop
            + ", "
            + pageSafeBottom
            + ");"
            + "window.__applyFontWeight&&window.__applyFontWeight("
            + fontWeightAdjustment
            + ")";
    webView.post(() -> webView.evaluateJavascript(script, null));
  }

  /** 系统里没有能打开该文件的应用时通知页面，用页面语言提示 */
  private void notifyFileOpenFailed() {
    WebView webView = getBridge() == null ? null : getBridge().getWebView();
    if (webView == null) {
      return;
    }
    webView.post(
        () ->
            webView.evaluateJavascript(
                "window.__fileOpenFailed&&window.__fileOpenFailed()", null));
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

    /** 把缓存里的附件交给系统默认应用打开（Word、WPS、PDF 阅读器等） */
    @JavascriptInterface
    public void openFile(String uri, String mimeType) {
      runOnUiThread(
          () -> {
            try {
              Uri parsed = Uri.parse(uri);
              Uri target = parsed;
              if ("file".equals(parsed.getScheme())) {
                File file = new File(parsed.getPath());
                target =
                    FileProvider.getUriForFile(
                        MainActivity.this, getPackageName() + ".fileprovider", file);
              }
              Intent intent = new Intent(Intent.ACTION_VIEW);
              intent.setDataAndType(target, mimeType);
              intent.addFlags(
                  Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
              startActivity(intent);
            } catch (Exception error) {
              notifyFileOpenFailed();
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
