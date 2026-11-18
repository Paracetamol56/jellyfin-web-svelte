// The SPA fallback page is emitted with absolute asset URLs (/_app/...), which
// breaks when Jellyfin serves the client from /web/ or a custom base URL.
// With hash routing the page is only ever loaded as <dir>/index.html, so
// relative URLs are safe; the runtime already derives its base from the page URL.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../build/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
// Asset URLs ("/_app/…") and the static icons ("/favicon.svg", …) all become relative to index.html.
const out = html.replaceAll('"/_app/', '"./_app/').replace(/(href|src)="\/(?!\/)/g, '$1="./');
if (out === html) {
	console.error('relative-fallback: no /_app/ references found; did the SvelteKit output change?');
	process.exit(1);
}
writeFileSync(file, out);
console.log(`relative-fallback: rewrote ${(html.match(/(href|src)="\/(?!\/)|"\/_app\//g) ?? []).length} asset URLs`);
