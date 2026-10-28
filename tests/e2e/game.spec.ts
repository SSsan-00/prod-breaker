import { test, expect, type Page } from "@playwright/test";
async function choose(page: Page) {
  for (let i = 0; i < 12; i++) {
    const dialog = page.getByRole("dialog", { name: "レベルアップ" });
    if (!(await dialog.isVisible())) return;
    const cards = dialog.locator(".upgrade-card");
    const heal = cards.filter({
      has: page.locator("h3", { hasText: "私の環境では動く" }),
    });
    await ((await heal.count()) ? heal : cards.first()).click();
    await page.clock.runFor(100);
  }
}
async function drag(page: Page, dx: number, dy: number) {
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.65;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy);
}
test("real-time movement, auto fire, upgrades, panic, pause, saved settings and replay", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await expect(page.getByText("SURVIVOR EDITION")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-title-v2.png`,
    fullPage: true,
  });
  await expect(page.getByRole("button", { name: /STANDARD/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /CHAOS/ }).click();
  await expect(page.getByRole("button", { name: /CHAOS/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await expect(page.getByTestId("timer")).toHaveText("1:30");
  if (info.project.name === "mobile") {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(
      await page
        .locator(".panic")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
  }

  const x = Number(
    await page.getByTestId("arena").getAttribute("data-player-x"),
  );
  if (info.project.name === "desktop") {
    await page.keyboard.down("d");
    await page.clock.runFor(650);
    await page.keyboard.up("d");
  } else {
    await drag(page, 70, 0);
    await page.clock.runFor(650);
    await page.mouse.up();
  }
  expect(
    Number(await page.getByTestId("arena").getAttribute("data-player-x")),
  ).toBeGreaterThan(x + 60);
  await page.getByRole("button", { name: "一時停止" }).click();
  const paused = await page.getByTestId("arena").getAttribute("data-time");
  await page.clock.runFor(2000);
  expect(await page.getByTestId("arena").getAttribute("data-time")).toBe(
    paused,
  );
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  await page.getByRole("button", { name: /PANIC \/ 緊急マージ/ }).click();
  await page.clock.runFor(250);
  await expect(
    page.getByRole("dialog", { name: "レベルアップ" }),
  ).toBeVisible();
  expect(Number(await page.getByTestId("level").innerText())).toBeGreaterThan(
    1,
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-upgrades-v2.png`,
    fullPage: true,
  });
  const levelTime = await page.getByTestId("arena").getAttribute("data-time");
  await page.clock.runFor(1000);
  expect(await page.getByTestId("arena").getAttribute("data-time")).toBe(
    levelTime,
  );
  await choose(page);
  await page.clock.runFor(100);
  await choose(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-arena-v2.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByLabel("演出を軽減").check();
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  await page.getByRole("button", { name: "ミュート切替" }).click();
  // Let the unpiloted bug get caught, exercising the actual game-over path.
  for (let i = 0; i < 105; i++) {
    await choose(page);
    if (await page.locator(".result").isVisible()) break;
    await page.clock.runFor(1000);
  }
  await expect(page.locator(".result")).toBeVisible();
  await expect(page.locator(".report")).toContainText("再発防止策");
  expect(
    await page.evaluate(() =>
      Number(JSON.parse(localStorage.getItem("pb-survivor-high-90") || "0")),
    ),
  ).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /画像保存|共有/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".inventory")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-result-v2.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "もう一度プレイ ↻" }).click();
  await expect(page.getByTestId("health")).toHaveText("100 / 100");
  await page.reload();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByLabel("演出を軽減")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("90-second moving run reaches wave 3 with bounded rendering and no browser errors", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/?seed=177");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  let maxTime = 0;
  for (let i = 0; i < 110; i++) {
    await choose(page);
    if (await page.locator(".result").isVisible()) break;
    const panic = page.locator(".panic");
    if ((await panic.count()) && (await panic.isEnabled())) {
      await page.keyboard.press("Space");
      await page.clock.runFor(100);
      await choose(page);
    }
    const keys = ["d", "s", "a", "w"];
    const key = keys[Math.floor(i / 5) % 4];
    await page.keyboard.down(key);
    await page.clock.runFor(1000);
    await page.keyboard.up(key);
    const elapsed = await page
      .getByTestId("arena")
      .evaluateAll(
        (elements) => elements[0]?.getAttribute("data-time") ?? null,
      );
    if (elapsed !== null) maxTime = Number(elapsed);
    else if (await page.locator(".result").isVisible()) {
      maxTime = parseFloat(await page.locator(".stats b").first().innerText());
      break;
    }
  }
  console.log(`Survivor moving run simulated ${maxTime.toFixed(1)} seconds`);
  await expect(page.locator(".result")).toBeVisible();
  await expect(page.locator(".result-title")).toContainText("90 SECONDS.");
  await page.screenshot({
    path: "test-results/victory-v2.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("actual touch input and hidden-tab pause", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.clock.install();
  await page.goto("/?seed=4");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  const topButton = page.getByRole("button", { name: "ミュート切替" });
  expect(
    await topButton.evaluate((el) => getComputedStyle(el).userSelect),
  ).toBe("none");
  expect(
    await topButton.evaluate((el) =>
      el.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(false);
  expect(
    await page
      .locator("canvas")
      .evaluate((el) =>
        el.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        ),
      ),
  ).toBe(false);
  const buttonBox = (await topButton.boundingBox())!;
  const touch = await context.newCDPSession(page);
  const point = {
    x: buttonBox.x + buttonBox.width / 2,
    y: buttonBox.y + buttonBox.height / 2,
    id: 3,
  };
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await page.clock.runFor(900);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.clock.runFor(100);
  expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
  await expect(topButton).toContainText("SOUND ON");
  const initial = Number(
    await page.getByTestId("arena").getAttribute("data-player-x"),
  );
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width * 0.4,
    y = box.y + box.height * 0.6;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 65, y, id: 1 }],
  });
  await page.clock.runFor(500);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    Number(await page.getByTestId("arena").getAttribute("data-player-x")),
  ).toBeGreaterThan(initial + 40);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = await page.getByTestId("arena").getAttribute("data-time");
  await page.clock.runFor(2000);
  expect(await page.getByTestId("arena").getAttribute("data-time")).toBe(
    paused,
  );
  await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  await page.clock.runFor(200);
  await choose(page);
  await page.clock.runFor(200);
  expect(
    Number(await page.getByTestId("arena").getAttribute("data-time")),
  ).toBeGreaterThan(Number(paused));
});
test("duration choices start the correct timer", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  for (const [name, timer] of [
    ["STANDARD", "3:00"],
    ["CHAOS", "5:00"],
    ["QUICK", "1:30"],
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: /GAME START/ }).click();
    await page.clock.runFor(100);
    await expect(page.getByTestId("timer")).toHaveText(timer);
    await page.getByRole("button", { name: "一時停止" }).click();
    await page.getByRole("button", { name: "タイトルへ戻る →" }).click();
  }
});
test("landscape touch viewport keeps the playfield and PANIC on screen", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/?seed=42");
  await page.getByRole("button", { name: /GAME START/ }).click();
  await expect(page.getByTestId("timer")).toHaveText("3:00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".panic")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  expect((await page.locator("canvas").boundingBox())!.height).toBeGreaterThan(
    75,
  );
});
test("long upgrade names fit a compact touch screen without vertical scrolling", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install();
  await page.goto("/?seed=13");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "承認待ちのまま緊急リリース" }),
  ).toBeVisible();
  const dimensions = await dialog.evaluate((el) => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
    bottom: el.getBoundingClientRect().bottom,
    viewport: innerHeight,
    buttons: [...el.querySelectorAll("button")].map(
      (button) => button.getBoundingClientRect().bottom,
    ),
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewport);
  expect(Math.max(...dimensions.buttons)).toBeLessThanOrEqual(
    dimensions.viewport,
  );
  await dialog.locator(".upgrade-card").last().click();
});
test("long upgrade names fit a landscape touch screen without vertical scrolling", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 851, height: 393 });
  await page.clock.install();
  await page.goto("/?seed=3855");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await expect(dialog).toBeVisible();
  const dimensions = await dialog.evaluate((el) => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
    bottom: el.getBoundingClientRect().bottom,
    viewport: innerHeight,
    buttons: [...el.querySelectorAll("button")].map(
      (button) => button.getBoundingClientRect().bottom,
    ),
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewport);
  expect(Math.max(...dimensions.buttons)).toBeLessThanOrEqual(
    dimensions.viewport,
  );
});
test("home controls fit without vertical scrolling on compact and landscape phones", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  for (const viewport of [
    { width: 320, height: 480 },
    { width: 320, height: 568 },
    { width: 393, height: 851 },
    { width: 851, height: 393 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?seed=42");
    await page.screenshot({
      path: `test-results/home-${viewport.width}x${viewport.height}.png`,
    });
    await expect(
      page.getByRole("img", { name: "ゲームの主人公、暴走バグ" }),
    ).toBeVisible();
    const mascot = await page.locator(".pixel-bug").boundingBox();
    expect(mascot).not.toBeNull();
    expect(mascot!.x).toBeGreaterThanOrEqual(0);
    expect(mascot!.y).toBeGreaterThanOrEqual(0);
    expect(mascot!.x + mascot!.width).toBeLessThanOrEqual(viewport.width);
    expect(mascot!.y + mascot!.height).toBeLessThanOrEqual(viewport.height);
    const overlapsControl = await page.evaluate(() => {
      const bug = document.querySelector(".pixel-bug")!.getBoundingClientRect();
      return [
        ...document.querySelectorAll(
          ".title-screen button, .site-header button",
        ),
      ].some((el) => {
        const button = el.getBoundingClientRect();
        return (
          bug.left < button.right &&
          bug.right > button.left &&
          bug.top < button.bottom &&
          bug.bottom > button.top
        );
      });
    });
    expect(overlapsControl).toBe(false);
    await expect(
      page.getByRole("button", { name: /GAME START/ }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      viewport: innerHeight,
      controls: [
        ...document.querySelectorAll(
          ".title-screen button, .site-header button",
        ),
      ].map((el) => ({
        top: el.getBoundingClientRect().top,
        bottom: el.getBoundingClientRect().bottom,
      })),
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    expect(
      Math.min(...dimensions.controls.map((c) => c.top)),
    ).toBeGreaterThanOrEqual(0);
    expect(
      Math.max(...dimensions.controls.map((c) => c.bottom)),
    ).toBeLessThanOrEqual(dimensions.viewport);
    await page.getByRole("button", { name: /CHAOS/ }).click();
    await expect(page.getByRole("button", { name: /CHAOS/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
});
test("gameplay omits the redundant instruction and keeps PANIC accessible", async ({
  page,
}, info) => {
  await page.goto("/?seed=42");
  await page.getByRole("button", { name: /GAME START/ }).click();
  await expect(
    page.getByText("移動だけに集中。攻撃はバグに任せよう。"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /PANIC/ })).toBeVisible();
  if (info.project.name === "mobile") {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".panic")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
  }
  if (info.project.name === "desktop")
    await page.screenshot({
      path: "test-results/game-no-instruction.png",
      fullPage: true,
    });
});
test("home mascot stays visible, respects reduced motion and does not obstruct starting", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?seed=42");
  await expect(
    page.getByRole("img", { name: "ゲームの主人公、暴走バグ" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".pixel-bug")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.screenshot({
    path: `test-results/mascot-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /GAME START/ }).click();
  await expect(page.getByTestId("timer")).toBeVisible();
});

test("chain milestone triggers a visible overdrive without another pause", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?seed=13");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await expect(dialog).toBeVisible();
  await dialog.locator(".upgrade-card").first().click();
  await expect(page.getByText("OVERDRIVE", { exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("OVERDRIVE", { exact: true })).toBeVisible();
});
