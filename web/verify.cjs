// Headless Chromium verification of the KyanOS browser build.
// Run: /opt/node22/bin/node web/verify.cjs
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js');

const WEB = path.resolve(__dirname);
const url = 'file://' + path.join(WEB, 'index.html');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const logs = [];
  page.on('console', (m) => logs.push('[console.' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Sample the canvas: ensure varied, non-black pixels.
  const stats = await page.evaluate(() => {
    const c = document.getElementById('screen');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let nonblack = 0; const colors = new Set();
    for (let i = 0; i < d.length; i += 4 * 137) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (r + gg + b > 12) nonblack++;
      colors.add((r << 16) | (gg << 8) | b);
    }
    return { nonblack, distinct: colors.size, w: c.width, h: c.height };
  });
  console.log('canvas stats (initial):', JSON.stringify(stats));

  await page.screenshot({ path: path.join(WEB, '_verify_initial.png') });

  // Simulate a real click on the dock's Terminal icon (desktop ~x556,y750).
  // Map desktop coords -> page coords via the canvas bounding rect.
  const before = await page.evaluate(() => Object.keys(window.__kyan.desk.windows));
  const clickPt = await page.evaluate(() => {
    const c = document.getElementById('screen');
    const r = c.getBoundingClientRect();
    // Find the terminal dock icon's centre from the live dock layout, so
    // this stays correct as pinned apps (and the dock width) change.
    const layout = window.__kyan.desk._dock_layout();
    let icon = layout.icons.find((ic) => ic.app === 'terminal') || layout.icons[0];
    const dx = icon.x + icon.size / 2, dy = icon.y + icon.size / 2;
    return { px: r.left + dx * (r.width / c.width), py: r.top + dy * (r.height / c.height) };
  });
  await page.mouse.click(clickPt.px, clickPt.py);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => Object.keys(window.__kyan.desk.windows));
  console.log('windows before click:', JSON.stringify(before));
  console.log('windows after  click:', JSON.stringify(after));

  await page.screenshot({ path: path.join(WEB, '_verify.png') });

  const opened = after.length > before.length || (after.includes('terminal') && !before.includes('terminal'));
  console.log('--- console/page messages ---');
  logs.forEach((l) => console.log(l));
  console.log('--- result ---');
  console.log('rendered_nonblank:', stats.nonblack > 100 && stats.distinct > 20);
  console.log('click_opened_app:', opened);

  await browser.close();
  if (!(stats.nonblack > 100 && stats.distinct > 20)) { console.error('FAIL: canvas looks blank'); process.exit(2); }
  if (!opened) { console.error('FAIL: click did not open an app'); process.exit(3); }
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
