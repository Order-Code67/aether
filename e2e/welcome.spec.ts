import { test, expect } from "@playwright/test";

test.describe("Welcome / chrome smoke (Vite preview)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows Welcome with brand and Quick Start", async ({ page }) => {
    const welcome = page.getByTestId("welcome-screen");
    await expect(welcome).toBeVisible();
    await expect(welcome.getByTestId("welcome-brand")).toHaveText("Aether");
    await expect(page.getByTestId("welcome-quick-start")).toBeVisible();
    await expect(page.getByTestId("welcome-open-folder")).toBeVisible();
  });

  test("opens Settings from activity bar", async ({ page }) => {
    await page.getByTestId("activity-settings").click();
    const dialog = page.getByTestId("settings-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
  });

  test("opens Command Palette with Ctrl+Shift+P", async ({ page }) => {
    // Focus the app first. Chromium may swallow Playwright's Control+Shift+P
    // (browser chord), so dispatch the same keydown the app listens for.
    await page.getByTestId("welcome-screen").click();
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "p",
          code: "KeyP",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible();
    await expect(palette).toHaveAttribute("aria-label", "Command Palette");
    await expect(palette.locator("input")).toBeFocused();
  });
});
