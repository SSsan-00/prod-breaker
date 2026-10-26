import { test, expect } from "@playwright/test";
test("complete three rounds, panic, settings, export and replay", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByLabel("演出を軽減").check();
  await page.getByRole("button", { name: "了解、ヨシ！" }).click();
  await page.getByRole("button", { name: "ミュート切替" }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  if (info.project.name === "mobile")
    await page.screenshot({
      path: "test-results/game-mobile.png",
      fullPage: true,
    });
  const started = Date.now();
  for (let round = 1; round <= 3; round++) {
    await page.locator(".card").filter({ hasText: "無限リトライ" }).click();
    await page.getByRole("button", { name: /DB ノード/ }).click();
    await page.getByRole("button", { name: "DEPLOY ↗", exact: true }).click();
    await expect(page.locator(".panic")).toBeEnabled();
    await page.locator(".panic").click();
    await expect(page.locator(".panic")).toBeDisabled();
    await page.getByRole("button", { name: "高速化 ⏩" }).click();
    await page
      .getByRole("button", {
        name: round === 3 ? "障害報告書を見る →" : "次のラウンドへ →",
      })
      .click();
  }
  await expect(page.locator(".result-score")).toBeVisible();
  await expect(page.locator(".report")).toContainText("再発防止策");
  expect(
    await page.evaluate(() =>
      Number(JSON.parse(localStorage.getItem("pb-high") || "0")),
    ),
  ).toBeGreaterThan(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "画像保存 ↓" }).click();
  expect((await download).suggestedFilename()).toBe("prod-breaker.png");
  await page.screenshot({
    path: `test-results/${info.project.name}-result.png`,
    fullPage: true,
  });
  console.log(
    `${info.project.name} measured accelerated play: ${(Date.now() - started) / 1000}s`,
  );
  await page.getByRole("button", { name: "もう一度プレイ ↻" }).click();
  await expect(page.locator(".cards")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByLabel("演出を軽減")).toBeChecked();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("normal-speed visual playthrough", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.goto("/");
  await page.screenshot({
    path: "test-results/title-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /GAME START/ }).click();
  const start = Date.now();
  for (let r = 1; r <= 3; r++) {
    await page.locator(".card").filter({ hasText: "無限リトライ" }).click();
    await page.getByRole("button", { name: /DB ノード/ }).click();
    if (r === 1)
      await page.screenshot({
        path: "test-results/game-desktop.png",
        fullPage: true,
      });
    await page.getByRole("button", { name: "DEPLOY ↗", exact: true }).click();
    await expect(page.locator(".panic")).toBeEnabled();
    await page.locator(".panic").click();
    if (r === 1) {
      await expect(page.locator(".score-pop")).toBeVisible();
      await page.screenshot({
        path: "test-results/cascade-desktop.png",
        fullPage: true,
      });
    }
    await page
      .getByRole("button", {
        name: r === 3 ? "障害報告書を見る →" : "次のラウンドへ →",
      })
      .click();
  }
  console.log(
    `NORMAL SPEED measured play: ${(Date.now() - start) / 1000}s (automated decisions, PANIC every round)`,
  );
  await expect(page.locator(".result")).toBeVisible();
});
