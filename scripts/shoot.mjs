// Dev helper: sign in through the UI and screenshot pages.
// Usage: node scripts/shoot.mjs <outDir> [hashPath ...]   (reads .env.test.local)
import { chromium } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const env = Object.fromEntries(
	readFileSync('.env.test.local', 'utf8')
		.split('\n')
		.filter((l) => l.includes('=') && !l.startsWith('#'))
		.map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const [outDir, ...paths] = process.argv.slice(2);
const base = process.env.APP_URL ?? 'http://localhost:5173/';
const sizes = (process.env.SIZES ?? '1440x1000').split(',').map((s) => s.split('x').map(Number));
const state = `${outDir}/auth.json`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/usr/bin/chromium' });
const errors = [];

async function newPage(w, h, scheme = 'dark') {
	const ctx = await browser.newContext({
		viewport: { width: w, height: h },
		colorScheme: scheme,
		storageState: existsSync(state) ? state : undefined
	});
	const page = await ctx.newPage();
	page.on('pageerror', (e) => errors.push(`${page.url()} pageerror: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} console: ${m.text()}`));
	return { ctx, page };
}

{
	const { ctx, page } = await newPage(1440, 1000);
	await page.goto(base);
	await page.locator('#username, #main').first().waitFor({ timeout: 180000 });
	if (page.url().includes('#/login')) {
		const server = page.locator('#server');
		if (await server.isVisible()) {
			await server.fill(env.JELLYFIN_URL);
			await server.blur();
		} else {
			await page.getByRole('button', { name: 'Change server' }).click();
			await page.locator('#server').fill(env.JELLYFIN_URL);
			await page.locator('#server').blur();
		}
		await page.getByText(/^to /).locator('span').waitFor({ timeout: 15000 });
		await page.locator('#username').fill(env.JELLYFIN_TEST_USER);
		await page.locator('#password').fill(env.JELLYFIN_TEST_PASSWORD);
		await page.getByRole('button', { name: 'Sign in' }).click();
		try {
			await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 120000 });
		} catch (e) {
			await page.screenshot({ path: `${outDir}/login-failed.png` });
			console.log('login failed; alert:', await page.getByRole('alert').allTextContents(), errors);
			throw e;
		}
	}
	await ctx.storageState({ path: state });
	await ctx.close();
}

for (const p of paths.length ? paths : ['/']) {
	for (const [w, h] of sizes) {
		for (const scheme of (process.env.SCHEMES ?? 'dark').split(',')) {
			const { ctx, page } = await newPage(w, h, scheme);
			await page.addInitScript((m) => { if (window.top === window) localStorage.setItem('mode-watcher-mode', m); }, scheme);
			await page.goto(base + '#' + p);
			await page.locator(process.env.WAIT_FOR ?? 'main h1, main h2').first().waitFor({ timeout: 90000 }).catch(() => console.log('no heading on', p));
			await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
			await page.waitForTimeout(+(process.env.SETTLE ?? 2500));
			const name = `${p.replace(/[^a-z0-9]+/gi, '_') || 'home'}-${w}-${scheme}.png`;
			await page.screenshot({ path: `${outDir}/${name}`, fullPage: process.env.FULL !== '0' });
			console.log('shot', name);
			await ctx.close();
		}
	}
}
console.log(JSON.stringify(errors, null, 1));
await browser.close();
