import { expect, test } from '@playwright/test';
import * as F from './fixtures';
import { mockJellyfin, signIn, type MockLog } from './mock';

let log: MockLog;
test.beforeEach(async ({ page }) => {
	log = await mockJellyfin(page);
	await signIn(page);
});

const mediaTime = (page: import('@playwright/test').Page) =>
	page.evaluate(() => {
		const v = document.querySelector('video');
		return v ? { t: v.currentTime, paused: v.paused } : null;
	});

test('plays an album, shows the mini player and reports to the server', async ({ page }) => {
	await page.goto('/#/item/al1');
	await page.getByRole('button', { name: 'Play all' }).click();
	const mini = page.getByRole('region', { name: 'Now playing' }).first();
	await expect(mini).toContainText('Now');
	await expect(mini.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect.poll(() => log.reports.map((r) => r.kind)).toContain('start');

	await mini.getByRole('button', { name: 'Next track' }).click();
	await expect(mini).toContainText('Grow Up');
	await expect.poll(() => log.reports.filter((r) => r.kind === 'stopped').length).toBeGreaterThan(0);
});

test('now playing: synced lyrics, queue, controls', async ({ page }) => {
	await page.goto('/#/item/al1');
	await page.getByRole('button', { name: 'Play all' }).click();
	await page.getByRole('link', { name: /^Open player/ }).first().focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/#\/now-playing$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Now' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Second line' })).toBeVisible();
	await page.getByRole('button', { name: 'Third line' }).click();
	await expect(page.getByRole('button', { name: 'Third line' })).toHaveAttribute('aria-current', 'true');
	const queue = page.getByRole('region', { name: 'Queue' });
	await expect(queue).toContainText('3 tracks');
	await queue.getByRole('button', { name: 'Play Daydreaming' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Daydreaming' })).toBeVisible();
	// Untimed lyrics: plain text, no line is marked current
	const lyrics = page.getByRole('region', { name: 'Lyrics text' });
	await expect(lyrics).toContainText('Plain two');
	await expect(lyrics.locator('[aria-current]')).toHaveCount(0);
	await page.getByRole('button', { name: /^Repeat/ }).click();
	await expect(page.getByRole('button', { name: 'Repeat: all' })).toHaveAttribute('aria-pressed', 'true');
});

test('music queue survives a reload (paused)', async ({ page }) => {
	await page.goto('/#/item/al1');
	await page.getByRole('button', { name: 'Play all' }).click();
	await expect(page.getByRole('region', { name: 'Now playing' }).first().getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.reload();
	const mini = page.getByRole('region', { name: 'Now playing' }).first();
	await expect(mini).toContainText('Now');
	await expect(mini.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('video plays in the full-screen player and closes back', async ({ page }) => {
	await page.goto('/#/item/m1');
	await page.getByRole('button', { name: 'Resume' }).click();
	await expect(page).toHaveURL(/#\/play\/m1$/);
	await expect.poll(async () => (await mediaTime(page))?.paused).toBe(false);
	await expect(page.getByRole('heading', { name: '5 Centimeters per Second' })).toBeVisible();
	await page.getByRole('button', { name: 'Close player' }).click();
	await expect(page).toHaveURL(/#\/item\/m1$/);
	await expect.poll(() => log.reports.map((r) => r.kind)).toContain('stopped');
});

test('reporting can be switched off per device', async ({ page }) => {
	await page.goto('/#/settings');
	await page.getByLabel(/Don't report playback/).check();
	await page.goto('/#/item/al1');
	await page.getByRole('button', { name: 'Play all' }).click();
	await expect(page.getByRole('region', { name: 'Now playing' }).first().getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.waitForTimeout(1000);
	expect(log.reports).toHaveLength(0);
});

async function openPlayer(page: import('@playwright/test').Page, albumId: string) {
	await page.goto(`/#/item/${albumId}`);
	await page.getByRole('button', { name: 'Play all' }).click();
	await page.getByRole('link', { name: /^Open player/ }).first().focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/#\/now-playing$/);
}
const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!;

test('now playing: hide the lyrics and queue panels; two columns when both are hidden', async ({ page }) => {
	await openPlayer(page, 'al1');
	const lyrics = page.getByRole('region', { name: 'Lyrics', exact: true });
	const queue = page.getByRole('region', { name: 'Queue' });
	const cover = page.getByRole('img', { name: /^Album cover/ });
	const playPause = page.getByRole('button', { name: /^(Play|Pause)$/ }).first();
	await expect(lyrics).toBeVisible();
	await expect(queue).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show lyrics' })).toHaveCount(0);

	// Three columns: controls sit below the cover.
	expect((await box(playPause)).y).toBeGreaterThan((await box(cover)).y + (await box(cover)).height);

	await page.getByRole('button', { name: 'Hide lyrics' }).click();
	await expect(lyrics).toBeHidden();
	await expect(page.getByRole('button', { name: 'Show lyrics' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show queue' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Hide queue' }).click();
	await expect(queue).toBeHidden();
	await expect(page.getByRole('button', { name: 'Show queue' })).toBeVisible();

	// Both hidden: cover on the left, controls on the right.
	const c = await box(cover);
	const p = await box(playPause);
	expect(p.x).toBeGreaterThan(c.x + c.width);
	expect(p.y).toBeLessThan(c.y + c.height);

	// The choice survives a reload.
	await page.reload();
	await expect(page.getByRole('button', { name: 'Show lyrics' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show queue' })).toBeVisible();
	await expect(lyrics).toBeHidden();

	await page.getByRole('button', { name: 'Show queue' }).click();
	await expect(queue).toBeVisible();
	await page.getByRole('button', { name: 'Show lyrics' }).click();
	await expect(lyrics).toBeVisible();
	await expect(page.getByRole('button', { name: /^Show (lyrics|queue)$/ })).toHaveCount(0);
});

test('now playing: long titles scroll instead of running into the like button', async ({ page }) => {
	await openPlayer(page, 'al2');
	const title = page.locator('h1 .marquee-box');
	await expect(title).toContainText('Definitely Does Not Fit');
	await expect(page.locator('h1 .marquee')).toHaveCount(1);
	const like = await box(page.getByRole('button', { name: 'Add to favorites' }));
	const t = await box(title);
	expect(t.x + t.width).toBeLessThanOrEqual(like.x);
	expect(await page.locator('h1 .marquee').evaluate((el) => getComputedStyle(el).animationName)).toBe('marquee');

	// Short titles stay still.
	await openPlayer(page, 'al1');
	await expect(page.locator('h1 .marquee')).toHaveCount(0);

	// Reduced motion: no scrolling, the title wraps so it stays readable.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openPlayer(page, 'al2');
	await expect(page.locator('h1 .marquee-box')).toContainText('Definitely Does Not Fit');
	await expect(page.locator('h1 .marquee')).toHaveCount(0);
	expect(await page.locator('h1 .marquee-box').evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('normal');
});

test('a track with several artists links to each of them', async ({ page }) => {
	await page.goto('/#/item/al3');
	await page.getByRole('button', { name: 'Play all' }).click();
	await page.goto('/#/now-playing');
	const header = page.getByRole('heading', { level: 1, name: 'Two Voices' }).locator('xpath=../..');
	await expect(header.getByRole('link', { name: 'Ada Lark' })).toHaveAttribute('href', /item\/ar2$/);
	await expect(header.getByRole('link', { name: 'Ben Moss' })).toHaveAttribute('href', /item\/ar3$/);
	await page.goto('/#/item/d1');
	const overview = page.getByRole('region', { name: 'Overview' });
	await expect(overview.getByRole('link', { name: 'Ada Lark' })).toHaveAttribute('href', /item\/ar2$/);
	await expect(overview.getByRole('link', { name: 'Ben Moss' })).toHaveAttribute('href', /item\/ar3$/);
});

test('subtitles: pick a track in the player and its cues load', async ({ page }) => {
	// Start from the beginning: the mock's 30-second sample is shorter than the fixture's resume point.
	await page.route(/\/Items\/m1(\?|$)/, (route) => route.fulfill({ json: { ...F.all.m1, UserData: { Played: false, PlaybackPositionTicks: 0, IsFavorite: false } } }));
	await page.goto('/#/item/m1');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page).toHaveURL(/#\/play\/m1$/);
	await expect.poll(async () => (await mediaTime(page))?.paused).toBe(false);
	await page.mouse.move(600, 400);
	await page.getByRole('button', { name: 'Subtitles' }).click();
	await page.getByRole('menuitemradio', { name: /English/ }).click();
	const state = () =>
		page.evaluate(() => {
			const v = document.querySelector('video')!;
			const t = v.textTracks[0];
			return t ? { mode: t.mode, cues: t.cues?.length ?? 0 } : null;
		});
	await expect.poll(state).toEqual({ mode: 'showing', cues: 4 });
	// Off hides the cues again.
	await page.mouse.move(600, 400);
	await page.getByRole('button', { name: 'Subtitles' }).click();
	await page.getByRole('menuitemradio', { name: 'Off' }).click();
	await expect.poll(async () => (await state())?.mode).toBe('disabled');
});

/** Settings live in the Subtitles menu. */
async function openSettings(page: import('@playwright/test').Page) {
	await page.mouse.move(600, 400);
	await page.getByRole('button', { name: 'Subtitles' }).click();
	await page.getByRole('menuitem', { name: /Subtitle settings/ }).click();
}

test('subtitle settings: upright letters with a black border by default, saved on this device', async ({ page }) => {
	await page.route(/\/Items\/m1(\?|$)/, (route) => route.fulfill({ json: { ...F.all.m1, UserData: { Played: false, PlaybackPositionTicks: 0, IsFavorite: false } } }));
	await page.goto('/#/item/m1');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect.poll(async () => (await mediaTime(page))?.paused).toBe(false);
	await page.mouse.move(600, 400);
	await page.getByRole('button', { name: 'Subtitles' }).click();
	await page.getByRole('menuitemradio', { name: /English/ }).click();

	const vars = () => page.evaluate(() => {
		const st = (document.querySelector('video') as HTMLVideoElement).style;
		return { bg: st.getPropertyValue('--sub-bg'), italic: st.getPropertyValue('--sub-italic'), shadow: st.getPropertyValue('--sub-shadow').startsWith('-0.05em') };
	});
	// Defaults: no box, no italics, a black border on the letters.
	expect(await vars()).toEqual({ bg: 'transparent', italic: 'normal', shadow: true });

	await openSettings(page);
	const panel = page.getByRole('dialog', { name: 'Subtitle settings' });
	await expect(panel.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
	await expect(panel.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true');
	await expect(panel.getByLabel('Black box behind text')).not.toBeChecked();
	await expect(panel.getByLabel('Italics from the subtitle file')).not.toBeChecked();
	await expect(panel.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();

	if (process.env.SUB_SHOT) {
		await page.keyboard.press('Escape');
		await page.evaluate(() => { const v = document.querySelector('video')!; v.currentTime = 10.3; v.pause(); });
		await page.mouse.move(2, 2);
		await page.waitForTimeout(3800); // controls fade out
		await page.evaluate(() => ((document.querySelector('[role=application]') as HTMLElement).style.background = '#9aa3ad')); // light ground to show the border
		await page.screenshot({ path: `${process.env.SUB_SHOT}-default.png`, clip: { x: 340, y: 520, width: 600, height: 110 } });
		await page.evaluate(() => ((document.querySelector('[role=application]') as HTMLElement).style.background = ''));
		await openSettings(page);
	}
	await panel.getByRole('button', { name: 'Large' }).click();
	await panel.getByLabel('Black box behind text').check();
	await panel.getByRole('button', { name: 'Yellow' }).click();
	expect((await vars()).bg).toBe('rgba(0,0,0,0.78)');
	if (process.env.SUB_SHOT) {
		await page.keyboard.press('Escape');
		await page.mouse.move(2, 2);
		await page.waitForTimeout(3800);
		await page.screenshot({ path: `${process.env.SUB_SHOT}-changed.png` });
		await openSettings(page);
	}

	// Saved: still applied after a reload.
	await page.reload();
	await openSettings(page);
	const again = page.getByRole('dialog', { name: 'Subtitle settings' });
	await expect(again.getByLabel('Black box behind text')).toBeChecked();
	await expect(again.getByRole('button', { name: 'Large' })).toHaveAttribute('aria-pressed', 'true');
	await again.getByRole('button', { name: 'Reset to defaults' }).click();
	await expect(again.getByLabel('Black box behind text')).not.toBeChecked();
	expect((await vars()).bg).toBe('transparent');
});

test('subtitles: switching language replaces the old subtitles, never shows both', async ({ page }) => {
	await page.route(/\/Items\/m1(\?|$)/, (route) => route.fulfill({ json: { ...F.all.m1, UserData: { Played: false, PlaybackPositionTicks: 0, IsFavorite: false } } }));
	await page.goto('/#/item/m1');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect.poll(async () => (await mediaTime(page))?.paused).toBe(false);
	const cues = () =>
		page.evaluate(() => {
			const all = [...document.querySelector('video')!.textTracks].flatMap((t) => [...(t.cues ?? [])].map((c) => (c as VTTCue).text));
			return { total: all.length, japanese: all.filter((t) => t.includes('(jpn)')).length };
		});
	const pick = async (name: RegExp) => {
		await page.mouse.move(600, 400);
		await page.getByRole('button', { name: 'Subtitles' }).click();
		await page.getByRole('menuitemradio', { name }).click();
	};
	await pick(/English/);
	await expect.poll(cues).toEqual({ total: 4, japanese: 0 });
	await pick(/Japanese/);
	await expect.poll(cues).toEqual({ total: 4, japanese: 3 }); // the English cues are gone (one test cue carries no language tag)
	await pick(/English/);
	await expect.poll(cues).toEqual({ total: 4, japanese: 0 });
});
