package dev.pocket.shelf;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

final class Net {
  static final class SourceUnavailableException extends IOException {
    SourceUnavailableException(String message) {
      super(message);
    }
  }

  static URL url(String value) throws Exception {
    URL u = new URL(value.replace(" ", "%20"));
    if (!u.getProtocol().equals("https") || u.getUserInfo() != null) {
      throw new IOException("仅支持 HTTPS 下载链接");
    }
    String h = u.getHost().toLowerCase(java.util.Locale.ROOT);
    if (h.equals("localhost") || h.endsWith(".local") || h.matches("[0-9.]+") || h.contains(":")) {
      throw new IOException("不支持本地网络地址");
    }
    return u;
  }

  static HttpURLConnection open(String address, long offset) throws Exception {
    return open(address, offset, false);
  }

  private static HttpURLConnection open(String address, long offset, boolean preview)
      throws Exception {
    URL current = url(address);
    for (int redirects = 0; redirects < (preview ? 3 : 8); redirects++) {
      HttpURLConnection c = (HttpURLConnection) current.openConnection();
      c.setConnectTimeout(preview ? 8000 : 20000);
      c.setReadTimeout(preview ? 8000 : 25000);
      c.setInstanceFollowRedirects(false);
      c.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) PocketShelf/1.2");
      c.setRequestProperty("Accept-Encoding", "identity");
      if (preview) c.setRequestProperty("Range", "bytes=0-63");
      else if (offset > 0) c.setRequestProperty("Range", "bytes=" + offset + "-");
      int code = c.getResponseCode();
      if (code >= 300 && code < 400) {
        String next = c.getHeaderField("Location");
        c.disconnect();
        if (next == null) throw new IOException("来源返回了无效跳转");
        current = url(new URL(current, next).toString());
        continue;
      }
      if (code == 401 || code == 403 || code == 404 || code == 410) {
        c.disconnect();
        throw new SourceUnavailableException("此链接当前不可直接下载（HTTP " + code + "）");
      }
      if (code != 200 && code != 206) {
        c.disconnect();
        throw new IOException("来源返回 HTTP " + code + "，请稍后重试或切换来源");
      }
      return c;
    }
    throw new IOException("来源跳转次数过多");
  }

  static byte[] bytes(String address, int maximum) throws Exception {
    HttpURLConnection c = open(address, 0);
    try (InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] b = new byte[32768];
      int n;
      while ((n = in.read(b)) != -1) {
        if (out.size() + n > maximum) throw new IOException("目录过大，请在原站浏览");
        out.write(b, 0, n);
      }
      return out.toByteArray();
    } finally {
      c.disconnect();
    }
  }

  static String text(String address) throws Exception {
    return new String(bytes(address, 32 * 1024 * 1024), StandardCharsets.UTF_8);
  }

  static void validatePreview(String name, String contentType, byte[] prefix) throws IOException {
    String lower = name.toLowerCase(java.util.Locale.ROOT);
    String type = contentType == null ? "" : contentType.toLowerCase(java.util.Locale.ROOT);
    String text =
        new String(prefix, StandardCharsets.US_ASCII).trim().toLowerCase(java.util.Locale.ROOT);
    if (prefix.length == 0
        || type.startsWith("text/")
        || type.contains("json")
        || text.startsWith("<!doctype")
        || text.startsWith("<html")) {
      throw new SourceUnavailableException("来源返回了网页或空文件，已隐藏该链接");
    }
    if (lower.endsWith(".zip")
        && (prefix.length < 4
            || prefix[0] != 0x50
            || prefix[1] != 0x4b
            || prefix[2] != 3
            || prefix[3] != 4)) {
      throw new SourceUnavailableException("来源没有返回有效的 ZIP 游戏包，已隐藏该链接");
    }
    if (lower.endsWith(".7z")) {
      byte[] signature = {0x37, 0x7a, (byte) 0xbc, (byte) 0xaf, 0x27, 0x1c};
      if (prefix.length < signature.length) throw new SourceUnavailableException("7z 文件头不完整");
      for (int i = 0; i < signature.length; i++)
        if (signature[i] != prefix[i]) throw new SourceUnavailableException("来源没有返回有效的 7z 游戏包");
    }
  }

  static long preview(String address, String name) throws Exception {
    RomFiles.safeName(name);
    HttpURLConnection c = open(address, 0, true);
    try (InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[64];
      int n;
      while (out.size() < 64 && (n = in.read(buffer, 0, 64 - out.size())) != -1)
        out.write(buffer, 0, n);
      validatePreview(name, c.getContentType(), out.toByteArray());
      String range = c.getHeaderField("Content-Range");
      if (range != null && range.matches("bytes [0-9]+-[0-9]+/[0-9]+"))
        return Long.parseLong(range.substring(range.lastIndexOf('/') + 1));
      return Math.max(0, c.getContentLengthLong());
    } finally {
      c.disconnect();
    }
  }
}
