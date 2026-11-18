// A full colour scheme from cover art, as in the Now Playing design:
// dark tinted ground, two glows, an accent and readable text tones.
export interface Palette {
	bg: string;
	/** Dark, still clearly coloured: left end of the mini-player gradient. */
	tint: string;
	glow1: string;
	glow2: string;
	accent: string;
	ink: string;
	text: string;
	muted: string;
	panel: string;
	line: string;
}

// Shown before a cover's colours are known, and for items without artwork: the Jellyfin purple → blue.
const DEFAULT: Palette = from([287, 0.48, 0.56], [197, 1, 0.43]);
const cache = new Map<string, Palette>();

function hsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (!d) return [0, 0, l];
	const s = d / (1 - Math.abs(2 * l - 1));
	let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	h = (h * 60 + 360) % 360;
	return [h, s, l];
}

function from(primary: [number, number, number], secondary: [number, number, number]): Palette {
	const [h, s] = primary;
	const [h2, s2] = secondary;
	const grey = s < 0.12;
	const sat = (v: number) => Math.round((grey ? 0.08 : v) * 100);
	return {
		bg: `hsl(${h} ${sat(Math.min(0.45, s))}% 5%)`,
		tint: `hsl(${h} ${sat(Math.min(0.7, Math.max(0.45, s)))}% 11%)`,
		glow1: `hsl(${h} ${sat(Math.max(0.55, s))}% 50%)`,
		glow2: `hsl(${h2} ${Math.round((s2 < 0.12 ? 0.1 : Math.max(0.4, s2)) * 100)}% 60%)`,
		accent: `hsl(${h} ${sat(Math.max(0.75, s))}% ${grey ? 86 : 68}%)`,
		ink: `hsl(${h} ${sat(0.7)}% 7%)`,
		text: `hsl(${h} ${sat(0.35)}% 95%)`,
		muted: `hsl(${h} ${sat(0.14)}% 74%)`,
		panel: '#FFFFFF10',
		line: '#FFFFFF24'
	};
}

async function extract(url: string): Promise<Palette> {
	const img = new Image();
	img.crossOrigin = 'anonymous';
	img.src = url;
	await img.decode();
	const c = document.createElement('canvas');
	c.width = c.height = 16;
	const ctx = c.getContext('2d', { willReadFrequently: true });
	if (!ctx) return DEFAULT;
	ctx.drawImage(img, 0, 0, 16, 16);
	const { data } = ctx.getImageData(0, 0, 16, 16);
	// Bucket by hue; the most colourful bucket wins, the runner-up becomes the second glow.
	const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
	for (let i = 0; i < data.length; i += 4) {
		const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
		const w = s * (1 - Math.abs(l - 0.5) * 1.6) + 0.02;
		const key = s < 0.12 ? -1 : Math.round(h / 30) % 12;
		const bkt = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
		bkt.r += data[i] * w; bkt.g += data[i + 1] * w; bkt.b += data[i + 2] * w; bkt.w += w;
		buckets.set(key, bkt);
	}
	const ranked = [...buckets.values()].sort((a, b) => b.w - a.w).map((b) => hsl(b.r / b.w, b.g / b.w, b.b / b.w));
	return from(ranked[0] ?? [16, 0.9, 0.5], ranked[1] ?? ranked[0] ?? [210, 0.4, 0.5]);
}

export function paletteFor(url: string | null): { value: Palette } {
	const state = $state({ value: (url && cache.get(url)) || DEFAULT });
	if (url && !cache.has(url)) {
		extract(url)
			.then((p) => { cache.set(url, p); state.value = p; })
			.catch(() => cache.set(url, DEFAULT));
	}
	return state;
}

export function paletteVars(p: Palette): string {
	return `--np-bg:${p.bg};--np-tint:${p.tint};--np-glow1:${p.glow1};--np-glow2:${p.glow2};--np-accent:${p.accent};--np-ink:${p.ink};--np-text:${p.text};--np-muted:${p.muted};--np-panel:${p.panel};--np-line:${p.line};`;
}
