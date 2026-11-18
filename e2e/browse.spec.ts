import { expect, test } from '@playwright/test';
import { mockJellyfin, signIn } from './mock';

test.beforeEach(async ({ page }) => {
	await mockJellyfin(page);
	await signIn(page);
});

test('home shows the hero, library tiles and shelves', async ({ page }) => {
	const hero = page.getByRole('group', { name: /^1 of \d+$/ });
	await expect(hero).toContainText('Continue watching');
	await expect(hero).toContainText('5 Centimeters per Second');
	await expect(page.getByRole('link', { name: 'Resume' })).toBeVisible();
	const libraries = page.getByRole('navigation', { name: 'Libraries' });
	for (const name of ['Movies', 'Shows', 'Music', 'Playlists']) await expect(libraries.getByRole('link', { name: new RegExp(name) })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Latest in Music' })).toBeVisible();
	await page.getByRole('button', { name: 'Next slide' }).click();
	await expect(page.getByRole('group', { name: /^2 of \d+$/ })).toContainText('Next up');
});

test('library: tabs, sort, list view and letter filter', async ({ page }) => {
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Movies' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Movies' })).toBeVisible();
	await expect(page.getByText('5 movies')).toBeVisible();
	const grid = page.getByRole('main').getByRole('list').first();
	await expect(grid.getByRole('listitem')).toHaveCount(5);

	await page.getByRole('button', { name: /^Sort by/ }).click();
	await page.getByRole('menuitemradio', { name: 'Date added' }).click();
	await expect(page).toHaveURL(/sort=added/);
	await expect(page.getByRole('button', { name: 'Sort by: Date added' })).toBeVisible();
	await page.getByRole('button', { name: 'List view' }).click();
	await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('link', { name: 'Starting with K' }).click();
	await expect(page.getByText('1 movies')).toBeVisible();
	await expect(page.getByRole('link', { name: /Kikujiro/ })).toBeVisible();

	await page.getByRole('link', { name: 'Genres' }).click();
	await expect(page.getByRole('link', { name: 'Drama' })).toBeVisible();
});

test('library filters: popover, chips, sort order', async ({ page }) => {
	await page.goto('/#/library/v-movies');
	await expect(page.getByText('5 movies')).toBeVisible();
	await page.getByRole('button', { name: 'Filter' }).click();
	await page.getByRole('button', { name: 'Unwatched' }).click();
	await expect(page).toHaveURL(/show=unplayed/);
	await expect(page.getByText('4 movies')).toBeVisible();
	await page.getByRole('button', { name: 'Drama' }).click();
	await expect(page).toHaveURL(/genre=Drama/);
	await page.keyboard.press('Escape');
	const active = page.getByRole('list', { name: 'Active filters' });
	await expect(active.getByRole('button', { name: 'Remove filter Unwatched' })).toBeVisible();
	await active.getByRole('button', { name: 'Remove filter Drama' }).click();
	await expect(page).not.toHaveURL(/genre=/);
	await active.getByRole('button', { name: 'Clear all' }).click();
	await expect(page.getByText('5 movies')).toBeVisible();

	await page.getByRole('button', { name: /^Sort by/ }).click();
	await page.getByRole('menuitemradio', { name: 'Runtime' }).click();
	await page.getByRole('button', { name: /^Descending order/ }).click();
	await expect(page).toHaveURL(/order=asc/);
});

test('movies get a dice button instead of play all / shuffle', async ({ page }) => {
	await page.goto('/#/library/v-movies');
	await expect(page.getByRole('button', { name: 'Play all' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Shuffle' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Random movie' }).click();
	await expect(page).toHaveURL(/#\/item\/m\d/);
	// Music keeps its play buttons.
	await page.goto('/#/library/v-music');
	await expect(page.getByRole('button', { name: 'Play all' })).toBeVisible();
});

test('search can be run again with Enter, from the page or the header', async ({ page }) => {
	await page.getByRole('searchbox', { name: 'Search' }).fill('wolf');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('link', { name: /Wolf Children/ })).toBeVisible();
	// Search again on the page itself: Enter commits at once.
	const box = page.locator('#search-page');
	await box.fill('kiku');
	await box.press('Enter');
	await expect(page.getByRole('link', { name: /Kikujiro/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Wolf Children/ })).toHaveCount(0);
	// And again from the header while on the search page.
	await page.locator('#global-search').fill('blue');
	await page.locator('#global-search').press('Enter');
	await expect(page.getByRole('link', { name: /Blue Spring/ })).toBeVisible();
	await expect(box).toHaveValue('blue');
});

test('playlists: tile art on Home and details on the playlist page', async ({ page }) => {
	const tile = page.getByRole('navigation', { name: 'Libraries' }).getByRole('link', { name: /Playlists/ });
	await expect(tile.locator('img')).toHaveCount(1);
	await page.goto('/#/item/pl1');
	await expect(page.getByRole('heading', { level: 1, name: 'Road trip' })).toBeVisible();
	const details = page.getByRole('heading', { name: 'Details' }).locator('..');
	await expect(details).toContainText('Tracks');
	await expect(details).toContainText('3');
	await expect(details).toContainText('Duration');
	await expect(details).toContainText('Created');
	await expect(page.getByRole('list', { name: 'Genres' })).toContainText('indie');
});

test('music library has album artists and songs tabs', async ({ page }) => {
	await page.goto('/#/library/v-music');
	await expect(page.getByText('1 albums')).toBeVisible();
	await page.getByRole('link', { name: 'Album artists' }).click();
	await expect(page.getByRole('link', { name: /Paramore/ }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Songs' }).click();
	await page.getByRole('button', { name: 'Play Grow Up' }).click();
	await expect(page.getByRole('region', { name: 'Now playing' }).first()).toContainText('Grow Up');
});

test('movie detail matches the design sections', async ({ page }) => {
	await page.goto('/#/item/m1');
	await expect(page.getByRole('heading', { level: 1, name: '5 Centimeters per Second' })).toBeVisible();
	await expect(page.getByText('秒速5センチメートル')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
	await expect(page.getByText('“At what speed must I live to see you again?”')).toBeVisible();
	await expect(page.getByLabel('Audio')).toHaveValue('1');
	await page.getByLabel('Audio').selectOption({ label: 'English · AAC Stereo' });
	await expect(page.getByRole('heading', { name: 'Cast & crew' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Kenji Mizuhashi/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'More like this' })).toBeVisible();
	await page.getByRole('link', { name: 'Animation' }).click();
	await expect(page.getByText('Genre: Animation')).toBeVisible();
});

test('series lists its episodes', async ({ page }) => {
	await page.goto('/#/item/sr1');
	await expect(page.getByRole('heading', { name: 'Episodes' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Like A Boy' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play next' })).toBeVisible();
});

test('search finds items by name', async ({ page }) => {
	await page.getByRole('searchbox', { name: 'Search' }).fill('wolf');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: 'Movies' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Wolf Children/ })).toBeVisible();
});
