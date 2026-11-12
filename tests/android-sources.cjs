// Device validation for the curated direct-download flow. Only controls Pocket Shelf.
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
let page;
(async () => {
  const pid = adb('shell', 'pidof', 'dev.pocket.shelf').toString().trim();
  assert.match(pid, /^\d+$/);
  adb('forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://app.pocket.local/'));
  assert.ok(page);
  try {
    await page.locator('[data-nav="sources"]').click();
    assert.equal(await page.locator('[data-provider]').count(), 2);
    const checks = await page.evaluate(async () => {
      const samples = seed.providers
        .find((p) => p.id === 'edge')
        .checks.filter((c) =>
          ['nes', 'snes', 'gba', 'md'].includes(c.platform)
        );
      const result = [];
      for (const sample of samples) {
        const name = decodeURIComponent(
          new URL(sample.url).pathname.split('/').pop()
        );
        result.push({
          platform: sample.platform,
          ...JSON.parse(await request('probe', sample.url, name))
        });
      }
      return result;
    });
    assert.equal(checks.length, 4);
    assert.ok(checks.every((c) => c.available && c.size > 64));
    const webRejected = await page.evaluate(async () =>
      JSON.parse(
        await request('probe', 'https://edgeemu.net/', 'Not-A-Game.zip')
      )
    );
    assert.equal(webRejected.available, false);
    assert.equal(webRejected.block, true);
    console.log(
      'PASS native real ZIP-prefix checks for FC/SFC/GBA/MD and HTML-page rejection',
      checks
    );
    fs.writeFileSync(
      path.join(out, 'phone-curated-sources.png'),
      adb('exec-out', 'screencap', '-p')
    );
    await page.locator('[data-provider="edge"]').click();
    await page.locator('[data-source-platform="nes"]').click();
    await page.locator('#gameSearch').fill('Nim & Nom');
    await page.locator('[data-download]').first().waitFor();
    const url = await page.evaluate(() => filtered[0].url);
    await page.locator('[data-download]').first().click();
    await page.locator('[data-nav="downloads"]').click();
    await page.waitForFunction(
      (url) =>
        JSON.parse(Pocket.state()).tasks.some(
          (t) => t.url === url && ['done', 'error'].includes(t.status)
        ),
      url,
      { timeout: 60000 }
    );
    const task = await page.evaluate(
      (url) => JSON.parse(Pocket.state()).tasks.find((t) => t.url === url),
      url
    );
    assert.equal(task.status, 'done', task.message);
    assert.equal(task.platform, 'nes');
    assert.ok(task.uri.includes('ROMs'));
    fs.writeFileSync(
      path.join(out, 'phone-direct-download.png'),
      adb('exec-out', 'screencap', '-p')
    );
    await page.locator('[data-play]').first().click();
    await page.waitForTimeout(1200);
    assert.match(
      adb('shell', 'dumpsys', 'activity', 'activities').toString(),
      /topResumedActivity=.*com\.omnidroid\/.*GameActivity/
    );
    fs.writeFileSync(
      path.join(out, 'phone-direct-game-launch.png'),
      adb('exec-out', 'screencap', '-p')
    );
    adb('shell', 'input', 'keyevent', '4');
    adb('shell', 'am', 'start', '-n', 'dev.pocket.shelf/.MainActivity');
    fs.writeFileSync(
      path.join(out, 'direct-source-results.json'),
      JSON.stringify(
        {
          version: '1.2.0',
          providers: 2,
          checks,
          htmlRejected: webRejected,
          download: {
            name: task.name,
            status: task.status,
            bytes: task.total,
            platform: task.platform
          },
          omnidroidLaunched: true
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      'PASS actual Edge ZIP download, import into ROMs/nes and Omnidroid launch'
    );
    await page.locator('[data-nav="home"]').click();
  } finally {
    adb('forward', '--remove', 'tcp:9223');
  }
  process.exit(0);
})().catch((error) => {
  try {
    adb('forward', '--remove', 'tcp:9223');
  } catch {}
  console.error(error);
  process.exit(1);
});
