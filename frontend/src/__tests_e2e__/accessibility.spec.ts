import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("CarboECO Accessibility Regression Tests", () => {
  test("landing page has no critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    
    // Inject and run axe accessibility scan
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
      
    const criticalViolations = results.violations.filter(v => v.impact === "critical");
    expect(criticalViolations.length).toBe(0);
  });
});
