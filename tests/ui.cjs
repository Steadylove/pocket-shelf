const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../assets');
const out = path.resolve(__dirname, '../dist/verification');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const server = http
    .createServer((req, res) => {
      const file = path.join(root, req.url === '/' ? 'index.html' : req.url);
      res.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'application/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.json')
              ? 'application/json'
              : 'text/html'
      );
      fs.createReadStream(file)
        .on('error', () => res.end())
        .pipe(res);
    })
    .listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_EXECUTABLE ||
      (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true
  });
  try {
    for (const width of [360, 375, 773, 1100]) {
      const page = await browser.newPage({
        viewport: {
          width,
          height: width <= 375 ? 812 : width === 773 ? 334 : 740
        },
        deviceScaleFactor: 1
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(() => {
        window.mockState = {
          root: 'content://com.android.externalstorage.documents/tree/primary%3AROMs',
          tasks: []
        };
        window.Pocket = {
          state: () => JSON.stringify(window.mockState),
          library: (id) =>
            setTimeout(() =>
              window.nativeResult(
                id,
                true,
                JSON.stringify([
                  {
                    name: 'Anguna.gba',
                    platform: 'gba',
                    size: 1710888,
                    uri: 'content://example/Anguna.gba'
                  }
                ])
              )
            ),
          probe: (id) =>
            setTimeout(() =>
              window.nativeResult(
                id,
                true,
                JSON.stringify(
                  window.mockProbeResponse || { available: true, size: 1024 }
                )
              )
            ),
          fetch: (id) =>
            setTimeout(() =>
              window.nativeResult(id, false, '测试来源不可访问')
            ),
          download: (value) => {
            const x = JSON.parse(value);
            window.mockState.tasks.push({
              ...x,
              id: 'test',
              status: 'queued',
              downloaded: 0,
              total: 0,
              message: '等待下载'
            });
          },
          chooseFolder: () => {},
          openSite: () => {},
          openOmni: () => {},
          play: (uri) => {
            window.lastPlay = uri;
          },
          task: () => {}
        };
      });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.getByRole('button', { name: '浏览游戏库' }).waitFor();
      assert.equal(await page.locator('.platform-card').count(), 4);
      assert.equal(await page.locator('.hero-art,.device').count(), 0);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      );
      await page.screenshot({
        path: path.join(out, `home-${width}.png`),
        fullPage: true
      });
      await page.getByRole('button', { name: '浏览游戏库' }).click();
      await page.locator('.game-row').first().waitFor();
      assert.equal(await page.locator('.game-row').count(), 60);
      await page.locator('#gameSearch').fill('黄金太阳');
      await page.locator('.game-row').first().waitFor();
      assert.match(await page.locator('#games').textContent(), /Golden Sun/);
      await page.screenshot({
        path: path.join(out, `catalog-${width}.png`),
        fullPage: true
      });
      await page.locator('[data-download]').first().click();
      await page.locator('[data-nav="downloads"]').click();
      await page.waitForFunction(() => document.querySelector('.transfer'));
      assert.match(await page.locator('.transfer').textContent(), /ROMs\/gba/);
      await page.locator('[data-nav="sources"]').click();
      assert.equal(await page.locator('[data-provider]').count(), 2);
      assert.ok(
        !(await page.locator('#main').textContent()).includes('需原站登录')
      );
      await page.locator('[data-provider="edge"]').click();
      assert.ok((await page.locator('[data-source-platform]').count()) >= 4);
      await page.locator('[data-source-platform="gba"]').click();
      await page.locator('.game-row').first().waitFor();
      // Real wheel and touch input on the navigation must not pan its sibling content.
      const cdp = await page.context().newCDPSession(page);
      const main = page.locator('#main');
      const rail = page.locator('#rail');
      await main.evaluate((el) => {
        el.scrollTop = 160;
      });
      const beforeNavScroll = await main.evaluate((el) => el.scrollTop);
      const navBox = await rail.boundingBox();
      const headerBefore = await page.locator('header').boundingBox();
      await page.mouse.move(
        navBox.x + navBox.width / 2,
        navBox.y + navBox.height / 2
      );
      await page.mouse.wheel(0, 450);
      await page.waitForTimeout(180);
      assert.equal(await main.evaluate((el) => el.scrollTop), beforeNavScroll);
      async function swipe(box, offset) {
        const x = box.x + box.width / 2;
        const startY = box.y + box.height * 0.7;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y: startY }]
        });
        for (let step = 1; step <= 7; step++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: startY - (offset * step) / 7 }]
          });
          await page.waitForTimeout(18);
        }
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: []
        });
        await page.waitForTimeout(450);
      }
      await swipe(navBox, Math.min(85, navBox.height / 3));
      assert.equal(
        await main.evaluate((el) => el.scrollTop),
        beforeNavScroll,
        'navigation swipe leaked into content'
      );
      const contentBox = await main.boundingBox();
      await swipe(contentBox, 110);
      assert.ok(
        (await main.evaluate((el) => el.scrollTop)) > beforeNavScroll,
        'content should scroll from its own swipe'
      );
      assert.equal(
        await page.evaluate(() => document.scrollingElement.scrollTop),
        0
      );
      assert.deepEqual(
        await page.locator('header').boundingBox(),
        headerBefore
      );
      if (width <= 375) {
        assert.ok(
          navBox.y >= contentBox.y + contentBox.height - 1,
          'portrait content must end above navigation'
        );
        const controls = await page
          .locator('#rail nav button')
          .evaluateAll((xs) =>
            xs.map((el) => ({
              h: el.getBoundingClientRect().height,
              w: el.getBoundingClientRect().width
            }))
          );
        assert.ok(controls.every((r) => r.h >= 44 && r.w >= 44));
      }
      await cdp.detach();
      await page.locator('[data-nav="sources"]').click();
      assert.equal(await page.locator('[data-provider]').count(), 2);
      assert.match(
        await page.locator('#sourceGrid').textContent(),
        /Edge Emulation/
      );
      await page.locator('[data-nav="library"]').click();
      await page.getByRole('button', { name: '开玩' }).click();
      assert.equal(
        await page.evaluate(() => window.lastPlay),
        'content://example/Anguna.gba'
      );
      await page.locator('[data-nav="home"]').click();
      await page.locator('[data-platform="gba"]').click();
      await page.locator('#refreshCatalog').click();
      await page
        .getByRole('heading', { name: '这个来源暂时没有连上' })
        .waitFor();
      await page.locator('#cachedCatalog').click();
      assert.equal(await page.locator('.game-row').count(), 60);
      const rejectedUrl = await page.evaluate(() => filtered[0].url);
      await page.evaluate(() => {
        window.mockProbeResponse = {
          available: false,
          block: true,
          reason: 'Login page'
        };
      });
      await page.locator('[data-download]').first().click();
      await page.waitForFunction(
        (url) => !entries.some((e) => e.url === url),
        rejectedUrl
      );
      assert.equal(
        await page.evaluate(() => window.mockState.tasks.length),
        1,
        'unavailable file must not be queued'
      );
      assert.ok(
        await page.evaluate(
          (url) =>
            JSON.parse(localStorage.getItem('unavailable-direct'))[url] >
            Date.now(),
          rejectedUrl
        )
      );
      await page.evaluate(() => {
        window.mockProbeResponse = {
          available: false,
          block: false,
          reason: 'Temporary network failure'
        };
      });
      const transientUrl = await page.evaluate(() => filtered[0].url);
      await page.locator('[data-download]').first().click();
      await page.waitForFunction(
        () =>
          document.querySelector('#toast').textContent ===
          'Temporary network failure'
      );
      assert.ok(
        await page.evaluate(
          (url) => entries.some((e) => e.url === url),
          transientUrl
        ),
        'network timeout must not permanently hide a file'
      );
      await main.evaluate((el) => {
        el.scrollTop = 180;
      });
      await page.locator('[data-nav="settings"]').click();
      assert.equal(
        await main.evaluate((el) => el.scrollTop),
        0,
        'new section must start at the top'
      );
      const adapterCheck = await page.evaluate(() => {
        const html =
          '<div class="entry"><a href="../">../</a></div><div class="entry"><a href="/rom?id=1">A &amp; B (USA).zip</a><span>2 MB</span><a href="javascript:void(0)">magnet</a></div>';
        return Catalog.minerva(
          new DOMParser().parseFromString(html, 'text/html'),
          'https://minerva-archive.org/browse/test/'
        );
      });
      assert.equal(adapterCheck.length, 1);
      assert.equal(adapterCheck[0].kind, 'minerva');
      assert.equal(adapterCheck[0].name, 'A & B (USA).zip');
      const edgeFixture = await page.evaluate(() =>
        Catalog.edge(
          new DOMParser().parseFromString(
            '<details data-name="A &amp; B (USA).zip"><summary>A &amp; B</summary><p><a href="/download/nintendo-nes/A%20%26%20B.zip">download</a> (<span>2.5m, 12 DLs</span>)</p></details>',
            'text/html'
          ),
          'https://edgeemu.net/browse/nintendo-nes/a'
        )
      );
      assert.equal(edgeFixture.length, 1);
      assert.equal(edgeFixture[0].name, 'A & B (USA).zip');
      assert.equal(edgeFixture[0].sizeText, '2.5m');
      assert.equal(edgeFixture[0].kind, 'direct');

      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      );
      assert.deepEqual(errors, []);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(
        await page
          .locator('button')
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        '0s'
      );
      console.log(
        'PASS responsive UI, catalog/search, source filtering, queue, launch, network recovery:',
        width
      );
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
