import { expect, test } from "@playwright/test";
import { defaultNames } from "../../src/lib/leaderboard";

test("randomizes the player name without opening the keyboard and saves it on request", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 480 });
  await page.route("**/api/leaderboard?*", route => route.fulfill({ json: { scores: [] } }));
  await page.goto("/");
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "スコアボード" });
  const input = dialog.getByLabel("プレイヤー名");
  const previous = await input.inputValue();
  await dialog.getByRole("button", { name: "名前をランダムに変更" }).click();
  const next = await input.inputValue();
  expect(next).not.toBe(previous);
  await expect(input).not.toBeFocused();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "名前を保存" }).click();
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  await expect(page.getByLabel("プレイヤー名")).toHaveValue(next);
});

test("every random name fits the input on narrow phones", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.route("**/api/leaderboard?*", route => route.fulfill({ json: { scores: [] } }));
  await page.goto("/");
  await page.getByRole("button", { name: "スコアボード", exact: true }).click();
  const input = page.getByLabel("プレイヤー名");
  for (const width of [280, 320, 360, 390]) {
    await page.setViewportSize({ width, height: 480 });
    const measurements = await input.evaluate((element: HTMLInputElement, names) => {
      const style = getComputedStyle(element);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return names.map(name => ({ name, width: context.measureText(name).width, available }));
    }, [...defaultNames]);
    for (const { name, width: textWidth, available } of measurements)
      expect(textWidth, `${width}px: ${name}`).toBeLessThanOrEqual(available - 1);
  }
});

test("shows the hidden incident only for a rejected replay and can be dismissed", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 480 });
  await page.addInitScript(() => {
    localStorage.setItem("pb-pending-scores", JSON.stringify([{ name: "本番の破壊神", duration: 90, score: 999, runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", replay: { version: 2, seed: 42, inputs: "AAAA", upgrades: [] } }]));
  });
  await page.route("**/api/leaderboard", route => route.fulfill({ status: 400, json: { code: "REPLAY_REJECTED", error: "プレイ記録を検証できませんでした。" } }));
  await page.goto("/");
  const dialog = page.getByRole("alertdialog", { name: /ACCESS DENIED/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("その記録、見逃さない。")).toBeVisible();
  await expect(dialog.getByText("正しい記録を、持ってこい。", { exact: false })).toBeVisible();
  await expect(dialog.getByText("その数字は、ここには存在しない。", { exact: false })).toBeVisible();
  expect(await dialog.evaluate(el => {
    const box = el.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
  })).toBe(true);
  await expect(dialog).not.toContainText(/ゲーム内の演出|SIMULATION ONLY/);
  if (info.project.name === "mobile") {
    expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    expect(await dialog.locator(".integrity-face").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    expect(await dialog.locator(".integrity-eyes").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  }
  await expect(dialog.getByRole("button", { name: "画面に戻る" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /GAME START/ })).toBeVisible();
});

test("does not show the incident during a temporary service failure", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pb-pending-scores", JSON.stringify([{ name: "本番の破壊神", duration: 90, score: 999, runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", replay: { version: 1, seed: 42, inputs: "AAAA", upgrades: [] } }]));
  });
  await page.route("**/api/leaderboard", route => route.fulfill({ status: 503, json: { error: "スコアボードは現在利用できません。" } }));
  await page.goto("/");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /GAME START/ })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pb-pending-scores") || "[]").length)).toBe(1);
});

test("does not scare players retrying a legacy score without replay data", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pb-pending-scores", JSON.stringify([{ name: "本番の破壊神", duration: 90, score: 999, runId: "1f5f5190-35b4-4009-a15b-3cb46af16213" }]));
  });
  await page.route("**/api/leaderboard", route => route.fulfill({ status: 400, json: { code: "REPLAY_REJECTED" } }));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pb-pending-scores") || "[]").length)).toBe(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("pauses a running game until the incident is dismissed", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await page.getByRole("button", { name: /GAME START/ }).click();
  await page.clock.runFor(200);
  const arena = page.getByTestId("arena");
  await page.evaluate(() => window.dispatchEvent(new Event("pb:replay-rejected")));
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const stopped = await arena.getAttribute("data-time");
  await page.clock.runFor(1500);
  expect(await arena.getAttribute("data-time")).toBe(stopped);
  await dialog.getByRole("button", { name: "画面に戻る" }).click();
  await page.clock.runFor(200);
  expect(Number(await arena.getAttribute("data-time"))).toBeGreaterThan(Number(stopped));
});
