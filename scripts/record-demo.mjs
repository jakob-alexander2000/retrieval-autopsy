import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:4173";
await mkdir("docs", { recursive: true });

async function showTrap(page) {
  await page.goto(base);
  await page.getByTestId("question-leave").click();
  await page.getByTestId("mode-naive").click();
  await page.getByTestId("run").click();
  await page.getByTestId("check-qualifier-status").waitFor();
  await page.locator("mark[data-span='full-time employees only']").evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
}

const browser = await chromium.launch();

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const desktopPage = await desktop.newPage();
await showTrap(desktopPage);
await desktopPage.screenshot({ path: "docs/desktop-1440x900.png" });
await desktop.close();

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobile.newPage();
await showTrap(mobilePage);
await mobilePage.screenshot({ path: "docs/mobile-390x844.png" });
await mobile.close();

const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "docs", size: { width: 1280, height: 800 } },
});
const videoPage = await videoContext.newPage();
await videoPage.goto(base);
await videoPage.waitForTimeout(400);
await videoPage.getByTestId("question-leave").click();
await videoPage.waitForTimeout(500);
await videoPage.getByTestId("mode-naive").click();
await videoPage.waitForTimeout(400);
await videoPage.getByTestId("run").click();
await videoPage.getByTestId("check-qualifier-status").waitFor();
await videoPage.waitForTimeout(700);
await videoPage.locator("mark[data-span='full-time employees only']").evaluate((el) => {
  el.scrollIntoView({ block: "center", behavior: "smooth" });
});
await videoPage.waitForTimeout(2200);
const video = videoPage.video();
await videoContext.close();
const videoPath = await video.path();
console.log(videoPath);
await browser.close();
