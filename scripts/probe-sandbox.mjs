// Dev probe: how does Chromium treat web storage inside a sandboxed srcdoc iframe?
import { chromium } from '@playwright/test';
const inner = `<script>
var r = [];
try { void window.localStorage; r.push('direct: ok'); } catch (e) { r.push('direct: throws ' + e.name); }
var own = Object.getOwnPropertyDescriptor(window, 'localStorage');
var proto = Object.getOwnPropertyDescriptor(Window.prototype, 'localStorage');
r.push('own: ' + JSON.stringify(own && { configurable: own.configurable, accessor: !!own.get }));
r.push('Window.prototype: ' + JSON.stringify(proto && { configurable: proto.configurable, accessor: !!proto.get }));
try { Object.defineProperty(window, 'localStorage', { value: { tag: 'stand-in' }, configurable: true }); r.push('define on window: ok -> ' + (window.localStorage && window.localStorage.tag)); } catch (e) { r.push('define on window: ' + e.message); }
try { Object.defineProperty(Window.prototype, 'localStorage', { get: function () { return { tag: 'proto-stand-in' }; }, configurable: true }); r.push('define on prototype: ok'); } catch (e) { r.push('define on prototype: ' + e.message); }
parent.postMessage(r, '*');
<\/script>`;
const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const p = await b.newPage();
await p.setContent('<iframe sandbox="allow-scripts"></iframe>');
const out = p.evaluate(() => new Promise((res) => addEventListener('message', (e) => res(e.data))));
await p.evaluate((html) => { document.querySelector('iframe').srcdoc = html; }, inner);
console.log((await Promise.race([out, new Promise((r) => setTimeout(() => r(['timed out']), 15000))])).join('\n'));
await b.close();
