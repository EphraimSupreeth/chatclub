import { expect, test } from '@playwright/test';

test('opens the moderated classroom demo and safety centre', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Connect ChatClub to Supabase' })).toBeVisible();
  await page.getByRole('button', { name: 'View interface demo' }).click();
  await page.getByLabel('Class code').fill('DEMO-10A');
  await page.getByRole('button', { name: 'Enter class demo' }).click();

  await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await expect(page.getByText('Remember our class agreement:')).toBeVisible();

  await page.getByRole('button', { name: 'Calls' }).click();
  await expect(page.getByRole('heading', { name: 'Calls', exact: true })).toBeVisible();
  await expect(page.getByText('No calls yet')).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Safety/ }).click();
  await expect(page.getByRole('heading', { name: 'Safety', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Report a concern' })).toBeVisible();

  await page.getByRole('button', { name: 'Return to ChatClub messages' }).click();
  await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
