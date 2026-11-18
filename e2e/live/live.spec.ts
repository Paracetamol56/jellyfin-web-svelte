import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// Read-only smoke test against a real server. Configure .env.test.local:
//   JELLYFIN_URL=…  JELLYFIN_TEST_USER=…  JELLYFIN_TEST_PASSWORD=…
// Playback reporting is disabled so nothing is written to the account.
const env: Record<string, string> = existsSync('.env.test.local')
	? Object.fromEntries(
			readFileSync('.env.test.local', 'utf8')
				.split('\n')
				.filter((l) => l.includes('=') && !l.startsWith('#'))
				.map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
		)
	: {};

test.skip(!env.JELLYFIN_URL || !env.JELLYFIN_TEST_USER, 'no .env.test.local');

test('signs in to the real server and browses', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('jf.disablePlaybackReporting', '1'));
	await page.goto('/');
	// The page probes the default address first; once that fails it opens the server field on its own.
	const field = page.locator('#server');
	const change = page.getByRole('button', { name: 'Change server' });
	await expect(field.or(change).first()).toBeVisible({ timeout: 30_000 });
	if (!(await field.isVisible())) await change.click({ timeout: 5_000 }).catch(() => {});
	await field.fill(env.JELLYFIN_URL);
	await field.blur();
	await page.getByLabel('Username').fill(env.JELLYFIN_TEST_USER);
	await page.getByLabel('Password').fill(env.JELLYFIN_TEST_PASSWORD ?? '');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('navigation', { name: 'Libraries' })).toBeVisible({ timeout: 180_000 });
	const first = page.getByRole('navigation', { name: 'Main' }).getByRole('link').nth(1);
	await first.click();
	await expect(page.getByRole('list').getByRole('link').first()).toBeVisible({ timeout: 120_000 });
	await page.getByRole('list').getByRole('link').first().click();
	await expect(page.getByRole('region', { name: 'Overview' })).toBeVisible({ timeout: 120_000 });
});
