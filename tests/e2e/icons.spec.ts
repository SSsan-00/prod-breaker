import { expect, test } from "@playwright/test";

test("provides the bug icon for browser tabs and mobile home screens", async ({ page, request }) => {
  await page.goto("/");
  const icon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  const apple = page.locator('link[rel="apple-touch-icon"]');
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(icon).toHaveCount(1);
  await expect(apple).toHaveAttribute("sizes", "180x180");
  const iconUrl = await icon.getAttribute("href");
  const appleUrl = await apple.getAttribute("href");
  const manifestUrl = await manifestLink.getAttribute("href");
  expect(iconUrl).toBeTruthy();
  expect(appleUrl).toBeTruthy();
  expect(manifestUrl).toBeTruthy();
  const svg = await request.get(iconUrl!);
  expect(svg.ok()).toBe(true);
  expect(await svg.text()).toContain('viewBox="0 0 180 220"');
  const touchIcon = await request.get(appleUrl!);
  expect(touchIcon.ok()).toBe(true);
  const manifestResponse = await request.get(manifestUrl!);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("PROD BREAKER SURVIVOR");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/icon-512.png", sizes: "512x512", purpose: "maskable" }),
  ]));
  for (const [url, size] of [["/icon-192.png", 192], ["/icon-512.png", 512]] as const) {
    const dimensions = await page.evaluate(async (src) => {
      const image = await createImageBitmap(await (await fetch(src)).blob());
      return [image.width, image.height];
    }, url);
    expect(dimensions).toEqual([size, size]);
  }
});

test("includes the bug icon in X and Open Graph share previews", async ({ page }) => {
  await page.goto("/");
  const image = "https://prod-breaker.vercel.app/icon-512.png";
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", image);
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute("content", "PROD BREAKERの暴走バグ");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", image);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /PROD BREAKER/);
});
