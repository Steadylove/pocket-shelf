package dev.pocket.shelf;

/** Checks the boundary between untrusted catalog data and shared-storage writes. */
public final class NativeSafetyTest {
  interface Operation {
    void run() throws Exception;
  }

  private static void rejects(Operation operation) throws Exception {
    try {
      operation.run();
    } catch (java.io.IOException expected) {
      return;
    }
    throw new AssertionError("Untrusted path or URL was accepted");
  }

  public static void main(String[] args) throws Exception {
    byte[] zip = {0x50, 0x4b, 3, 4, 0, 0, 0, 0};
    Net.validatePreview("Game.zip", "application/octet-stream", zip);
    rejects(() -> Net.validatePreview("Game.zip", "text/html", zip));
    rejects(
        () ->
            Net.validatePreview(
                "Game.zip", "application/octet-stream", "<html>login</html>".getBytes()));
    rejects(
        () -> Net.validatePreview("Game.zip", "application/octet-stream", new byte[] {1, 2, 3, 4}));
    rejects(() -> Net.validatePreview("Game.7z", "application/octet-stream", zip));
    Net.validatePreview(
        "Game.7z",
        "application/octet-stream",
        new byte[] {0x37, 0x7a, (byte) 0xbc, (byte) 0xaf, 0x27, 0x1c, 0, 0});
    for (String name :
        new String[] {
          "../game.zip",
          "folder/game.gba",
          "folder\\game.gba",
          "game\u0000.zip",
          "game.apk",
          "game.zip.html"
        }) rejects(() -> RomFiles.safeName(name));
    if (!RomFiles.safeName("中文 & English (USA).zip").equals("中文 & English (USA).zip"))
      throw new AssertionError("valid filename changed");
    for (String address :
        new String[] {
          "http://example.com/game.zip",
          "https://127.0.0.1/game.zip",
          "https://localhost/game.zip",
          "https://user:password@example.com/game.zip"
        }) rejects(() -> Net.url(address));
    if (!Net.url("https://archive.org/download/example/A Game.zip")
        .toString()
        .endsWith("A%20Game.zip")) throw new AssertionError("space encoding failed");
    if (RomFiles.FOLDERS.contains("../saves") || RomFiles.FOLDERS.contains("Android/data"))
      throw new AssertionError("invalid platform directory");
    System.out.println(
        "PASS filename/path traversal, ROM extensions, HTTPS URL and platform-directory"
            + " boundaries, real ZIP/7z prefixes and HTML rejection");
  }
}
