import { test, expect } from '@playwright/test';

test.describe('Voyager E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Pipe browser console logs and errors to terminal
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Automatically accept any dialogs (like alerts, prompts, or confirmations)
    page.on('dialog', dialog => dialog.accept());
    
    // Navigate to the app (Playwright starts the webServer automatically)
    await page.goto('/');
    // Check if the app container is present
    await expect(page.locator('#voyager-app')).toBeVisible();
  });

  test('should support page creation, block editing, linking, media attachments, and page rename with persistence', async ({ page }) => {
    // 1. Page Creation
    // Find the Plus button in the header and click it
    const plusButton = page.locator('button:has(svg.lucide-plus)').first();
    await plusButton.click({ force: true });

    // The modal should be visible
    const modalInput = page.locator('input[placeholder="Page name..."]');
    await expect(modalInput).toBeVisible();

    // Type a page name and click create
    await modalInput.fill('Page A');
    await page.click('button:has-text("Create")', { force: true });

    // Page A should be the active page header
    const pageHeader = page.locator('span.truncate').first();
    await expect(pageHeader).toHaveText('Page A');

    // 2. Block Editing & Linking
    // Double click the heading Page A to edit the block
    const blockContent = page.locator('.cursor-text:has-text("Page A")').first();
    await blockContent.dblclick({ force: true });

    // Input link [[Page B]] in the textarea
    const textarea = page.locator('textarea');
    await textarea.fill('Hello this is a link to [[Page B]]');
    await textarea.press('Enter');

    // The block should now render with the link
    const linkElement = page.locator('button.text-indigo-400', { hasText: 'Page B' });
    await expect(linkElement).toBeVisible();

    // Click the link [[Page B]] to navigate to Page B
    await linkElement.click({ force: true });

    // Page B should be the active page
    await expect(pageHeader).toHaveText('Page B');

    // Double-click to write in Page B
    const blockContentB = page.locator('.cursor-text:has-text("Page B")').first();
    await blockContentB.dblclick({ force: true });
    await textarea.fill('This is Page B linking back to [[Page A]]');
    await textarea.press('Enter');

    // 3. Media Attachment (S-Pen Screen Write)
    // Click the S-Pen slot button on the phone frame
    const spenButton = page.locator('button[title*="S-Pen"]');
    await spenButton.click({ force: true });

    // Click Screen Write
    await page.click('button:has-text("Screen Write")', { force: true });

    // Canvas should be visible
    const drawingCanvas = page.locator('canvas.absolute.inset-0');
    await expect(drawingCanvas).toBeVisible();

    // Click Save to Journal
    await page.click('button:has-text("Save to Journal")', { force: true });

    // Wait for S-Pen overlay to fully close
    await expect(page.locator('button:has-text("Save to Journal")')).toBeHidden();

    // Verify media markdown reference was inserted and visual element is rendered
    await expect(page.locator('img[alt="S-Pen Drawing"]')).toBeVisible();

    // 4. Graph View check
    // Click the Graph tab in bottom navigation
    await page.locator('button:has-text("Graph")').first().evaluate(el => (el as HTMLElement).click());
    // Canvas for graph should be visible
    await expect(page.locator('canvas')).toBeVisible();

    // 5. Page Rename
    // Go to All Pages view
    await page.locator('button:has-text("Pages")').first().evaluate(el => (el as HTMLElement).click());

    // Wait for Page A to be visible in the list
    const pageARow = page.locator('div.group', { has: page.locator('span', { hasText: /^Page A$/ }) }).first();
    await expect(pageARow).toBeVisible();
    
    // Find the edit/rename button in that row and click it programmatically to bypass overlays
    const renameButton = pageARow.locator('button').first();
    await renameButton.evaluate(el => (el as HTMLElement).click());
    
    // Wait for the input to appear (excluding the search input)
    const renameInput = page.locator('input:not([placeholder="Search pages..."])').first();
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Renamed Page A');
    await renameInput.press('Enter');

    // The list should now display "Renamed Page A"
    await expect(page.locator('span:has-text("Renamed Page A")').first()).toBeVisible();

    // 6. Reload and Verify Persistence
    await page.reload();
    await expect(page.locator('#voyager-app')).toBeVisible();

    // Go to Pages list and check if "Renamed Page A" exists
    await page.locator('button:has-text("Pages")').first().evaluate(el => (el as HTMLElement).click());
    await expect(page.locator('span:has-text("Renamed Page A")').first()).toBeVisible();

    // Navigate to Page B and check its backlinks/references
    await page.click('span:has-text("Page B")', { force: true });
    // Ensure the block link has been updated from [[Page A]] to [[Renamed Page A]]
    const blockLinkElement = page.locator('button.text-indigo-400', { hasText: 'Renamed Page A' });
    await expect(blockLinkElement).toBeVisible();

    // Check that "Renamed Page A" still has the media attachments in DB
    await page.click('span:has-text("Renamed Page A")', { force: true });
    await expect(page.locator('img[alt="S-Pen Drawing"]')).toBeVisible();
  });
});
