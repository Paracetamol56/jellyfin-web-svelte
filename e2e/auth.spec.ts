import { expect, test } from '@playwright/test';
import { mockJellyfin, PASSWORD, signIn } from './mock';

test.beforeEach(async ({ page }) => {
	await mockJellyfin(page);
});

test('redirects to login and finds the server it is served from', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/#\/login$/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByText('Test Server')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible();
});

test('shows an error for a wrong password', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Username').fill('Alex');
	await page.getByLabel('Password').fill('nope');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
});

test('signs in, survives a reload, and signs out', async ({ page }) => {
	await signIn(page);
	await page.reload();
	await expect(page.getByRole('heading', { name: /Recently added in Movies/ })).toBeVisible();
	await page.getByRole('button', { name: /Account: Alex/ }).click();
	await page.getByRole('menuitem', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/#\/login$/);
	expect(PASSWORD).toBeTruthy();
});

test('signs in with Quick Connect', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Use Quick Connect' }).click();
	const qc = page.getByRole('region', { name: 'Quick Connect' });
	await expect(qc.getByText('481516')).toBeVisible();
	await expect(qc.getByRole('status')).toHaveText('Waiting for approval…');
	await expect(page.getByRole('heading', { name: /Recently added in Movies/ })).toBeVisible({ timeout: 15_000 });
	await page.reload();
	await expect(page.getByRole('heading', { name: /Recently added in Movies/ })).toBeVisible();
});

test('Quick Connect can be cancelled back to the password form', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Use Quick Connect' }).click();
	await page.getByRole('button', { name: 'Sign in with a password instead' }).click();
	await expect(page.getByLabel('Password')).toBeVisible();
});

test('approves another device from settings', async ({ page }) => {
	const log = await mockJellyfin(page);
	await signIn(page);
	await page.goto('/#/settings');
	const code = page.getByLabel('Sign in another device');
	await code.fill('999999');
	await page.getByRole('button', { name: 'Approve' }).click();
	await expect(page.getByRole('alert')).toHaveText("That code doesn't exist or has expired.");
	await code.fill('123456');
	await page.getByRole('button', { name: 'Approve' }).click();
	await expect(page.getByText('Device approved.')).toBeVisible();
	await expect(code).toHaveValue('');
	expect(log.writes.map((w) => w.path)).toContain('/QuickConnect/Authorize?code=123456');
});
