// Run only against this app's debug build on the connected test phone.
// Uses physical Android touch injection; orientation and ADB forwarding are restored.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the authorized test device serial');
const adb = (...args) =>
  execFileSync(process.env.ANDROID_ADB || 'adb', ['-s', serial, ...args], {
    maxBuffer: 16 * 1024 * 1024
  });
const out = path.resolve(__dirname, '../dist/verification');
const originalRotation = adb(
  'shell',
  'settings',
  'get',
  'system',
  'user_rotation'
)
  .toString()
  .trim();
let page;

function webBounds() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/pocket-ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/pocket-ui.xml').toString();
  const match = xml.match(
    /class="android.webkit.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/
  );
  assert.ok(match, 'Own app WebView bounds missing');
  return match.slice(1).map(Number);
}

async function physicalSwipe(box, pixels, bounds) {
  const size = await page.evaluate(() => [innerWidth, innerHeight]);
  const [left, top, right, bottom] = bounds;
  const scaleX = (right - left) / size[0];
  const scaleY = (bottom - top) / size[1];
  const x = Math.round(left + (box.x + box.width / 2) * scaleX);
  const y = Math.round(top + (box.y + box.height * 0.7) * scaleY);
  adb(
    'shell',
    'input',
    'swipe',
    String(x),
    String(y),
    String(x),
    String(Math.round(y - pixels * scaleY)),
    '500'
  );
  await page.waitForTimeout(450);
}

(async () => {
  const pid = adb('shell', 'pidof', 'dev.pocket.shelf').toString().trim();
  assert.match(pid, /^\d+$/);
  adb('forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://app.pocket.local/'));
  assert.ok(page, 'Only the Pocket Shelf page may be controlled');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const report = [];
  try {
    const root = await page.evaluate(() => JSON.parse(Pocket.state()).root);
    assert.ok(
      root.includes('ROMs'),
      'ROMs authorization must survive the update'
    );
    for (const [rotation, mode] of [
      ['1', 'landscape'],
      ['0', 'portrait']
    ]) {
      adb('shell', 'settings', 'put', 'system', 'user_rotation', rotation);
      await page.waitForFunction(
        (expected) =>
          expected === 'portrait'
            ? innerHeight > innerWidth
            : innerWidth > innerHeight,
        mode
      );
      await page.locator('[data-nav="home"]').click();
      await page.locator('[data-platform="gba"]').click();
      await page.waitForFunction(
        () => document.querySelectorAll('.game-row').length === 60
      );
      const main = page.locator('#main');
      await main.evaluate((el) => {
        el.scrollTop = 160;
      });
      const before = await main.evaluate((el) => el.scrollTop);
      const rail = await page.locator('#rail').boundingBox();
      const panel = await main.boundingBox();
      const bounds = webBounds();
      await physicalSwipe(rail, Math.min(85, rail.height / 3), bounds);
      const afterRail = await main.evaluate((el) => el.scrollTop);
      assert.equal(
        afterRail,
        before,
        mode + ' navigation gesture must not pan the content'
      );
      await physicalSwipe(panel, Math.min(140, panel.height / 3), bounds);
      const afterContent = await main.evaluate((el) => el.scrollTop);
      assert.ok(
        afterContent > before + 20,
        mode + ' content must scroll normally'
      );
      assert.equal(
        await page.evaluate(() => document.scrollingElement.scrollTop),
        0
      );
      if (mode === 'portrait') assert.ok(panel.y + panel.height <= rail.y + 1);
      report.push({ mode, before, afterRail, afterContent, rootScroll: 0 });
      await page.locator('[data-nav="home"]').click();
      await page.waitForFunction(
        () => document.querySelectorAll('.platform-card').length === 4
      );
      fs.writeFileSync(
        path.join(out, 'phone-refined-' + mode + '.png'),
        adb('exec-out', 'screencap', '-p')
      );
      console.log(
        'PASS physical Android navigation/content scroll isolation:',
        mode,
        report.at(-1)
      );
    }
    await page.locator('[data-nav="library"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-local]').length >= 4
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'android-scroll-results.json'),
      JSON.stringify(
        { version: '1.2.0', report, libraryPreserved: true, errors },
        null,
        2
      ) + '\n'
    );
  } finally {
    adb(
      'shell',
      'settings',
      'put',
      'system',
      'user_rotation',
      originalRotation
    );
    if (page) await page.locator('[data-nav="home"]').click();
    adb('forward', '--remove', 'tcp:9223');
  }
  process.exit(0);
})().catch((error) => {
  adb('shell', 'settings', 'put', 'system', 'user_rotation', originalRotation);
  try {
    adb('forward', '--remove', 'tcp:9223');
  } catch {}
  console.error(error);
  process.exit(1);
});
