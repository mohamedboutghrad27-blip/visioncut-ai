const { chromium } = require("/home/z/.npm-global/lib/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shots = [
    ["https://visioncut-ai-mu.vercel.app/#/download", "/home/z/my-project/download/site-preview/live-download-page.png"],
    ["https://visioncut-ai-mu.vercel.app/#/mcp", "/home/z/my-project/download/site-preview/live-mcp-page.png"],
    ["https://visioncut-ai-mu.vercel.app/", "/home/z/my-project/download/site-preview/live-landing.png"],
  ];
  for (const [url, out] of shots) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out, fullPage: true });
    console.log("saved", out);
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
