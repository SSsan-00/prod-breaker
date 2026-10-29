import { test, expect, type Page } from "@playwright/test";
import { evolutionNames } from "../../src/game/survivor";

test("music continues through upgrade selection and stops when muted", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.addInitScript(() => {
    let starts = 0, disconnects = 0;
    Object.defineProperty(window, "musicProbe", { get: () => ({ starts, disconnects }) });
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) { starts++; return start.apply(this, args); };
    const disconnect = AudioNode.prototype.disconnect;
    Object.defineProperty(AudioNode.prototype, "disconnect", { configurable: true, writable: true,
      value: function (this: AudioNode, ...args: unknown[]) {
        if (this instanceof GainNode) disconnects++;
        return Reflect.apply(disconnect, this, args);
      },
    });
  });
  const probe = () => page.evaluate(() => Reflect.get(window, "musicProbe") as { starts: number; disconnects: number });
  await page.goto("/?seed=13");
  await page.getByRole("button", { name: "ミュート切替" }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  await expect.poll(async () => (await probe()).starts).toBeGreaterThan(0);
  await page.locator(".panic").click();
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(300);
  const before = await probe();
  expect(before.disconnects).toBe(0);
  await page.waitForTimeout(800);
  const during = await probe();
  expect(during.disconnects).toBe(0);
  expect(during.starts).toBeGreaterThan(before.starts);
  await dialog.locator(".upgrade-card").first().click();
  await expect(dialog).toBeHidden();
  expect((await probe()).disconnects).toBe(0);
  await page.getByRole("button", { name: "ミュート切替" }).click();
  await expect.poll(async () => (await probe()).disconnects).toBe(1);
  await page.getByRole("button", { name: "ミュート切替" }).click();
  const unmuted = await probe();
  await expect.poll(async () => (await probe()).starts).toBeGreaterThan(unmuted.starts);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await expect.poll(async () => (await probe()).disconnects).toBe(2);
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  const resumed = await probe();
  await expect.poll(async () => (await probe()).starts).toBeGreaterThan(resumed.starts);
});

test("canvas reuses paused frames and redraws after resize and resume", async ({ page }) => {
  await page.addInitScript(() => {
    let draws = 0;
    Object.defineProperty(window, "arenaDrawCount", { get: () => draws });
    const original = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (this.canvas.classList.contains("arena-canvas") && x === 0 && y === 0) draws++;
      return original.call(this, x, y, width, height);
    };
  });
  const draws = () => page.evaluate(() => Reflect.get(window, "arenaDrawCount") as number);
  await page.clock.install();
  await page.goto("/?seed=13");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.clock.runFor(100);
  const paused = await draws();
  expect(paused).toBeGreaterThan(0);
  await page.clock.runFor(500);
  expect(await draws()).toBe(paused);
  const previousWidth = await page.locator("canvas").evaluate(el => (el as HTMLCanvasElement).width);
  await page.setViewportSize({ width: 360, height: 740 });
  await expect.poll(() => page.locator("canvas").evaluate(el => (el as HTMLCanvasElement).width)).not.toBe(previousWidth);
  await page.clock.runFor(100);
  expect(await draws()).toBeGreaterThan(paused);
  const resized = await draws();
  await page.clock.runFor(200);
  expect(await draws()).toBe(resized);
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  await page.clock.runFor(500);
  expect(await draws()).toBeGreaterThan(resized);
});

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
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "一時停止" }).click();
    await page.getByRole("button", { name: "設定を開く →" }).click();
  } else await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByLabel("演出を軽減").check();
  if (info.project.name === "mobile") await page.getByLabel("ミュート", { exact: true }).uncheck();
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  if (info.project.name === "desktop") await page.getByRole("button", { name: "ミュート切替" }).click();
  // Let the unpiloted bug get caught, exercising the actual game-over path.
  for (let i = 0; i < 105; i++) {
    await choose(page);
    if (await page.locator(".result").isVisible()) break;
    await page.clock.runFor(1000);
  }
  await expect(page.locator(".result")).toBeVisible();
  await expect(page.locator(".report")).toContainText("再発防止策");
  await expect(page.locator(".report")).not.toContainText("POSTMORTEM");
  await expect(page.locator(".report")).not.toContainText("SEED");
  if (info.project.name === "mobile") {
    for (const viewport of [{ width: 320, height: 480 }, { width: 393, height: 851 }, { width: 851, height: 393 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.locator(".result").evaluate((el) => ({
        pageHeight: document.documentElement.scrollHeight,
        viewport: innerHeight,
        reportBottom: el.querySelector(".report")!.getBoundingClientRect().bottom,
        buttonBottom: el.querySelector("button")!.getBoundingClientRect().bottom,
        overlap: (() => { const a = el.querySelector(".report")!.getBoundingClientRect(); const b = el.querySelector("button")!.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; })(),
        reportOverflow: el.querySelector(".report")!.scrollHeight > el.querySelector(".report")!.clientHeight,
      }));
      expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewport);
      expect(layout.reportBottom).toBeLessThanOrEqual(layout.viewport);
      expect(layout.buttonBottom).toBeLessThanOrEqual(layout.viewport);
      expect(layout.reportOverflow).toBe(false);
      expect(layout.overlap).toBe(false);
    }
  }
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
  const seenWaves = new Set<string>();
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
    const cutin = page.getByTestId("wave-cutin");
    if (await cutin.isVisible()) {
      seenWaves.add(await cutin.locator("strong").innerText());
      expect(await cutin.evaluate((el) => !el.isConnected || getComputedStyle(el).pointerEvents === "none")).toBe(true);
    }
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
  expect([...seenWaves]).toEqual(expect.arrayContaining(["WAVE 02", "WAVE 03"]));
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
  const topButton = page.getByRole("button", { name: "一時停止" });
  await expect(page.getByRole("button", { name: "設定", exact: true })).toBeHidden();
  await expect(topButton).toContainText("長押し");
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
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("dialog", { name: "一時停止" })).toHaveCount(0);
  await topButton.tap();
  await expect(page.getByRole("dialog", { name: "一時停止" })).toHaveCount(0);
  const buttonBox = (await topButton.boundingBox())!;
  const touch = await context.newCDPSession(page);
  const point = {
    x: buttonBox.x + buttonBox.width / 2,
    y: buttonBox.y + buttonBox.height / 2,
    id: 3,
  };
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await page.clock.runFor(100);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.clock.runFor(100);
  await expect(page.getByRole("dialog", { name: "一時停止" })).toHaveCount(0);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x - 35 }] });
  await page.clock.runFor(700);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("dialog", { name: "一時停止" })).toHaveCount(0);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await page.clock.runFor(700);
  await expect(page.getByRole("dialog", { name: "一時停止" })).toBeVisible();
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("button", { name: "ゲームに戻る →" }).click();
  expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
  await choose(page);
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
    ["ENDLESS", "30:00"],
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
  await page.goto("/?seed=99");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "プリペアドステートメントって何？" }),
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
    await page.getByRole("button", { name: /ENDLESS/ }).click();
    await expect(page.getByRole("button", { name: /ENDLESS/ })).toHaveAttribute(
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
  await expect(page.locator(".chain-cutin")).toBeVisible();
  expect(await page.locator(".chain-cutin").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await dialog.locator(".upgrade-card").first().click();
  const centerCovered = await page.locator(".chain-cutin").evaluate((el) => {
    const box = el.getBoundingClientRect(), arena = document.querySelector("canvas")!.getBoundingClientRect();
    const x = arena.x + arena.width / 2, y = arena.y + arena.height / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
  expect(centerCovered).toBe(false);
  await expect(page.getByText("OVERDRIVE", { exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("OVERDRIVE", { exact: true })).toBeVisible();
});

test("available evolution is highlighted and selecting it unlocks the combination", async ({ page }, info) => {
  await page.clock.install();
  await page.goto("/?seed=99");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  const dialog = page.getByRole("dialog", { name: "レベルアップ" });
  await dialog.getByRole("button", { name: /プリペアドステートメントって何？/ }).click();
  await page.clock.runFor(8200);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("強化を1つ選択。選択中はゲームが止まります。" )).toHaveCount(0);
  const card = dialog.locator(".upgrade-card").filter({ has: page.getByRole("heading", { name: "SQLは文字列でつなぐ", exact: true }) });
  await expect(card).toHaveClass(/evolution-ready/);
  await expect(card).toContainText("選ぶと進化！");
  await expect(card.locator(".evolution-bonus")).toContainText("貫通+2");
  await expect(card.locator(".evolution-bonus")).toContainText("連鎖+20");
  if (info.project.name === "mobile") {
    for (const viewport of [{ width: 320, height: 480 }, { width: 320, height: 568 }, { width: 851, height: 393 }]) {
      await page.setViewportSize(viewport);
      const bounds = await dialog.evaluate((el) => ({ scroll: el.scrollHeight, height: el.clientHeight, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.height);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
      await expect(card).toBeVisible();
    }
  }
  await card.click();
  await expect(page.locator(".evolution-notice")).toContainText("SQLインジェクション発生！");
  await expect(page.locator(".evolution-bonus-notice")).toContainText("貫通+2");
  await expect(page.locator(".evolution-bonus-notice")).toContainText("連鎖+20");
  const centerCovered = await page.locator(".evolution-notice").evaluate((el) => {
    const box = el.getBoundingClientRect(), arena = document.querySelector("canvas")!.getBoundingClientRect();
    const x = arena.x + arena.width / 2, y = arena.y + arena.height / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
  expect(centerCovered).toBe(false);
});


test("all cut-in messages fit on a single line on compact screens", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.clock.install();
  await page.goto("/?seed=13");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(100);
  await page.locator(".panic").click();
  await page.clock.runFor(300);
  await expect(page.locator(".chain-cutin")).toBeVisible();
  for (const viewport of [{ width: 320, height: 480 }, { width: 393, height: 851 }, { width: 851, height: 393 }]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate((names) => {
      const arena = document.querySelector(".arena-shell")!;
      const sample = document.createElement("div");
      sample.className = "evolution-notice";
      sample.innerHTML = "<small>EVOLUTION UNLOCKED</small><strong></strong>";
      arena.appendChild(sample);
      const check = (el: Element, text: string) => {
        el.textContent = text;
        const range = document.createRange(); range.selectNodeContents(el);
        return { text, lines: range.getClientRects().length, overflow: el.scrollWidth > el.clientWidth };
      };
      const rows = ["OVERLOAD x1.25", "OVERLOAD x1.5", "SYSTEM MELTDOWN"].map(text => check(document.querySelector(".chain-cutin strong")!, text));
      rows.push(...names.map(text => check(sample.querySelector("strong")!, text)));
      sample.remove();
      return rows;
    }, [...new Set(Object.values(evolutionNames).filter((name): name is string => !!name))]);
    for (const row of result) {
      expect(row.lines, `${row.text} at ${viewport.width}x${viewport.height}`).toBe(1);
      expect(row.overflow, `${row.text} at ${viewport.width}x${viewport.height}`).toBe(false);
    }
  }
});

test("result collapse plays after the score and respects reduced motion", async ({ page }, info) => {
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  for (let i = 0; i < 110; i++) {
    await choose(page);
    if (await page.locator(".result").isVisible()) break;
    await page.clock.runFor(1000);
  }
  const result = page.locator(".result");
  await expect(result).toBeVisible();
  await expect(result.locator(".result-score")).toBeVisible();
  const impact = result.locator(".result-impact");
  const animation = await impact.evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe(info.project.name === "mobile" ? "none" : "result-collapse");
  await impact.evaluate((el) => el.getAnimations().forEach((animation) => animation.finish()));
  expect(await result.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  const transform = await impact.evaluate((el) => getComputedStyle(el).transform);
  if (info.project.name === "mobile") expect(transform).toBe("none");
  else expect(transform).not.toBe("none");
  await page.getByRole("button", { name: "もう一度プレイ ↻" }).click();
  await expect(page.getByTestId("health")).toHaveText("100 / 100");
});

test("scoreboard supports editable saved names and mode filtering", async ({ page }, info) => {
  const requests: string[] = [];
  await page.route("**/api/leaderboard?*", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ json: { scores: [{ player_name: "本番環境の破壊神", score: 12345, created_at: "2026-01-01T00:00:00Z" }] } });
  });
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "スコアボード" });
  await expect(dialog.getByText("本番環境の破壊神")).toBeVisible();
  const input = dialog.getByLabel("プレイヤー名");
  await expect(input).not.toHaveValue("");
  await expect(input).not.toBeFocused();
  await expect(dialog.getByRole("button", { name: "閉じる" })).toBeFocused();
  const layout = await dialog.evaluate((el) => {
    const label = el.querySelector(".player-name span")!;
    const range = document.createRange(); range.selectNodeContents(label);
    return { lines: range.getClientRects().length, buttonWidth: el.querySelector(".leaderboard-submit")!.getBoundingClientRect().width, dialogWidth: el.getBoundingClientRect().width };
  });
  expect(layout.lines).toBe(1);
  expect(layout.buttonWidth).toBeLessThan(layout.dialogWidth / 2);
  await input.fill("金曜日の魔術師");
  await dialog.getByRole("button", { name: "名前を保存" }).click();
  await expect(dialog.getByText("名前を保存しました。次回からこの名前で登録されます。")).toBeVisible();
  await dialog.getByRole("button", { name: "ENDLESS" }).click();
  await expect.poll(() => requests.some((url) => url.includes("duration=1800"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  await expect(page.getByLabel("プレイヤー名")).toHaveValue("金曜日の魔術師");
});

test("result score is shared automatically", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  let posted: { name: string; duration: number; score: number; runId: string } | undefined;
  await page.route("**/api/leaderboard**", async (route) => {
    if (route.request().method() === "POST") {
      posted = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { scores: posted ? [{ player_name: posted.name, score: posted.score, created_at: "2026-01-01T00:00:00Z" }] : [] } });
  });
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  await page.clock.runFor(50);
  await page.getByLabel("プレイヤー名").fill("本番の破壊神");
  await page.getByRole("button", { name: "名前を保存" }).click();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /GAME START/ }).click();
  for (let i = 0; i < 110; i++) {
    await choose(page);
    if (await page.locator(".result").isVisible()) break;
    await page.clock.runFor(1000);
  }
  await expect(page.locator(".result")).toBeVisible();
  await expect.poll(() => posted?.name).toBe("本番の破壊神");
  expect(posted?.duration).toBe(90);
  expect(posted?.score).toBeGreaterThan(0);
  expect(posted?.runId).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: /ランキング →/ }).click();
  const resultDialog = page.getByRole("dialog", { name: "スコアボード" });
  await expect(resultDialog).toBeVisible();
  const initialRunId = posted?.runId;
  await resultDialog.getByLabel("プレイヤー名").fill("新しい破壊神");
  await resultDialog.getByRole("button", { name: "名前を保存" }).click();
  await expect.poll(() => posted?.name).toBe("新しい破壊神");
  expect(posted?.runId).toBe(initialRunId);
});
