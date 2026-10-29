import { expect, test } from "@playwright/test";

test("trap question fails qualifier and marks the dropped limit", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await page.getByTestId("question-leave").click();
  await page.getByTestId("mode-naive").click();
  await page.getByTestId("run").click();
  await expect(page.getByTestId("check-qualifier-status")).toHaveText("Fail");
  await expect(page.locator("mark[data-span='full-time employees only']")).toBeVisible();
  await expect(page.getByTestId("passage-keyword-0")).toContainText("full-time employees only");
  await expect(page.getByTestId("check-support-status")).toHaveText("Pass");
  await expect(page.getByTestId("check-omission-status")).toHaveText("Pass");
});
