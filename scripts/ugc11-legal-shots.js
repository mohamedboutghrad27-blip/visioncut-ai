/* Screenshot the new legal pages locally for visual verification. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const [route, out] of [
    ["#/privacy", "/tmp/legal-privacy.png"],
    ["#/terms", "/tmp/legal-terms.png"],
  ]) {
    await page.goto(`http://localhost:3000/${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const title = await page.title();
    console.log(`${route} -> title="${title}"`);
    await page.screenshot({ path: out });
  }
  await browser.close();
})();
