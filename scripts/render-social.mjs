import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const artwork = await readFile("apps/web/public/social.svg", "utf8");
  await page.setContent(
    '<html><body style="margin:0">' + artwork + "</body></html>",
  );
  await page.screenshot({ path: "apps/web/public/social.png" });
  console.log("Rendered original social artwork to a 1200×630 PNG.");
} finally {
  await browser.close();
}
