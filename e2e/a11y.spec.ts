import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockJellyfin, signIn } from './mock';

async function audit(page: Page) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
		// Design choice: lyric lines other than the current one are deliberately faded;
		// each returns to full contrast on hover/focus. Everything else is checked.
		.exclude('[data-line]:not([aria-current])')
		.analyze();
	const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
	expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
	await mockJellyfin(page);
});

test('login', async ({ page }) => {
	await page.goto('/');
	await page.getByText('Test Server').waitFor();
	await audit(page);
});

for (const scheme of ['dark', 'light'] as const) {
	test.describe(`${scheme} theme`, () => {
		test.use({ colorScheme: scheme });
		test.beforeEach(async ({ page }) => {
			await page.addInitScript((m) => localStorage.setItem('mode-watcher-mode', m), scheme);
			await signIn(page);
		});
		test('home', async ({ page }) => audit(page));
		test('movie detail', async ({ page }) => {
			await page.goto('/#/item/m1');
			await page.getByRole('heading', { name: 'Cast & crew' }).waitFor();
			await audit(page);
		});
		test('settings', async ({ page }) => {
			await page.goto('/#/settings');
			await page.getByRole('heading', { name: 'Settings' }).waitFor();
			await audit(page);
		});
	});
}

test('now playing', async ({ page }) => {
	await signIn(page);
	await page.goto('/#/item/al1');
	await page.getByRole('button', { name: 'Play all' }).click();
	await page.goto('/#/now-playing');
	await page.getByRole('button', { name: 'Second line' }).waitFor();
	await audit(page);
});
