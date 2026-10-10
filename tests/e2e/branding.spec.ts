import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("branding: supplied favicon and app icons are served with correct metadata", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="shortcut icon"]')).toHaveAttribute("href", "/favicon.ico");
  await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toBeAttached();
  const favicon = await request.get("/favicon.ico");
  expect(favicon.ok()).toBe(true);
  const ico = await favicon.body();
  expect(ico).toEqual(await readFile("documentation/logo/favicon_io/favicon.ico"));
  expect(Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + index * 16])).toEqual([16, 32, 48]);
  for (const [filename, size] of [["favicon-16.png", 16], ["favicon-32.png", 32], ["dealpatch-logo-192.png", 192], ["dealpatch-logo-512.png", 512]] as const) {
    await expect(page.locator(`link[rel="icon"][sizes="${size}x${size}"]`)).toHaveAttribute("href", `/brand/${filename}`);
    const response = await request.get(`/brand/${filename}`);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
  }
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("sizes", "180x180");
  const appleResponse = await request.get((await apple.getAttribute("href"))!);
  expect(await appleResponse.body()).toEqual(await readFile("documentation/logo/favicon_io/apple-touch-icon.png"));
  await page.reload();
  await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toBeAttached();
  expect((await request.get("/favicon.ico", { headers: { "Cache-Control": "no-cache" } })).ok()).toBe(true);
  expect(await page.locator('link[rel="icon"][href*="icon.svg"]').count()).toBe(0);
});

for (const mode of ["morning", "afternoon", "evening", "night"]) {
  test(`branding: ${mode} landing and compact workspace use the approved mark`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(mode);
    const home = page.getByRole("link", { name: "DealPatch home", exact: true });
    await expect(home).toHaveText("DealPatch");
    const landingLogo = home.locator("img");
    await expect(landingLogo).toHaveAttribute("src", "/brand/dealpatch-logo.png");
    await expect(landingLogo).toHaveAttribute("alt", "");
    await expect(landingLogo).toHaveAttribute("width", "32");
    await expect.poll(() => landingLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 64)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(landingLogo).toBeInViewport();
    await page.goto("/workspace");
    const sidebar = page.locator("aside.workspace-sidebar");
    const workspaceLogo = sidebar.locator('img[src="/brand/dealpatch-logo.png"]');
    await expect(workspaceLogo).toHaveAttribute("alt", "");
    await expect(workspaceLogo).toHaveAttribute("width", "28");
    await expect(workspaceLogo).toBeInViewport();
    await expect.poll(() => workspaceLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 64)).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(sidebar.getByText("DealPatch", { exact: true }).last()).toBeVisible();
    await expect(workspaceLogo).toBeInViewport();
  });
}
