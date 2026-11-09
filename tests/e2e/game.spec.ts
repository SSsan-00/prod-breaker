import { test, expect, type Page } from "@playwright/test";
async function install(page: Page) {
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  if (await dialog.isVisible()) {
    const evolved = dialog.locator(".ready");
    await (
      (await evolved.count())
        ? evolved.first()
        : dialog.locator(".skill-card").first()
    ).click();
  }
}
async function advance(page: Page, ms: number) {
  for (let n = 0; n < ms; n += 200) {
    await install(page);
    await page.clock.runFor(Math.min(200, ms - n));
  }
}
async function travel(page: Page, x: number, y: number) {
  for (let n = 0; n < 80; n++) {
    await install(page);
    const arena = page.getByTestId("arena");
    const px = Number(await arena.getAttribute("data-player-x")),
      py = Number(await arena.getAttribute("data-player-y"));
    const dx = x - px,
      dy = y - py;
    if (Math.hypot(dx, dy) < 30) break;
    const key =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "ArrowRight"
          : "ArrowLeft"
        : dy > 0
          ? "ArrowDown"
          : "ArrowUp";
    await page.keyboard.down(key);
    await page.clock.runFor(160);
    await page.keyboard.up(key);
  }
  await advance(page, 3000);
}
test("home, settings and upgrades fit compact and landscape screens", async ({
  page,
}, info) => {
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  for (const size of info.project.name === "mobile"
    ? [
        { width: 320, height: 480 },
        { width: 393, height: 851 },
        { width: 851, height: 393 },
      ]
    : [{ width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    const bounds = await page.locator(".start").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: /START DEFENDING/ }).click();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "緊急遮断", exact: false }).click();
  await page.clock.runFor(200);
  await expect(page.getByTestId("arena")).toHaveAttribute(
    "data-phase",
    "playing",
  );
});
test("rescues the network, upgrades, survives a shift and retries without errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /START DEFENDING/ }).click();
  await page.clock.runFor(100);
  await travel(page, 240, 640);
  await travel(page, 240, 300);
  await travel(page, 660, 300);
  await travel(page, 660, 640);
  expect(
    Number(await page.getByTestId("arena").getAttribute("data-online")),
  ).toBe(4);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  const time = await page.getByTestId("arena").getAttribute("data-time");
  await page.clock.runFor(1000);
  expect(await page.getByTestId("arena").getAttribute("data-time")).toBe(time);
  await page.getByRole("button", { name: /防衛を再開/ }).click();
  for (let i = 0; i < 100; i++) {
    if (await page.locator(".result-content").isVisible()) break;
    await install(page);
    const panic = page.locator(".panic");
    if (await panic.isEnabled()) await panic.click();
    await page.clock.runFor(1200);
  }
  await expect(page.locator(".result-content")).toBeVisible();
  await page.screenshot({ path: info.outputPath("result.png") });
  await expect(page.locator(".result-content h1")).toContainText("動いている");
  if (info.project.name === "mobile") {
    for (const size of [
      { width: 320, height: 480 },
      { width: 851, height: 393 },
    ]) {
      await page.setViewportSize(size);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      const bounds = await page.locator(".result-actions").boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    }
  }
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: /もう一度、守る/ }).click();
  await expect(page.getByTestId("timer")).toHaveText("1:30");
});
test("actual touch movement does not open menus, and hidden tabs pause", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/");
  await page.getByRole("button", { name: /START DEFENDING/ }).click();
  const arena = page.getByTestId("arena");
  const box = (await arena.boundingBox())!;
  const before = Number(await arena.getAttribute("data-player-x"));
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width * 0.45,
    y = box.y + box.height * 0.6;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 65, y }],
  });
  await page.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(Number(await arena.getAttribute("data-player-x"))).toBeGreaterThan(
    before + 20,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
});
