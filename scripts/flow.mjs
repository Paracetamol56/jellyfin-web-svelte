// Dev helper: scripted flows against a signed-in session (run shoot.mjs first to create auth.json).
// Playback reporting is disabled so tests never touch watch history.
import { chromium } from '@playwright/test';

const [outDir, flow, ...args] = process.argv.slice(2);
const base = process.env.APP_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({
	executablePath: process.env.PW_CHROME || '/usr/bin/chromium',
	args: ['--autoplay-policy=no-user-gesture-required']
});
const errors = [];
async function ctx(w, h) {
	const c = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', storageState: `${outDir}/auth.json` });
	await c.addInitScript(() => { if (window.top === window) localStorage.setItem('jf.disablePlaybackReporting', '1'); });
	const page = await c.newPage();
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
	const mask = (u) => u.replace(/(api_key|ApiKey|Tag|DeviceId|deviceId|PlaySessionId|MediaSourceId|mediaSourceId)=[^&]+/gi, '$1=…');
	page.on('requestfailed', (r) => errors.push(`failed ${r.failure()?.errorText}: ${mask(r.url()).slice(0, 220)}`));
	page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()}: ${mask(r.url()).slice(0, 220)}`));
	page.on('response', async (r) => {
		if (!r.url().includes('/PlaybackInfo')) return;
		const d = await r.json().catch(() => null);
		const s = d?.MediaSources?.[0];
		if (s) errors.push(`playbackinfo: direct=${s.SupportsDirectPlay} stream=${s.SupportsDirectStream} container=${s.Container} transcodeUrl=${s.TranscodingUrl ? mask(s.TranscodingUrl).slice(0, 160) : null} protocol=${s.Protocol} isRemote=${s.IsRemote}`);
	});
	return page;
}
const state = (page) =>
	page.evaluate(() => {
		const a = [...document.querySelectorAll('audio,video')][0];
		return { url: location.hash, media: a ? { paused: a.paused, t: Math.round(a.currentTime), src: (a.currentSrc || '').replace(/api_key=[^&]+/, 'api_key=***').slice(0, 140) } : null };
	});

const flows = {
	async music([albumId]) {
		const page = await ctx(1440, 1000);
		await page.goto(`${base}#/item/${albumId}`);
		await page.getByRole('button', { name: 'Play all' }).click({ timeout: 90000 });
		await page.getByRole('region', { name: 'Now playing' }).first().waitFor({ timeout: 60000 });
		await page.waitForTimeout(6000);
		await page.screenshot({ path: `${outDir}/flow-music-mini.png` });
		console.log('mini', JSON.stringify(await state(page)), await page.evaluate(() => document.querySelector('[role=region][aria-label="Now playing"] [role=alert]')?.textContent ?? null));
		await page.getByRole('link', { name: /^Open player/ }).first().focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(5000);
		await page.screenshot({ path: `${outDir}/flow-music-np.png` });
		console.log('np', JSON.stringify(await page.evaluate(() => ({ hash: location.hash, playing: document.querySelector('[aria-label="Pause"]') !== null }))));
		// Mobile + TV versions of the same page, same session
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(1500);
		await page.screenshot({ path: `${outDir}/flow-music-np-mobile.png` });
		await page.getByRole('tab', { name: 'Queue' }).click();
		await page.waitForTimeout(800);
		await page.screenshot({ path: `${outDir}/flow-music-np-mobile-queue.png` });
		await page.evaluate(() => localStorage.setItem('jf.layout', 'tv'));
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.reload();
		await page.getByRole('region', { name: 'Now playing' }).or(page.getByLabel('Now playing')).first().waitFor({ timeout: 60000 }).catch(() => {});
		await page.getByRole('button', { name: 'Play', exact: true }).first().click({ timeout: 30000 }).catch((e) => console.log('tv play', e.message.split('\n')[0]));
		await page.waitForTimeout(8000);
		await page.screenshot({ path: `${outDir}/flow-music-np-tv-afterreload.png` });
		await page.evaluate(() => localStorage.removeItem('jf.layout'));
	},
	async review([albumId, moviesViewId]) {
		const page = await ctx(1440, 1000);
		await page.goto(`${base}#/item/${albumId}`);
		await page.getByRole('button', { name: 'Play all' }).click({ timeout: 90000 });
		await page.getByRole('region', { name: 'Now playing' }).first().waitFor({ timeout: 60000 });
		await page.waitForTimeout(5000);
		await page.screenshot({ path: `${outDir}/review-album-mini.png` });
		await page.getByRole('link', { name: /^Open player/ }).first().focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(4000);
		await page.mouse.move(750, 500);
		await page.mouse.wheel(0, 900);
		await page.waitForTimeout(1200);
		await page.screenshot({ path: `${outDir}/review-np.png` });
		await page.getByRole('button', { name: 'More options' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${outDir}/review-np-menu.png`, clip: { x: 900, y: 0, width: 540, height: 300 } });
		await page.keyboard.press('Escape');
		await page.goto(`${base}#/library/${moviesViewId}?sort=added`);
		await page.getByRole('button', { name: 'Filter' }).click({ timeout: 90000 });
		await page.waitForTimeout(3000);
		await page.screenshot({ path: `${outDir}/review-filters.png` });
	},
	async menus([albumId]) {
		const page = await ctx(1440, 1000);
		await page.goto(`${base}#/item/${albumId}`);
		await page.getByRole('button', { name: 'Play all' }).click({ timeout: 90000 });
		await page.getByRole('region', { name: 'Now playing' }).first().waitFor({ timeout: 60000 });
		const row = page.getByRole('main').getByRole('listitem').getByRole('button', { name: /^Play / }).first();
		await row.click({ button: 'right' });
		await page.waitForTimeout(700);
		await page.screenshot({ path: `${outDir}/menus-context.png` });
		await page.keyboard.press('Escape');
		await page.getByRole('link', { name: /^Open player/ }).first().focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(20000);
		await page.screenshot({ path: `${outDir}/menus-np.png`, clip: { x: 560, y: 90, width: 380, height: 870 } });
		console.log('t1', await page.evaluate(() => [document.querySelector('[data-line][aria-current]')?.textContent, Math.round(document.querySelector('audio')?.currentTime ?? 0)]));
		await page.waitForTimeout(7000);
		await page.screenshot({ path: `${outDir}/menus-np2.png`, clip: { x: 560, y: 90, width: 380, height: 870 } });
		console.log('t2', await page.evaluate(() => [document.querySelector('[data-line][aria-current]')?.textContent, 0]).catch(() => null));
	},
	async video([itemId]) {
		const page = await ctx(1440, 900);
		await page.goto(`${base}#/item/${itemId}`);
		await page.getByRole('button', { name: /^(Play|Resume|Play again|Play next)$/ }).click({ timeout: 90000 });
		await page.waitForFunction(() => location.hash.startsWith('#/play/'), null, { timeout: 60000 });
		for (let i = 0; i < 20; i++) {
			const s = await state(page);
			if (s.media && !s.media.paused && s.media.t > 2) break;
			await page.waitForTimeout(1500);
		}
		console.log('video', JSON.stringify(await state(page)));
		await page.mouse.move(700, 450);
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${outDir}/flow-video.png` });
		await page.getByRole('button', { name: 'Close player' }).click();
		await page.waitForTimeout(1000);
		console.log('after close', JSON.stringify(await state(page)));
	}
};

try {
	await flows[flow](args);
} finally {
	console.log(JSON.stringify(errors.slice(0, 15), null, 1));
	await browser.close();
}
