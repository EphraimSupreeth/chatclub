import { expect, test } from '@playwright/test';

test('opens the moderated classroom demo and safety centre', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Connect ChatClub to Supabase' })).toBeVisible();
  await page.getByRole('button', { name: 'View interface demo' }).click();
  await page.getByLabel('Class code').fill('DEMO-10A');
  await page.getByRole('button', { name: 'Enter class demo' }).click();

  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByText('Remember our class agreement:')).toBeVisible();

  await page.getByRole('button', { name: 'Safety centre' }).click();
  await expect(page.getByRole('heading', { name: 'Safety centre' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Report a concern' })).toBeVisible();
});
