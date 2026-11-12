package dev.pocket.shelf;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.ZipFile;
import org.json.*;

public final class TransferService extends Service {
  static final Set<String> cancelled = ConcurrentHashMap.newKeySet();
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private volatile int latestStart;
  private volatile boolean destroyed;
  private TorrentEngine engine;

  @Override
  public IBinder onBind(Intent i) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    latestStart = startId;
    NotificationManager nm = getSystemService(NotificationManager.class);
    nm.createNotificationChannel(
        new NotificationChannel("downloads", "游戏下载", NotificationManager.IMPORTANCE_LOW));
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(1, notification("准备下载", 0, 0), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    } else {
      startForeground(1, notification("准备下载", 0, 0));
    }
    worker.execute(() -> work(startId));
    return START_NOT_STICKY;
  }

  private Notification notification(String message, long done, long total) {
    PendingIntent open =
        PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    return new Notification.Builder(this, "downloads")
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle("口袋游戏库")
        .setContentText(message)
        .setContentIntent(open)
        .setOnlyAlertOnce(true)
        .setOngoing(true)
        .setProgress(100, total > 0 ? (int) (done * 100 / total) : 0, total <= 0)
        .build();
  }

  void check(JSONObject task) throws InterruptedException {
    if (destroyed
        || cancelled.contains(task.optString("id"))
        || Thread.currentThread().isInterrupted()) throw new InterruptedException("下载已暂停");
  }

  void progress(JSONObject task, String message, long done, long total)
      throws InterruptedException {
    check(task);
    Store.update(
        this,
        task,
        "status",
        "downloading",
        "message",
        message,
        "downloaded",
        done,
        "total",
        total);
    getSystemService(NotificationManager.class)
        .notify(1, notification(task.optString("name") + " · " + message, done, total));
  }

  private void work(int startId) {
    try {
      while (!destroyed) {
        JSONObject next = null;
        synchronized (Store.class) {
          JSONArray tasks = Store.tasks(this);
          for (int i = 0; i < tasks.length(); i++)
            if (tasks.optJSONObject(i).optString("status").equals("queued")) {
              next = tasks.optJSONObject(i);
              break;
            }
          if (next != null) Store.update(this, next, "status", "downloading");
        }
        if (next == null) break;
        JSONObject task = next;
        cancelled.remove(task.optString("id"));
        try {
          File downloaded;
          if (task.optString("kind").equals("minerva")) {
            if (engine == null) engine = new TorrentEngine(this);
            downloaded = engine.download(task);
          } else downloaded = http(task);
          check(task);
          Store.update(
              this,
              task,
              "status",
              "importing",
              "message",
              "正在导入 ROMs/" + task.optString("platform"));
          verify(downloaded, task.optString("name"));
          Uri uri =
              RomFiles.install(
                  this, task.optString("platform"), task.optString("name"), downloaded);
          Store.update(
              this,
              task,
              "status",
              "done",
              "message",
              "已导入 ROMs/" + task.optString("platform"),
              "uri",
              uri.toString(),
              "downloaded",
              downloaded.length(),
              "total",
              downloaded.length());
          downloaded.delete();
        } catch (InterruptedException e) {
          Store.update(this, task, "status", "paused", "message", "已暂停，点击继续下载");
        } catch (Exception | LinkageError e) {
          android.util.Log.e("PocketShelf", "Transfer failed", e);
          if (cancelled.contains(task.optString("id"))) {
            Store.update(this, task, "status", "paused", "message", "已暂停，点击继续下载");
          } else {
            Store.update(
                this,
                task,
                "status",
                "error",
                "message",
                e.getMessage() == null ? "下载失败，请重试或切换来源" : e.getMessage());
          }
        }
      }
    } finally {
      if (engine != null) engine.stop();
      engine = null;
      if (startId == latestStart) {
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf(startId);
      }
    }
  }

  private File http(JSONObject task) throws Exception {
    File base = new File(getFilesDir(), "downloads");
    base.mkdirs();
    File file = new File(base, task.getString("id") + ".part");
    long offset = file.length();
    HttpURLConnection c = Net.open(task.getString("url"), offset);
    try {
      boolean resumed = c.getResponseCode() == 206;
      if (!resumed) offset = 0;
      String type = c.getContentType();
      if (type != null && (type.contains("text/html") || type.contains("application/json")))
        throw new IOException("来源返回的是网页，请打开原站取得实际文件链接");
      if (resumed) {
        String range = c.getHeaderField("Content-Range");
        if (range == null || !range.startsWith("bytes " + offset + "-"))
          throw new IOException("来源不支持正确续传，请切换来源");
      }
      long length = c.getContentLengthLong();
      long total = length > 0 ? offset + length : 0;
      if (total > getFilesDir().getUsableSpace() + offset) throw new IOException("手机剩余空间不足");
      long done = offset, last = 0;
      try (InputStream in = c.getInputStream();
          OutputStream out = new FileOutputStream(file, resumed)) {
        byte[] bytes = new byte[131072];
        int n;
        while ((n = in.read(bytes)) != -1) {
          check(task);
          out.write(bytes, 0, n);
          done += n;
          if (System.currentTimeMillis() - last > 700) {
            progress(task, "正在下载", done, total);
            last = System.currentTimeMillis();
          }
        }
      }
      if (total > 0 && done != total) throw new IOException("下载未完整结束，请继续下载");
      return file;
    } finally {
      c.disconnect();
    }
  }

  private void verify(File file, String name) throws Exception {
    if (!file.isFile() || file.length() == 0) throw new IOException("来源返回了空文件");
    try (InputStream in = new FileInputStream(file)) {
      byte[] b = new byte[128];
      int n = in.read(b);
      String start =
          new String(b, 0, Math.max(0, n), java.nio.charset.StandardCharsets.US_ASCII)
              .trim()
              .toLowerCase(Locale.ROOT);
      if (start.startsWith("<!doctype") || start.startsWith("<html"))
        throw new IOException("下载到的是登录网页，请切换来源");
    }
    if (name.toLowerCase(Locale.ROOT).endsWith(".zip")) {
      try (ZipFile zip = new ZipFile(file)) {
        if (zip.size() == 0) throw new IOException("游戏压缩包为空");
      }
    }
  }

  @Override
  public void onTimeout(int startId, int fgsType) {
    destroyed = true;
    stopSelf();
  }

  @Override
  public void onDestroy() {
    destroyed = true;
    worker.shutdownNow();
    super.onDestroy();
  }
}
