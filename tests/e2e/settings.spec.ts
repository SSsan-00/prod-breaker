import { test, expect } from "@playwright/test";
test("settings persist, reduced motion stops mascot movement, and dialogs trap focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "設定" });
  const motion = dialog
    .locator("label")
    .filter({ hasText: "演出を軽減" })
    .getByRole("button");
  if ((await motion.textContent()) === "OFF") await motion.click();
  await expect(page.locator("main")).toHaveClass(/reduced/);
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.reload();
  await expect(page.locator("main")).toHaveClass(/reduced/);
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("button", { name: "閉じる" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(motion).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
test("blocked localStorage does not stop a shift", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /QUICK/ }).click();
  await page.getByRole("button", { name: /START DEFENDING/ }).click();
  await expect(page.getByTestId("arena")).toBeVisible();
});
