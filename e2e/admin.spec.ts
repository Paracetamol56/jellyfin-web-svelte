import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockJellyfin, signIn } from './mock';
import { mockAdmin, type AdminLog } from './mock-admin';

let log: AdminLog;
const write = (method: string, path: string | RegExp) =>
	log.writes.find((w) => w.method === method && (typeof path === 'string' ? w.path === path : path.test(w.path)));

async function audit(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
	expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3)}`)).toEqual([]);
}

test('regular users are kept out', async ({ page }) => {
	await mockJellyfin(page);
	await signIn(page);
	await page.getByRole('button', { name: /Account: Alex/ }).click();
	await expect(page.getByRole('menuitem', { name: 'Dashboard' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.goto('/#/admin');
	await expect(page.getByRole('heading', { name: 'Administrators only' })).toBeVisible();
});

test.describe('as an administrator', () => {
	test.beforeEach(async ({ page }) => {
		await mockJellyfin(page, { admin: true });
		log = await mockAdmin(page);
		await signIn(page);
		await page.getByRole('button', { name: /Account: Alex/ }).click();
		await page.getByRole('menuitem', { name: 'Dashboard' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Test Server' })).toBeVisible();
	});

	test('overview: streams, storage by disk, tasks, activity, messaging, restart', async ({ page }) => {
		const streaming = page.getByRole('region', { name: 'Now streaming' });
		await expect(streaming).toContainText('Wolf Children');
		await expect(streaming).toContainText('Transcoding');
		await expect(streaming).toContainText('Video codec not supported');
		await expect(page.getByRole('region', { name: 'Storage' })).toContainText('Disk 2');
		await expect(page.getByRole('region', { name: 'Running tasks' })).toContainText('Download missing lyrics');
		await expect(page.getByText('Restart needed.')).toBeVisible();

		await page.getByRole('button', { name: 'Send a message to Sam' }).click();
		await page.getByRole('dialog').getByRole('textbox', { name: 'Message' }).fill('Dinner is ready');
		await page.getByRole('dialog').getByRole('button', { name: 'Send', exact: true }).click();
		await expect.poll(() => write('POST', '/Sessions/s1/Message')?.body).toMatchObject({ Text: 'Dinner is ready' });

		await page.getByRole('button', { name: 'Restart now' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Restart' }).click();
		await expect.poll(() => !!write('POST', '/System/Restart')).toBe(true);
		await audit(page);
	});

	test('users: create, then restrict libraries and save', async ({ page }) => {
		await page.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Users' }).click();
		await expect(page.getByRole('row', { name: /Sam/ })).toContainText('No password');
		await audit(page);
		await page.getByRole('button', { name: 'Add user' }).click();
		await page.getByLabel('Name').fill('Robin');
		await page.getByRole('button', { name: 'Create user' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Robin' })).toBeVisible();
		expect(write('POST', '/Users/New')?.body).toMatchObject({ Name: 'Robin' });

		await expect(page.getByRole('tab', { name: 'Libraries & devices' })).toHaveAttribute('aria-selected', 'true');
		await page.getByRole('switch', { name: 'All libraries' }).click();
		await page.getByLabel('Music').check();
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect.poll(() => write('POST', '/Users/u3/Policy')?.body).toMatchObject({ EnableAllFolders: false, EnabledFolders: ['lib-music'] });
	});

	test("can't remove your own admin role", async ({ page }) => {
		await page.goto('/#/admin/users/u1');
		await expect(page.getByRole('switch', { name: 'Administrator' })).toBeDisabled();
		await audit(page);
	});

	test('libraries: add one through the folder browser, change options', async ({ page }) => {
		await page.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Libraries' }).click();
		await expect(page.getByRole('article', { name: 'Movies' })).toContainText('/media/movies');
		await audit(page);

		await page.getByRole('button', { name: 'Add library' }).click();
		await page.getByLabel('Name').fill('Anime');
		await page.getByLabel('Content type').selectOption('tvshows');
		await page.getByRole('dialog').getByRole('button', { name: 'Add folder' }).click();
		await page.getByRole('dialog', { name: 'Choose a folder' }).getByRole('listitem').getByRole('button', { name: '/', exact: true }).click();
		await page.getByRole('dialog', { name: 'Choose a folder' }).getByRole('listitem').getByRole('button', { name: 'media', exact: true }).click();
		await page.getByRole('button', { name: 'Use this folder' }).click();
		await page.getByRole('button', { name: 'Add library', exact: true }).last().click();
		await expect.poll(() => write('POST', '/Library/VirtualFolders')?.query ?? '').toContain('name=Anime');
		expect(write('POST', '/Library/VirtualFolders')?.query).toContain('collectionType=tvshows');
		expect(write('POST', '/Library/VirtualFolders')?.query).toContain('paths=%2Fmedia');

		const movies = page.getByRole('article', { name: 'Movies' });
		await movies.getByRole('button', { name: 'Options' }).click();
		await movies.getByRole('switch', { name: 'Watch folders for changes' }).click();
		await movies.getByRole('button', { name: 'Save options' }).click();
		await expect.poll(() => write('POST', '/Library/VirtualFolders/LibraryOptions')?.body).toMatchObject({ Id: 'lib-movies', LibraryOptions: { EnableRealtimeMonitor: true } });
	});

	test('playback: hardware acceleration settings save to the encoding config', async ({ page }) => {
		await page.goto('/#/admin/playback');
		await page.getByLabel('Acceleration', { exact: true }).selectOption('vaapi');
		await page.getByLabel('VA-API device').fill('/dev/dri/renderD128');
		await page.getByRole('group', { name: 'Decode in hardware' }).getByLabel('HEVC', { exact: true }).check();
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect.poll(() => write('POST', '/System/Configuration/encoding')?.body).toMatchObject({
			HardwareAccelerationType: 'vaapi',
			VaapiDevice: '/dev/dri/renderD128',
			HardwareDecodingCodecs: ['h264', 'hevc']
		});
	});

	test('server settings: unsaved-changes bar, discard and save', async ({ page }) => {
		await page.goto('/#/admin/server');
		await page.getByLabel('Server name').fill('Basement');
		await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
		await page.getByRole('button', { name: 'Discard' }).click();
		await expect(page.getByLabel('Server name')).toHaveValue('Test Server');
		await page.getByLabel('Server name').fill('Basement');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect.poll(() => write('POST', '/System/Configuration')?.body).toMatchObject({ ServerName: 'Basement' });
		await audit(page);
	});

	test('tasks: failures surface first, run a task', async ({ page }) => {
		await page.goto('/#/admin/tasks');
		const attention = page.getByRole('region', { name: 'Needs attention' });
		await expect(attention).toContainText('Sync loved tracks');
		await page.getByRole('button', { name: 'Run Scan media library' }).click();
		await expect.poll(() => write('POST', '/ScheduledTasks/Running/tk-scan')).toBeTruthy();
		await page.getByLabel('Filter tasks').fill('lyrics');
		await expect(page.getByRole('button', { name: /Scan media library/ })).toHaveCount(0);
	});

	test('logs: level filters and search', async ({ page }) => {
		await page.goto('/#/admin/activity');
		await expect(page.getByText('Sam signed in')).toBeVisible();
		await page.getByRole('tab', { name: 'Server logs' }).click();
		const logBox = page.getByLabel('Log contents');
		await expect(logBox).toContainText('Startup complete');
		await expect(logBox).toContainText('at ListenBrainz.Sync()');
		await page.getByRole('button', { name: 'Info' }).click();
		await expect(logBox).not.toContainText('Startup complete');
		await expect(logBox).toContainText('Slow disk detected');
		await page.getByPlaceholder('Text in the log').fill('ListenBrainz');
		await expect(logBox).not.toContainText('Slow disk');
	});

	test('plugins: update notice, disable, install from the catalog', async ({ page }) => {
		await page.goto('/#/admin/plugins');
		await expect(page.getByRole('status')).toContainText('1 update available');
		await page.getByRole('button', { name: 'Update to 12.4.0.0' }).click();
		await expect.poll(() => write('POST', /^\/Packages\/Installed\/TMDb/)?.query ?? '').toContain('version=12.4.0.0');
		await page.getByRole('article').filter({ hasText: 'ListenBrainz' }).getByRole('button', { name: 'Disable' }).click();
		await expect.poll(() => !!write('POST', '/Plugins/pl-lb/6.6.2.1/Disable')).toBe(true);
		await page.getByRole('tab', { name: 'Catalog' }).click();
		await page.getByRole('listitem').filter({ hasText: 'Fanart' }).getByRole('button', { name: 'Install' }).click();
		await expect.poll(() => !!write('POST', /^\/Packages\/Installed\/Fanart/)).toBe(true);
	});

	test('plugin settings pages run inside the dashboard', async ({ page }) => {
		// Plugins that ask for a menu entry get one in the sidebar.
		await expect(page.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'TMDb' })).toBeVisible();
		await page.goto('/#/admin/plugins');
		await page.getByRole('article').filter({ hasText: 'TMDb' }).getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'TMDb' })).toBeVisible();

		const frame = page.frameLocator('iframe[title="TMDb settings"]');
		await expect(frame.getByLabel('Display name')).toHaveValue('Test');
		await frame.getByLabel('Display name').fill('Renamed');
		await frame.getByLabel('Enabled').check();
		await frame.getByRole('button', { name: 'Save' }).click();
		await expect.poll(() => write('POST', '/Plugins/pl-tmdb/Configuration')?.body).toMatchObject({ Name: 'Renamed', Enabled: true });
		await expect(page.getByRole('status').filter({ hasText: 'Settings saved' })).toBeVisible();
		await audit(page);
	});

	test('statistics: d3 charts from server data, range switch, accessible', async ({ page }) => {
		test.setTimeout(90_000); // the live chart needs two 5-second polls
		await page.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Statistics' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Statistics' })).toBeVisible();

		await expect(page.getByText('29,789')).toBeVisible();
		const perDay = page.getByRole('img', { name: /^Plays and sign-ins per day over the last 14 days: \d+ plays and \d+ sign-ins/ });
		await expect(perDay).toBeVisible();
		await expect(page.getByRole('img', { name: /^Plays by weekday and hour over the last 14 days/ })).toBeVisible();
		await expect(page.getByRole('img', { name: 'Video library: 413 movies, 45 shows, 1659 episodes.' })).toBeVisible();
		await expect(page.getByRole('img', { name: /^Music library: 5224 albums, 19007 songs, 1 album artists/ })).toBeVisible();
		await expect(page.getByRole('img', { name: /^Items added per month over the last 12 months/ })).toBeVisible();
		await expect(page.getByRole('img', { name: 'Movies per decade of release.' })).toBeVisible();
		await expect(page.getByRole('img', { name: /^Movies by resolution: 5 at 1080P/ })).toBeVisible();
		await expect(page.getByRole('img', { name: /^Disk 1: / })).toBeVisible();

		// Every chart has a data table for screen readers, with one row per day.
		await expect(page.getByRole('table', { name: /^Plays and sign-ins per day/ }).locator('tbody tr')).toHaveCount(14);

		// The range switch re-buckets the same data.
		await page.getByRole('button', { name: '30 days' }).click();
		await expect(page.getByRole('img', { name: /^Plays and sign-ins per day over the last 30 days/ })).toBeVisible();
		await expect(page.getByRole('table', { name: /^Plays and sign-ins per day/ }).locator('tbody tr')).toHaveCount(30);

		// Hovering a bar shows its numbers.
		await page.getByRole('img', { name: /^Plays and sign-ins per day/ }).hover({ position: { x: 200, y: 100 } });
		await expect(page.getByText('Video plays').first()).toBeVisible();

		// The live chart fills in once a couple of samples have been taken.
		await expect(page.getByRole('img', { name: /^Streams and transcodes over the last 10 minutes/ })).toBeVisible({ timeout: 25_000 });
		// No sideways scrolling: hidden data tables and wide charts must not stretch the page.
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await audit(page);
	});

	test('devices & keys: sign out a device, revoke a key', async ({ page }) => {
		await page.goto('/#/admin/devices');
		// Two server records for the same device show as one row (and the page still renders).
		await expect(page.getByRole('row', { name: /Living room TV/ })).toHaveCount(1);
		await expect(page.getByRole('row', { name: /Living room TV/ })).toContainText('0.18');
		await page.getByRole('row', { name: /Living room TV/ }).getByRole('button', { name: 'Sign out' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Sign out device' }).click();
		await expect.poll(() => write('DELETE', '/Devices')?.query ?? '').toContain('id=dev-tv');
		await page.getByRole('button', { name: 'Revoke' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
		await expect.poll(() => !!write('DELETE', '/Auth/Keys/abcdef0123456789')).toBe(true);
		await audit(page);
	});
});
