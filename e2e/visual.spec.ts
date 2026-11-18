import { expect, test, type Page } from '@playwright/test';
import { mockJellyfin, signIn } from './mock';

// The seven screens from the design canvas, at its artboard sizes. Run with VISUAL=1.
const screens: { name: string; size: [number, number]; go: (p: Page) => Promise<void> }[] = [
	{ name: 'home', size: [1440, 1000], go: async () => {} },
	{ name: 'movie', size: [1440, 1000], go: async (p) => { await p.goto('/#/item/m1'); await p.getByRole('heading', { name: 'Chapters' }).waitFor(); } },
	{ name: 'music', size: [1440, 1000], go: async (p) => { await p.goto('/#/library/v-music'); await p.getByText('1 albums').waitFor(); } },
	{ name: 'music-mobile', size: [390, 844], go: async (p) => { await playAlbum(p); await p.goto('/#/library/v-music'); await p.getByText('1 albums').waitFor(); } },
	{ name: 'player', size: [1440, 1040], go: async (p) => { await playAlbum(p); await p.goto('/#/now-playing'); } },
	{ name: 'player-mobile', size: [390, 844], go: async (p) => { await playAlbum(p); await p.goto('/#/now-playing'); } },
	{ name: 'player-tv', size: [1920, 1080], go: async (p) => { await p.evaluate(() => localStorage.setItem('jf.layout', 'tv')); await playAlbum(p); await p.goto('/#/now-playing'); } }
];

async function playAlbum(p: Page) {
	await p.goto('/#/item/al1');
	await p.getByRole('button', { name: 'Play all' }).click();
	await p.getByRole('region', { name: 'Now playing' }).first().waitFor();
	// Freeze the clock so the progress bar is deterministic.
	await p.evaluate(() => document.querySelectorAll('audio, video').forEach((m) => (m as HTMLMediaElement).pause()));
}

for (const s of screens) {
	test(s.name, async ({ page }) => {
		await page.setViewportSize({ width: s.size[0], height: s.size[1] });
		await mockJellyfin(page);
		await signIn(page);
		await s.go(page);
		await page.waitForTimeout(800);
		await expect(page).toHaveScreenshot(`${s.name}.png`, { mask: [page.locator('.tabular-nums')] });
	});
}
