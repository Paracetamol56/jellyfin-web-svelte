import { expect, test } from '@playwright/test';
import { mockJellyfin, signIn, type MockLog } from './mock';

let log: MockLog;

test.describe('as a regular user', () => {
	test.beforeEach(async ({ page }) => {
		log = await mockJellyfin(page);
		await signIn(page);
	});

	test('queue: remove, reorder with the keyboard, play next from a track menu', async ({ page }) => {
		await page.goto('/#/item/al1');
		await page.getByRole('button', { name: 'Play all' }).click();
		const mini = page.getByRole('region', { name: 'Now playing' }).first();
		await expect(mini).toContainText('Now');

		// Play next from the ⋯ menu of a track row
		await page.getByRole('button', { name: 'More options for Daydreaming' }).click();
		await page.getByRole('menuitem', { name: 'Play next' }).click();
		await expect(page.getByRole('status').filter({ hasText: '1 track will play next' })).toBeVisible();

		await page.getByRole('link', { name: /^Open player/ }).first().focus();
		await page.keyboard.press('Enter');
		const queue = page.getByRole('region', { name: 'Queue' });
		await expect(queue).toContainText('4 tracks');
		const names = () => queue.getByRole('button', { name: /^Play / }).allInnerTexts();
		expect((await names())[1]).toContain('Daydreaming');

		// Remove the duplicate via its row menu
		await queue.getByRole('button', { name: 'More options for Daydreaming' }).first().click();
		await page.getByRole('menuitem', { name: 'Remove from queue' }).click();
		await expect(queue).toContainText('3 tracks');

		// Reorder: focus the last handle and press ArrowUp
		await queue.getByRole('button', { name: /^Reorder Daydreaming/ }).focus();
		await page.keyboard.press('ArrowUp');
		expect((await names()).map((t) => t.split('\n')[0])).toEqual(['Now', 'Daydreaming', 'Grow Up']);
		await expect(queue.getByRole('button', { name: /^Reorder Daydreaming/ })).toBeFocused();
	});

	test('save the queue as a playlist', async ({ page }) => {
		await page.goto('/#/item/al1');
		await page.getByRole('button', { name: 'Play all' }).click();
		await page.getByRole('link', { name: /^Open player/ }).first().focus();
		await page.keyboard.press('Enter');
		await page.getByRole('button', { name: 'Save queue as playlist' }).click();
		await page.getByLabel('Name').fill('Evening');
		await page.getByRole('button', { name: 'Create' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Created “Evening”' })).toBeVisible();
		const body = log.writes.find((w) => w.path === '/Playlists')?.body as { Name: string; Ids: string[] };
		expect(body).toMatchObject({ Name: 'Evening', Ids: ['t1', 't2', 't3'] });
	});

	test('right-click a card: add to an existing playlist, media info', async ({ page }) => {
		const card = page.getByRole('link', { name: /Wolf Children/ }).first();
		await card.click({ button: 'right' });
		const menu = page.getByRole('menu');
		await expect(menu.getByRole('menuitem', { name: 'Media info' })).toBeVisible();
		await expect(menu.getByRole('menuitem', { name: 'Edit metadata…' })).toHaveCount(0);
		await menu.getByRole('menuitem', { name: 'Media info' }).click();
		const dialog = page.getByRole('dialog', { name: 'Media info' });
		await expect(dialog).toContainText('Wolf Children');
		await page.keyboard.press('Escape');

		await page.goto('/#/item/m1');
		await page.getByRole('button', { name: 'More options for 5 Centimeters per Second' }).first().click();
		await page.getByRole('menuitem', { name: 'Add to playlist' }).click();
		await page.getByRole('menuitem', { name: 'Road trip' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Added to “Road trip”' })).toBeVisible();
		expect(log.writes.some((w) => w.path.startsWith('/Playlists/pl1/Items') && w.path.includes('ids=m1'))).toBe(true);
	});

	test('media info lists the streams', async ({ page }) => {
		await page.goto('/#/item/m1');
		await page.getByRole('button', { name: 'More options for 5 Centimeters per Second' }).first().click();
		await page.getByRole('menuitem', { name: 'Media info' }).click();
		const dialog = page.getByRole('dialog', { name: 'Media info' });
		await expect(dialog.getByRole('table')).toContainText('jpn');
		await expect(dialog.getByRole('table')).toContainText('1920×1080');
	});
});

test.describe('as an administrator', () => {
	test.beforeEach(async ({ page }) => {
		log = await mockJellyfin(page, { admin: true });
		await signIn(page);
	});

	test('edit metadata and delete from the item menu', async ({ page }) => {
		await page.goto('/#/item/m2');
		await page.getByRole('button', { name: 'More options for Wolf Children' }).first().click();
		await page.getByRole('menuitem', { name: 'Edit metadata…' }).click();
		const dialog = page.getByRole('dialog', { name: 'Edit metadata' });
		await dialog.getByLabel('Title', { exact: true }).fill('Wolf Children (2012)');
		await dialog.getByLabel('Genres').fill('Animation, Family');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Metadata saved' })).toBeVisible();
		const saved = log.writes.find((w) => w.method === 'POST' && w.path === '/Items/m2')?.body as { Name: string; Genres: string[] };
		expect(saved).toMatchObject({ Name: 'Wolf Children (2012)', Genres: ['Animation', 'Family'] });

		await page.getByRole('button', { name: 'More options for Wolf Children' }).first().click();
		await page.getByRole('menuitem', { name: 'Delete…' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page).toHaveURL(/#\/$/);
		expect(log.writes.some((w) => w.method === 'DELETE' && w.path === '/Items/m2')).toBe(true);
	});
});
