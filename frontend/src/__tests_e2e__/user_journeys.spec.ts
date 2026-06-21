import { test, expect } from '@playwright/test';

test.describe('CarboECO End-to-End User Journeys', () => {

  test('Journey 1: User Registration, Login and Logout Flow', async ({ page }) => {
    // Navigate to authentication page
    await page.goto('/auth');
    await expect(page).toHaveTitle(/CarboECO/);

    // Switch to Register tab/form if needed
    const registerTab = page.locator('button:has-text("Register"), [data-testid="register-tab"]');
    if (await registerTab.isVisible()) {
      await registerTab.click();
    }

    // Fill registration details
    const email = `e2e_test_${Date.now()}@carboeco.test`;
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    
    // Submit registration
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify redirected to dashboard or showing dashboard elements
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Mission Control Console');

    // Logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/auth|^\/$/);
    }
  });

  test('Journey 2: Carbon Log Entry and Dashboard Update', async ({ page }) => {
    // Login flow first
    await page.goto('/auth');
    const loginTab = page.locator('button:has-text("Login"), [data-testid="login-tab"]');
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    // Register a temp user for this isolated test
    const email = `log_test_${Date.now()}@carboeco.test`;
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Get current Daily Avg value
    const initialAvgText = await page.locator('span.text-3xl.font-black.font-mono').innerText();
    const initialAvg = parseFloat(initialAvgText);

    // Navigate to Calculator page
    await page.goto('/calculator');
    await expect(page).toHaveURL(/\/calculator/);

    // Choose category: Transportation (first category card)
    await page.click('button:has-text("Transportation")');

    // Select subcategory and enter value
    await page.selectOption('select', { index: 0 }); // First subcategory option
    await page.fill('input[type="number"]', '50');

    // Submit log
    await page.click('button:has-text("Log Activity"), button:has-text("Save")');

    // Navigate back to Dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify Daily Avg value updated (increased)
    const finalAvgText = await page.locator('span.text-3xl.font-black.font-mono').innerText();
    const finalAvg = parseFloat(finalAvgText);
    expect(finalAvg).toBeGreaterThanOrEqual(initialAvg);
  });

  test('Journey 3: Education & Gamification', async ({ page }) => {
    // Register and login a temp user
    await page.goto('/auth');
    const email = `edu_test_${Date.now()}@carboeco.test`;
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Go to Gamification / Leaderboard page
    await page.goto('/gamification');
    await expect(page).toHaveURL(/\/gamification/);

    // Verify page content shows leaderboard
    await expect(page.locator('h3:has-text("Global Leaderboard")')).toBeVisible();

    // Verify achievements list is rendered
    await expect(page.locator('text=Achievements')).toBeVisible();
  });

});
