package dev.pocket.shelf;

import com.frostwire.jlibtorrent.*;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;
import org.json.*;

final class TorrentEngine {
  private final TransferService service;
  private final SessionManager session = new SessionManager();

  TorrentEngine(TransferService service) {
    this.service = service;
    session.start();
    session.maxConnections(80);
    session.uploadRateLimit(32 * 1024);
  }

  File download(JSONObject task) throws Exception {
    service.progress(task, "正在获取单游戏信息", 0, 0);
    String page = Net.text(task.getString("url"));
    Matcher match = Pattern.compile("window\\.rom\\s*=\\s*(\\{[^\\r\\n]*?\\});").matcher(page);
    if (!match.find()) throw new IOException("来源页面已变化，请打开原站或切换下载来源");
    JSONObject rom = new JSONObject(match.group(1));
    String filename = RomFiles.safeName(rom.getString("file_name"));
    if (!filename.equals(task.getString("name"))) throw new IOException("来源文件名不匹配，已停止下载");
    String torrentUrl =
        new URL(new URL(task.getString("url")), "/assets/" + rom.getString("torrents")).toString();
    File metadataDir = new File(service.getFilesDir(), "torrents");
    metadataDir.mkdirs();
    String key = Integer.toHexString(torrentUrl.hashCode());
    File metadata = new File(metadataDir, key + ".torrent");
    if (!metadata.exists()) {
      byte[] data = Net.bytes(torrentUrl, 64 * 1024 * 1024);
      File temp = new File(metadataDir, key + ".tmp");
      try (FileOutputStream out = new FileOutputStream(temp)) {
        out.write(data);
      }
      if (!temp.renameTo(metadata)) throw new IOException("无法保存下载元数据");
    }
    TorrentInfo ti = new TorrentInfo(metadata);
    FileStorage files = ti.files();
    int selected = -1;
    String expected = rom.optString("full_path").replaceFirst("^\\./", "");
    for (int i = 0; i < files.numFiles(); i++) {
      String path = files.filePath(i);
      if (path.equals(expected) || path.endsWith("/" + expected)) {
        selected = i;
        break;
      }
      if (new File(path).getName().equals(filename)) selected = i;
    }
    if (selected < 0) throw new IOException("种子中没有找到该游戏，已停止下载");
    Priority[] priorities = Priority.array(Priority.IGNORE, ti.numFiles());
    priorities[selected] = Priority.NORMAL;
    File staging = new File(service.getFilesDir(), "bt/" + key);
    staging.mkdirs();
    File result = new File(staging, files.filePath(selected));
    if (!result.getCanonicalPath().startsWith(staging.getCanonicalPath() + File.separator))
      throw new IOException("下载路径无效");
    TorrentHandle handle = null;
    try {
      // Start paused and in upload mode: select exactly one file before allowing any payload.
      session.download(
          ti, staging, null, priorities, null, TorrentFlags.PAUSED.or_(TorrentFlags.UPLOAD_MODE));
      for (int i = 0; i < 100; i++) {
        service.check(task);
        handle = session.find(ti);
        if (handle != null && handle.isValid()) break;
        Thread.sleep(100);
      }
      if (handle == null || !handle.isValid()) throw new IOException("下载内核未能创建任务，请重试");
      handle.unsetFlags(TorrentFlags.AUTO_MANAGED);
      handle.prioritizeFiles(priorities);
      handle.unsetFlags(TorrentFlags.UPLOAD_MODE);
      handle.resume();
      long expectedSize = files.fileSize(selected);
      while (true) {
        service.check(task);
        TorrentStatus s = handle.status();
        if (s.errorCode().value() != 0) throw new IOException(s.errorCode().message());
        long[] progress = handle.fileProgress();
        long done = selected < progress.length ? progress[selected] : 0;
        service.progress(
            task,
            s.downloadRate() > 0
                ? "BT 下载 · " + (s.downloadRate() / 1024) + " KB/s"
                : "BT 正在连接做种者 · 可暂停或换来源",
            done,
            expectedSize);
        if (done >= expectedSize && result.isFile() && result.length() == expectedSize) break;
        Thread.sleep(1000);
      }
      handle.pause();
      handle.flushCache();
      service.progress(task, "正在校验游戏文件", expectedSize, expectedSize);
      String sha = rom.optString("sha256");
      if (sha.matches("[a-fA-F0-9]{64}")) {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(result)) {
          byte[] b = new byte[131072];
          int n;
          while ((n = in.read(b)) != -1) {
            service.check(task);
            hash.update(b, 0, n);
          }
        }
        StringBuilder actual = new StringBuilder();
        for (byte b : hash.digest()) actual.append(String.format(Locale.ROOT, "%02x", b & 255));
        if (!actual.toString().equalsIgnoreCase(sha)) throw new IOException("游戏文件校验失败，请重新下载");
      }
      return result;
    } finally {
      if (handle != null && handle.isValid()) {
        handle.pause();
        session.remove(handle);
      }
    }
  }

  void stop() {
    session.stop();
  }
}
