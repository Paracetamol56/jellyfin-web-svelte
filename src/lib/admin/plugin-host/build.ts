// Assembles the document for a plugin configuration page iframe.
import shim from './shim.js?raw';
import compat from './compat.css?raw';
import iconFontUrl from 'material-icons/iconfont/material-icons.woff2?url';

export interface HostConfig {
	server: string;
	token: string;
	authorization: string;
	userId: string;
	serverId?: string;
	version: string;
	deviceId: string;
	deviceName: string;
	appName: string;
	appVersion: string;
	query: string;
	theme: { dark: boolean; vars: Record<string, string> };
}

/** Theme tokens the compatibility stylesheet uses. */
export const THEME_TOKENS = [
	'--background', '--foreground', '--card', '--muted', '--muted-foreground', '--primary', '--primary-foreground',
	'--secondary', '--accent', '--border', '--input', '--ring', '--destructive'
];

export function themeVars(): Record<string, string> {
	const cs = getComputedStyle(document.documentElement);
	return Object.fromEntries(THEME_TOKENS.map((t) => [t, cs.getPropertyValue(t).trim()]));
}

// The sandboxed frame has an opaque origin, so the icon font is inlined rather than fetched cross-origin.
let fontData: Promise<string> | null = null;
export function iconFontDataUrl(): Promise<string> {
	fontData ??= fetch(new URL(iconFontUrl, location.href))
		.then((r) => r.blob())
		.then(
			(b) =>
				new Promise<string>((resolve, reject) => {
					const fr = new FileReader();
					fr.onload = () => resolve(String(fr.result));
					fr.onerror = reject;
					fr.readAsDataURL(b);
				})
		)
		.catch(() => '');
	return fontData;
}

const endScript = '</' + 'script>';
const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');

/** Strip the outer document tags; keep everything else in order (inline scripts run as the page parses). */
export function pageBody(html: string): string {
	return html.replace(/<!doctype[^>]*>/i, '').replace(/<\/?(html|head|body)\b[^>]*>/gi, '');
}

export function buildDocument(pageHtml: string, cfg: HostConfig, fontDataUrl: string): string {
	const font = fontDataUrl
		? `@font-face{font-family:'Material Icons';font-style:normal;font-weight:400;font-display:block;src:url(${fontDataUrl}) format('woff2')}\n`
		: '';
	return [
		'<!doctype html>',
		`<html${cfg.theme.dark ? ' class="dark"' : ''}><head><meta charset="utf-8">`,
		'<meta name="viewport" content="width=device-width,initial-scale=1">',
		// Relative links in plugin pages (e.g. "configurationpage?name=x.css") resolve against the server's /web/.
		`<base href="${cfg.server.replace(/"/g, '')}/web/">`,
		`<style>${font}${compat}</style>`,
		`<script>window.__JF=${safe(JSON.stringify(cfg))}${endScript}`,
		`<script>${safe(shim)}${endScript}`,
		'</head><body><div class="jf-host"><nav id="jf-tabs" aria-label="Plugin pages" hidden></nav>',
		pageBody(pageHtml),
		`</div><script>window.__JF_BOOT()${endScript}</body></html>`
	].join('');
}
