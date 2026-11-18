// Renders static/favicon.svg to the PNG icons in static/ (run: node scripts/make-icons.mjs).
// Needs Chromium: PW_CHROME=/usr/bin/chromium (or Playwright's own browser).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('static/favicon.svg', 'utf8').replace(/<\?xml[^>]*\?>\s*/, '');
const BG = '#101014'; // the app's dark background

// [file, pixel size, background (null = transparent), padding as a fraction of the size]
const icons = [
	['static/favicon-32.png', 32, null, 0.04],
	['static/icon-192.png', 192, null, 0.06],
	['static/apple-touch-icon.png', 180, BG, 0.2], // iOS adds its own rounding; needs an opaque square
	['static/icon-512.png', 512, null, 0.06]
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/usr/bin/chromium' });
for (const [file, size, bg, pad] of icons) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	const inner = Math.round(size * (1 - pad * 2));
	await page.setContent(
		`<style>html,body{margin:0;width:${size}px;height:${size}px;background:${bg ?? 'transparent'};display:grid;place-items:center}svg{width:${inner}px;height:${inner}px}</style>${svg}`
	);
	writeFileSync(file, await page.screenshot({ omitBackground: bg === null, type: 'png' }));
	await page.close();
	console.log('wrote', file, `${size}px`);
}
await browser.close();
