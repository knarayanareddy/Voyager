import { test, expect } from '@playwright/test';

test.describe('Voyager E2E Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Pipe browser console logs and errors to terminal
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Automatically accept any dialogs (like alerts, prompts, or confirmations)
    page.on('dialog', dialog => dialog.accept());
    
    // Navigate to the app
    await page.goto('/');
    await expect(page.locator('#voyager-app')).toBeVisible();
  });

  test('should support page creation, block editing, linking, rename, and immediate reload persistence', async ({ page }) => {
    // 1. Page Creation - Page A
    const plusButton = page.locator('button:has(svg.lucide-plus)').first();
    await plusButton.click({ force: true });

    const modalInput = page.locator('input[placeholder="Page name..."]');
    await expect(modalInput).toBeVisible();

    await modalInput.fill('Page A');
    await page.click('button:has-text("Create")', { force: true });

    const pageHeader = page.locator('span.truncate').first();
    await expect(pageHeader).toHaveText('Page A');

    // 2. Block Editing & Linking (Page A -> Page B)
    const blockContent = page.locator('.cursor-text:has-text("Page A")').first();
    await blockContent.dblclick({ force: true });

    const textarea = page.locator('textarea');
    await textarea.fill('Hello this is a link to [[Page B]]');
    await textarea.press('Enter');

    // Verify wikilink is visible
    const linkElement = page.locator('button.text-indigo-400', { hasText: 'Page B' });
    await expect(linkElement).toBeVisible();

    // Click link to navigate to Page B (which gets created automatically on navigation)
    await linkElement.click({ force: true });
    await expect(pageHeader).toHaveText('Page B');

    // Write in Page B linking back to Page A
    const blockContentB = page.locator('.cursor-text:has-text("Page B")').first();
    await blockContentB.dblclick({ force: true });
    await textarea.fill('This is Page B linking back to [[Page A]]');
    await textarea.press('Enter');

    // 3. Page Rename
    // Go to Pages view
    await page.locator('button:has-text("Pages")').first().evaluate(el => (el as HTMLElement).click());

    // Wait for Page A to be visible in the list
    const pageARow = page.locator('div.group', { has: page.locator('span', { hasText: /^Page A$/ }) }).first();
    await expect(pageARow).toBeVisible();
    
    // Click edit/rename button programmatically
    const renameButton = pageARow.locator('button').first();
    await renameButton.evaluate(el => (el as HTMLElement).click());
    
    // Wait for input to appear (excluding search input) and edit name
    const renameInput = page.locator('input:not([placeholder="Search pages..."])').first();
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Renamed Page A');
    await renameInput.press('Enter');

    // Expect to see the updated name in the list
    await expect(page.locator('span:has-text("Renamed Page A")').first()).toBeVisible();

    // 4. Immediate Reload
    await page.reload();
    await expect(page.locator('#voyager-app')).toBeVisible();

    // 5. Verify Persistence & Backlinks after immediate reload
    // Go to Pages view
    await page.locator('button:has-text("Pages")').first().evaluate(el => (el as HTMLElement).click());
    await expect(page.locator('span:has-text("Renamed Page A")').first()).toBeVisible();

    // Click Page B in the list
    await page.click('span:has-text("Page B")', { force: true });

    // Verify Page B has the updated link text "Renamed Page A"
    const blockLinkElement = page.locator('button.text-indigo-400', { hasText: 'Renamed Page A' });
    await expect(blockLinkElement).toBeVisible();
  });
});
