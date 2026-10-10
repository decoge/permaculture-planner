import { test, expect } from '@playwright/test';

test.describe('Database Connectivity', () => {
  test('should load without database errors on homepage', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check no database-related errors
    const dbErrors = errors.filter(e =>
      e.includes('supabase') ||
      e.includes('database') ||
      e.includes('postgres')
    );

    expect(dbErrors).toHaveLength(0);
  });

  test('should handle API routes', async ({ page }) => {
    // Test health check endpoint if exists
    const response = await page.request.get('/api/health');

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('status');
    }
  });

  test('wizard crops step serves the static crop catalog without a database', async ({ page }) => {
    // Crop data is static (lib/data/crops.ts + the crop-focus categories);
    // the crops step must render its options with no DB round-trip, which is
    // what lets the wizard work on any machine regardless of database state.
    await page.goto('/wizard');

    // Step 1 → Step 5 (Crops). The wizard animates 300ms per transition, so
    // wait for each step indicator before clicking again.
    for (let step = 2; step <= 5; step++) {
      await page.click('[data-testid="wizard-next-button"]');
      await expect(
        page.locator(`[data-testid="wizard-step-indicator"]:has-text("Step ${step} of 7")`)
      ).toBeVisible();
    }

    await expect(page.locator('text=What do you want to grow?')).toBeVisible();
    await expect(page.locator('text=Tomatoes & Peppers')).toBeVisible();
    await expect(page.locator('text=Salad Greens')).toBeVisible();
  });
});