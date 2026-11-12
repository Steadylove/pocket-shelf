package dev.pocket.shelf;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.DocumentsContract;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

public final class MainActivity extends Activity {
  private WebView web;
  private final ExecutorService network = Executors.newFixedThreadPool(3);

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    web = new WebView(this);
    WebView.setWebContentsDebuggingEnabled(
        (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
    web.setBackgroundColor(Color.rgb(16, 18, 20));
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);
    web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.getSettings().setTextZoom(100);
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onConsoleMessage(ConsoleMessage message) {
            if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
              android.util.Log.e(
                  "PocketShelfWeb", message.message() + " @ " + message.lineNumber());
            return true;
          }
        });
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            return true;
          }

          @Override
          public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            String u = r.getUrl().toString();
            if (u.startsWith("https://app.pocket.local/")) {
              try {
                String name = r.getUrl().getPath().substring(1);
                if (!name.matches("[a-zA-Z0-9_.-]+"))
                  return new WebResourceResponse("text/plain", "UTF-8", null);
                String mime =
                    name.endsWith(".js")
                        ? "application/javascript"
                        : name.endsWith(".css")
                            ? "text/css"
                            : name.endsWith(".json") ? "application/json" : "text/html";
                return new WebResourceResponse(mime, "UTF-8", getAssets().open(name));
              } catch (Exception e) {
                return new WebResourceResponse("text/plain", "UTF-8", null);
              }
            }
            return new WebResourceResponse("text/plain", "UTF-8", null);
          }
        });
    web.addJavascriptInterface(new Bridge(), "Pocket");
    FrameLayout frame = new FrameLayout(this);
    frame.addView(web);
    frame.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets bars =
                insets.getInsets(
                    WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
          } else {
            v.setPadding(
                insets.getSystemWindowInsetLeft(),
                insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),
                insets.getSystemWindowInsetBottom());
          }
          return insets;
        });
    setContentView(frame);
    web.loadUrl("https://app.pocket.local/index.html");
  }

  private void reply(String id, boolean ok, String data) {
    if (isDestroyed()) return;
    String script =
        "window.nativeResult("
            + JSONObject.quote(id)
            + ","
            + ok
            + ","
            + JSONObject.quote(data)
            + ")";
    runOnUiThread(
        () -> {
          if (!isDestroyed()) web.evaluateJavascript(script, null);
        });
  }

  private void notifyUi(String message) {
    runOnUiThread(
        () -> {
          if (!isDestroyed())
            web.evaluateJavascript("window.showToast(" + JSONObject.quote(message) + ")", null);
        });
  }

  final class Bridge {
    @JavascriptInterface
    public String state() {
      return Store.snapshot(MainActivity.this);
    }

    @JavascriptInterface
    public void fetch(String id, String url) {
      if (id.length() > 80 || url.length() > 8000) return;
      network.execute(
          () -> {
            try {
              reply(id, true, Net.text(url));
            } catch (Exception e) {
              reply(id, false, e.getMessage() == null ? "网络连接失败，请重试" : e.getMessage());
            }
          });
    }

    @JavascriptInterface
    public void probe(String id, String url, String name) {
      if (id.length() > 80 || url.length() > 8000 || name.length() > 230) return;
      network.execute(
          () -> {
            try {
              long size = Net.preview(url, name);
              reply(id, true, Store.json("available", true, "size", size).toString());
            } catch (Net.SourceUnavailableException e) {
              reply(
                  id,
                  true,
                  Store.json("available", false, "block", true, "reason", e.getMessage())
                      .toString());
            } catch (Exception e) {
              reply(
                  id,
                  true,
                  Store.json("available", false, "block", false, "reason", "连接检查失败，请稍后重试")
                      .toString());
            }
          });
    }

    @JavascriptInterface
    public void library(String id) {
      network.execute(
          () -> {
            try {
              reply(id, true, RomFiles.library(MainActivity.this).toString());
            } catch (Exception e) {
              reply(id, false, "请重新连接 ROMs 文件夹");
            }
          });
    }

    @JavascriptInterface
    public void chooseFolder() {
      runOnUiThread(
          () -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            i.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            i.putExtra(
                DocumentsContract.EXTRA_INITIAL_URI,
                Uri.parse(
                    "content://com.android.externalstorage.documents/document/primary%3AROMs"));
            startActivityForResult(i, 11);
          });
    }

    @JavascriptInterface
    public void download(String value) {
      try {
        JSONObject input = new JSONObject(value);
        String name = RomFiles.safeName(input.getString("name"));
        String platform = input.getString("platform");
        if (!RomFiles.FOLDERS.contains(platform)) throw new Exception("请选择游戏对应的平台");
        Net.url(input.getString("url"));
        RomFiles.root(MainActivity.this);
        if (!input.optString("kind").matches("direct|minerva")) throw new Exception("暂不支持此下载来源");
        synchronized (Store.class) {
          JSONArray all = Store.tasks(MainActivity.this);
          for (int i = 0; i < all.length(); i++) {
            JSONObject t = all.getJSONObject(i);
            if (t.optString("url").equals(input.getString("url"))
                && t.optString("platform").equals(platform)) {
              if (t.optString("status").equals("done")) {
                notifyUi("游戏已导入，可在本地游戏里启动");
                return;
              }
              if (t.optString("status").matches("queued|downloading|importing")) {
                notifyUi("任务已在下载队列中");
                return;
              }
              Store.update(MainActivity.this, t, "status", "queued", "message", "等待下载");
              startTransfers();
              return;
            }
          }
          JSONObject t =
              Store.json(
                  "id",
                  UUID.randomUUID().toString(),
                  "name",
                  name,
                  "platform",
                  platform,
                  "url",
                  input.getString("url"),
                  "kind",
                  input.getString("kind"),
                  "status",
                  "queued",
                  "message",
                  "等待下载",
                  "downloaded",
                  0,
                  "total",
                  0);
          all.put(t);
          Store.save(MainActivity.this);
        }
        startTransfers();
        notifyUi("已加入下载，完成后自动放入 ROMs/" + platform);
      } catch (Exception e) {
        notifyUi(e.getMessage() == null ? "无法添加下载" : e.getMessage());
      }
    }

    @JavascriptInterface
    public void task(String id, String action) {
      JSONObject t = Store.find(MainActivity.this, id);
      if (t == null) return;
      if (action.equals("pause")) {
        TransferService.cancelled.add(id);
        Store.update(MainActivity.this, t, "status", "paused", "message", "下载已暂停，可继续");
      } else if (action.equals("resume") && t.optString("status").matches("error|paused")) {
        Store.update(MainActivity.this, t, "status", "queued", "message", "等待继续");
        startTransfers();
      }
    }

    @JavascriptInterface
    public void openSite(String url) {
      runOnUiThread(
          () -> {
            try {
              Net.url(url);
              startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception e) {
              notifyUi("无法打开链接");
            }
          });
    }

    @JavascriptInterface
    public void play(String uri) {
      runOnUiThread(
          () -> {
            try {
              Uri u = Uri.parse(uri);
              Uri root = RomFiles.root(MainActivity.this);
              if (!u.getAuthority().equals(root.getAuthority())
                  || !DocumentsContract.getDocumentId(u)
                      .startsWith(DocumentsContract.getDocumentId(root) + "/"))
                throw new Exception("文件不在已连接的 ROMs 文件夹内");
              Intent i = new Intent(Intent.ACTION_VIEW);
              i.setClassName(
                  "com.omnidroid", "com.omnidroid.app.shared.game.ExternalGameLauncherActivity");
              i.setDataAndType(u, "application/octet-stream");
              i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
              i.setClipData(ClipData.newRawUri("game", u));
              startActivity(i);
            } catch (Exception e) {
              notifyUi("无法直接启动，请打开 Omnidroid 重新扫描游戏目录");
            }
          });
    }

    @JavascriptInterface
    public void openOmni() {
      runOnUiThread(
          () -> {
            try {
              Intent i = getPackageManager().getLaunchIntentForPackage("com.omnidroid");
              if (i == null) throw new Exception();
              startActivity(i);
            } catch (Exception e) {
              notifyUi("尚未安装 Omnidroid");
            }
          });
    }
  }

  private void startTransfers() {
    runOnUiThread(
        () -> {
          if (Build.VERSION.SDK_INT >= 33
              && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                  != PackageManager.PERMISSION_GRANTED
              && !Store.prefs(this).getBoolean("askedNotifications", false)) {
            Store.prefs(this).edit().putBoolean("askedNotifications", true).apply();
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 12);
          }
          startForegroundService(new Intent(this, TransferService.class));
        });
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == 11 && result == RESULT_OK && data != null && data.getData() != null) {
      try {
        Uri tree = data.getData();
        String name = DocumentsContract.getTreeDocumentId(tree);
        if (!name.substring(name.lastIndexOf('/') + 1).matches("(?i)(primary:)?ROMs")) {
          notifyUi("请选择现有的 ROMs 文件夹，与 Omnidroid 使用同一个目录");
          return;
        }
        getContentResolver()
            .takePersistableUriPermission(
                tree,
                data.getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION));
        Store.prefs(this).edit().putString("root", tree.toString()).apply();
        notifyUi("已连接 ROMs，后续下载自动归类");
        web.evaluateJavascript("window.refreshLibrary()", null);
      } catch (Exception e) {
        notifyUi("目录连接失败，请重新选择 ROMs");
      }
    }
  }

  @Override
  public void onBackPressed() {
    web.evaluateJavascript(
        "window.handleBack()",
        value -> {
          if ("false".equals(value)) super.onBackPressed();
        });
  }

  @Override
  protected void onDestroy() {
    network.shutdownNow();
    web.removeJavascriptInterface("Pocket");
    web.destroy();
    super.onDestroy();
  }
}
