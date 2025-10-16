import { test, expect, type Page } from '@playwright/test';

async function addMedia(page: Page, title: string, offline = false) {
  if (offline) {
    await page.context().setOffline(true);
  }
  
  await page.getByRole('button', { name: /add media/i }).click();
  await page.getByPlaceholder('Title').fill(title);
  await page.getByRole('button', { name: /add to library/i }).click();
  
  if (offline) {
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
  } else {
    await expect(page.locator('text=' + title)).toBeVisible();
  }
}

test.describe('Offline Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should queue write when offline and sync when online', async ({ page, context }) => {
    const testTitle = `Offline Movie ${Date.now()}`;
    
    await context.setOffline(true);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.getByPlaceholder('Title').fill(testTitle);
    await page.getByRole('button', { name: /add to library/i }).click();
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
    
    await context.setOffline(false);
    
    await expect(page.locator('.sync-badge')).not.toBeVisible({ timeout: 10000 });
    
    await page.reload();
    
    await expect(page.locator('text=' + testTitle)).toBeVisible();
  });

  test('should handle offline add, close tab, reopen online', async ({ page, context, browser }) => {
    const testTitle = `Close Tab Movie ${Date.now()}`;
    
    await context.setOffline(true);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.getByPlaceholder('Title').fill(testTitle);
    await page.getByRole('button', { name: /add to library/i }).click();
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
    
    await page.close();
    
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    
    await newPage.goto('/');
    
    await expect(newPage.locator('.sync-badge')).not.toBeVisible({ timeout: 15000 });
    
    await expect(newPage.locator('text=' + testTitle)).toBeVisible();
    
    await newContext.close();
  });

  test('should not create duplicates on retry', async ({ page, context }) => {
    const testTitle = `Retry Movie ${Date.now()}`;
    
    await context.setOffline(true);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.getByPlaceholder('Title').fill(testTitle);
    await page.getByRole('button', { name: /add to library/i }).click();
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
    
    await context.setOffline(false);
    
    await expect(page.locator('.sync-badge')).not.toBeVisible({ timeout: 10000 });
    
    await page.reload();
    
    const items = page.locator(`text=${testTitle}`);
    await expect(items).toHaveCount(1);
  });

  test('should queue offline update and sync when online', async ({ page, context }) => {
    const testTitle = `Update Movie ${Date.now()}`;
    
    await addMedia(page, testTitle);
    
    await context.setOffline(true);
    
    const mediaItem = page.locator('.media-item').filter({ hasText: testTitle });
    await mediaItem.locator('select.status-select').selectOption('completed');
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
    
    await context.setOffline(false);
    
    await expect(page.locator('.sync-badge')).not.toBeVisible({ timeout: 10000 });
    
    await page.reload();
    
    const updatedItem = page.locator('.media-item').filter({ hasText: testTitle });
    await expect(updatedItem.locator('.status-badge')).toContainText('Completed');
  });

  test('should show and clear badge correctly', async ({ page, context }) => {
    const testTitle1 = `Badge Movie 1 ${Date.now()}`;
    const testTitle2 = `Badge Movie 2 ${Date.now()}`;
    
    await context.setOffline(true);
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.getByPlaceholder('Title').fill(testTitle1);
    await page.getByRole('button', { name: /add to library/i }).click();
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 1');
    
    await page.getByRole('button', { name: /add media/i }).click();
    await page.getByPlaceholder('Title').fill(testTitle2);
    await page.getByRole('button', { name: /add to library/i }).click();
    
    await expect(page.locator('.sync-badge')).toContainText('Sync pending: 2');
    
    await context.setOffline(false);
    
    await expect(page.locator('.sync-badge')).not.toBeVisible({ timeout: 15000 });
  });
});
