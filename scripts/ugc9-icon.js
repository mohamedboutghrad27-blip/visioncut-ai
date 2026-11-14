/* Render the VisionCut desktop icon (512px) via global playwright. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.goto("file:///home/z/my-project/scripts/ugc-icon.html");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/home/z/my-project/desktop/build/icon.png", omitBackground: true });
  await browser.close();
  console.log("icon written");
})();
