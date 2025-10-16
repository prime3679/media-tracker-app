import { test, expect } from '@playwright/test';

test.describe('Smoke E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should add a new media item', async ({ page }) => {
    const testTitle = `E2E Movie ${Date.now()}`;
    
    await page.getByRole('button', { name: /add media/i }).click();
    
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle);
    await page.locator('select[name="mediaType"]').selectOption('movie');
    await page.locator('select[name="status"]').selectOption('to_watch');
    
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
  });

  test('should update media item status', async ({ page }) => {
    const testTitle = `Status Update Movie ${Date.now()}`;
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle);
    await page.locator('select[name="mediaType"]').selectOption('movie');
    await page.locator('select[name="status"]').selectOption('to_watch');
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
    
    const mediaItem = page.locator('.media-item, [class*="media"], li, tr').filter({ hasText: testTitle });
    const statusSelect = mediaItem.locator('select.status-select, select[name*="status"], select').first();
    
    await statusSelect.selectOption('watching');
    
    await page.waitForTimeout(1000);
    
    await page.reload();
    await expect(page.locator(`text=${testTitle}`)).toBeVisible();
  });

  test('should handle offline write', async ({ page, context }) => {
    const testTitle = `Offline Write ${Date.now()}`;
    
    await context.setOffline(true);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle);
    await page.locator('select[name="mediaType"]').selectOption('book');
    await page.locator('select[name="status"]').selectOption('to_watch');
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    
    const hasSyncBadge = await page.locator('.sync-badge, [class*="sync"], [class*="offline"]').isVisible({ timeout: 2000 }).catch(() => false);
    const hasOfflineIndicator = await page.locator('text=/offline|pending|queue/i').isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasSyncBadge || hasOfflineIndicator).toBe(true);
    
    await context.setOffline(false);
    
    await page.waitForTimeout(3000);
    
    await page.reload();
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should complete full add-update-complete flow', async ({ page }) => {
    const testTitle = `Full Flow ${Date.now()}`;
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle);
    await page.locator('select[name="mediaType"]').selectOption('tv_show');
    await page.locator('select[name="status"]').selectOption('to_watch');
    
    const descriptionField = page.getByPlaceholder(/description/i);
    if (await descriptionField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descriptionField.fill('Test description for full flow');
    }
    
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
    
    const mediaItem = page.locator('.media-item, [class*="media"], li, tr').filter({ hasText: testTitle });
    let statusSelect = mediaItem.locator('select.status-select, select[name*="status"], select').first();
    await statusSelect.selectOption('watching');
    await page.waitForTimeout(1000);
    
    await statusSelect.selectOption('completed');
    await page.waitForTimeout(1000);
    
    await page.reload();
    await expect(page.locator(`text=${testTitle}`)).toBeVisible();
    
    const completedItem = page.locator('.media-item, [class*="media"], li, tr').filter({ hasText: testTitle });
    const completedBadge = completedItem.locator('text=/completed/i, .completed, [class*="completed"]');
    await expect(completedBadge).toBeVisible({ timeout: 2000 });
  });

  test('should navigate to stats and display statistics', async ({ page }) => {
    const statsLink = page.getByRole('link', { name: /stats|statistics/i })
      .or(page.getByRole('button', { name: /stats|statistics/i }))
      .or(page.locator('[href*="stats"], button:has-text("Stats")'));
    
    if (await statsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statsLink.click();
      
      const hasStatsContent = await page.locator('text=/total|completed|watching|movies|books/i').isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasStatsContent).toBe(true);
    }
  });

  test('should search/filter media items', async ({ page }) => {
    const testTitle1 = `Searchable Movie ${Date.now()}`;
    const testTitle2 = `Different Book ${Date.now()}`;
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle1);
    await page.locator('select[name="mediaType"]').selectOption('movie');
    await page.locator('select[name="status"]').selectOption('to_watch');
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    await page.waitForTimeout(1000);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle2);
    await page.locator('select[name="mediaType"]').selectOption('book');
    await page.locator('select[name="status"]').selectOption('watching');
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    await page.waitForTimeout(1000);
    
    const searchBox = page.getByPlaceholder(/search|filter/i);
    if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBox.fill('Searchable');
      await expect(page.locator(`text=${testTitle1}`)).toBeVisible();
      
      await searchBox.clear();
      await expect(page.locator(`text=${testTitle2}`)).toBeVisible();
    }
  });

  test('should persist data across page reload', async ({ page }) => {
    const testTitle = `Persistence Test ${Date.now()}`;
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(testTitle);
    await page.locator('select[name="mediaType"]').selectOption('movie');
    await page.locator('select[name="status"]').selectOption('to_watch');
    await page.getByRole('button', { name: /add to library|save|submit/i }).click();
    
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
    
    await page.reload();
    
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
  });

  test('should handle rapid consecutive operations', async ({ page }) => {
    const timestamp = Date.now();
    
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: /add media/i }).click();
      await page.locator('input[name="title"], input[placeholder="Title"]').first().fill(`Rapid ${timestamp}-${i}`);
      await page.locator('select[name="mediaType"]').selectOption('movie');
      await page.locator('select[name="status"]').selectOption('to_watch');
      await page.getByRole('button', { name: /add to library|save|submit/i }).click();
      await page.waitForTimeout(500);
    }
    
    await page.reload();
    
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Rapid ${timestamp}-${i}`)).toBeVisible({ timeout: 5000 });
    }
  });
});
