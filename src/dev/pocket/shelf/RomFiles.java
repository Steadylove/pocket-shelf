package dev.pocket.shelf;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.*;
import java.util.*;
import org.json.*;

final class RomFiles {
  static final Set<String> FOLDERS =
      new HashSet<>(
          Arrays.asList(
              "nes",
              "snes",
              "gba",
              "gb",
              "gbc",
              "md",
              "nds",
              "3ds",
              "ps2",
              "psx",
              "psp",
              "n64",
              "gg",
              "sms",
              "32x",
              "dreamcast",
              "saturn",
              "segacd",
              "pce",
              "arcade",
              "gamecube",
              "wii",
              "atari2600",
              "lynx",
              "ngp",
              "wonderswan"));

  static boolean supported(String name) {
    return name.toLowerCase(Locale.ROOT)
        .matches(
            ".+\\.(nes|fds|sfc|smc|gba|gb|gbc|md|gen|smd|bin|nds|3ds|cci|cxi|3dsx|iso|cso|chd|pbp|cue|zip|7z|z64|n64|v64|gg|sms|32x|rvz|gcm|wbfs|pce|a26|lnx|ngp|ngc|ws|wsc)$");
  }

  static String safeName(String name) throws IOException {
    if (name == null
        || name.contains("/")
        || name.contains("\\")
        || name.equals(".")
        || name.equals("..")
        || name.length() > 230
        || name.matches(".*[\\x00-\\x1f].*")) throw new IOException("文件名无效");
    if (!supported(name)) throw new IOException("这不是受支持的游戏文件，请选择 ROM 或 ZIP / 7z 压缩包");
    return name;
  }

  static Uri root(Context c) throws IOException {
    String value = Store.prefs(c).getString("root", "");
    if (value.isEmpty()) throw new IOException("请先连接手机 ROMs 文件夹");
    Uri tree = Uri.parse(value);
    return DocumentsContract.buildDocumentUriUsingTree(
        tree, DocumentsContract.getTreeDocumentId(tree));
  }

  static Uri child(Context c, Uri parent, String name) throws Exception {
    Uri children =
        DocumentsContract.buildChildDocumentsUriUsingTree(
            parent, DocumentsContract.getDocumentId(parent));
    try (Cursor q =
        c.getContentResolver()
            .query(
                children,
                new String[] {
                  DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                  DocumentsContract.Document.COLUMN_DISPLAY_NAME
                },
                null,
                null,
                null)) {
      while (q != null && q.moveToNext()) {
        if (name.equals(q.getString(1)))
          return DocumentsContract.buildDocumentUriUsingTree(parent, q.getString(0));
      }
    }
    return null;
  }

  static Uri install(Context c, String platform, String filename, File source) throws Exception {
    if (!FOLDERS.contains(platform)) throw new IOException("请先选择正确的平台目录");
    safeName(filename);
    Uri root = root(c);
    Uri folder = child(c, root, platform);
    if (folder == null)
      folder =
          DocumentsContract.createDocument(
              c.getContentResolver(), root, DocumentsContract.Document.MIME_TYPE_DIR, platform);
    if (folder == null) throw new IOException("无法创建平台目录，请重新连接 ROMs 文件夹");
    Uri existing = child(c, folder, filename);
    if (existing != null) return existing;
    Uri temp =
        DocumentsContract.createDocument(
            c.getContentResolver(),
            folder,
            "application/octet-stream",
            ".pocket-" + UUID.randomUUID() + ".part");
    if (temp == null) throw new IOException("无法写入 ROMs 文件夹");
    boolean ok = false;
    try {
      try (InputStream in = new FileInputStream(source);
          OutputStream out = c.getContentResolver().openOutputStream(temp, "wt")) {
        if (out == null) throw new IOException("无法打开目标文件");
        byte[] b = new byte[131072];
        int n;
        while ((n = in.read(b)) != -1) out.write(b, 0, n);
        out.flush();
      }
      Uri result = DocumentsContract.renameDocument(c.getContentResolver(), temp, filename);
      if (result == null) throw new IOException("文件导入未完成，请重试");
      ok = true;
      return result;
    } finally {
      if (!ok) DocumentsContract.deleteDocument(c.getContentResolver(), temp);
    }
  }

  static JSONArray library(Context c) throws Exception {
    JSONArray result = new JSONArray();
    Uri root = root(c);
    for (String folder : FOLDERS) {
      Uri p = child(c, root, folder);
      if (p == null) continue;
      Uri children =
          DocumentsContract.buildChildDocumentsUriUsingTree(p, DocumentsContract.getDocumentId(p));
      try (Cursor q =
          c.getContentResolver()
              .query(
                  children,
                  new String[] {
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_SIZE
                  },
                  null,
                  null,
                  null)) {
        while (q != null && q.moveToNext()) {
          String name = q.getString(1);
          if (supported(name))
            result.put(
                Store.json(
                    "name",
                    name,
                    "platform",
                    folder,
                    "size",
                    q.getLong(2),
                    "uri",
                    DocumentsContract.buildDocumentUriUsingTree(p, q.getString(0)).toString()));
        }
      }
    }
    return result;
  }
}
