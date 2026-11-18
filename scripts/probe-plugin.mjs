// Dev probe: load one real plugin page through the host and print page errors with stacks.
import { chromium } from '@playwright/test';
const [state, name] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const c = await b.newContext({ storageState: state, viewport: { width: 1440, height: 1000 } });
await c.addInitScript(() => { if (window.top === window) localStorage.setItem('jf.disablePlaybackReporting', '1'); });
const p = await c.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')));
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/404/.test(m.text()) && console.log('CONSOLE', m.type(), m.text().slice(0, 300)));
await p.goto('http://localhost:4173/#/admin/plugins/page?name=' + encodeURIComponent(name));
await p.waitForSelector('iframe', { state: 'attached', timeout: 120000 });
await p.waitForTimeout(12000);
const f = p.frames().find((x) => x !== p.mainFrame());
console.log('frame url:', f?.url().slice(0, 60), '| body text length:', f ? (await f.evaluate(() => document.body.innerText.length).catch((e) => 'eval failed ' + e.message)) : 'none');
if (f) {
	console.log(await f.evaluate(() => {
		let ls;
		try { ls = typeof window.localStorage + (window.localStorage && window.localStorage.getItem ? ' with getItem' : ''); } catch (e) { ls = 'throws ' + e.name; }
		return JSON.stringify({ hasJF: !!window.__JF, hasApiClient: !!window.ApiClient, hasDashboard: !!window.Dashboard, localStorage: ls, scripts: [...document.scripts].map((x) => x.text.length) });
	}));
	// Which inline script mentions localStorage on its 2nd line?
	console.log(await f.evaluate(() => [...document.scripts].map((x, i) => ({ i, line2: (x.text.split('\n')[1] || '').slice(0, 120) })).filter((x) => /localStorage/.test(x.line2))));
}
await b.close();
