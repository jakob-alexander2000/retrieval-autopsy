import { expect, test, type Page } from "@playwright/test";

const FIRST = ["leave", "doctor", "home", "learning"] as const;
const REST = ["contractors", "scope", "overtime", "notice"] as const;

async function runQuestion(page: Page, id: string) {
  await page.getByTestId(`question-${id}`).click();
  await page.getByTestId("run").click();
  await expect(page.getByTestId("passage-keyword-0")).toBeVisible();
}

test("trap question fails qualifier and marks the dropped limit", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await runQuestion(page, "leave");
  await page.getByTestId("mode-naive").click();
  await expect(page.getByTestId("check-qualifier-status")).toHaveText("Fail");
  await expect(page.locator("mark[data-span='full-time employees only']")).toBeVisible();
  await expect(page.getByTestId("passage-keyword-0")).toContainText("full-time employees only");
  await expect(page.getByTestId("check-support-status")).toHaveText("Pass");
  await expect(page.getByTestId("check-omission-status")).toHaveText("Pass");
});

test("Run is on the first screen and the server model is absent", async ({ page }) => {
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.getByTestId("mode-cloud")).toHaveCount(0);
    await expect(page.getByText("Server model, if one is configured")).toHaveCount(0);
    const run = page.getByTestId("run");
    await expect(run).toBeVisible();
    const box = await run.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({
      path: `docs/first-screen-${size.width}x${size.height}.png`,
    });
  }
});

test("running every sample question logs no console errors", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto("/");
  await page.getByTestId("load-sample").click();
  for (const id of FIRST) await runQuestion(page, id);
  await page.getByTestId("more-questions").click();
  for (const id of REST) await runQuestion(page, id);

  await expect
    .poll(() => errors, { timeout: 5_000 })
    .toEqual([]);
  expect(errors).toEqual([]);
});
