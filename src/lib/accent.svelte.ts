// Pulls a bright accent colour out of an image (for hero CTAs and the
// "ghost" title), cached per URL. Falls back to the theme's link colour.
const cache = new Map<string, string>();
const FALLBACK = '#33B7E6';

function toAccent(r: number, g: number, b: number): string {
	// Normalise into a light, saturated tone that reads on dark backgrounds.
	const max = Math.max(r, g, b) / 255;
	const min = Math.min(r, g, b) / 255;
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	if (d) {
		const rr = r / 255, gg = g / 255, bb = b / 255;
		if (max === rr) h = ((gg - bb) / d) % 6;
		else if (max === gg) h = (bb - rr) / d + 2;
		else h = (rr - gg) / d + 4;
		h *= 60;
	}
	const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
	if (s < 0.12) return '#E4E2EA'; // near-grey image: use a soft white
	return `hsl(${Math.round((h + 360) % 360)} ${Math.round(Math.min(90, Math.max(55, s * 100)))}% 74%)`;
}

async function extract(url: string): Promise<string> {
	const img = new Image();
	img.crossOrigin = 'anonymous';
	img.decoding = 'async';
	img.src = url;
	await img.decode();
	const c = document.createElement('canvas');
	c.width = 24;
	c.height = 14;
	const ctx = c.getContext('2d', { willReadFrequently: true });
	if (!ctx) return FALLBACK;
	ctx.drawImage(img, 0, 0, c.width, c.height);
	const { data } = ctx.getImageData(0, 0, c.width, c.height);
	// Weight saturated pixels so the accent comes from the image's colour, not its shadows.
	let r = 0, g = 0, b = 0, w = 0;
	for (let i = 0; i < data.length; i += 4) {
		const max = Math.max(data[i], data[i + 1], data[i + 2]);
		const min = Math.min(data[i], data[i + 1], data[i + 2]);
		const weight = (max - min) * (max / 255) + 1;
		r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight; w += weight;
	}
	return toAccent(r / w, g / w, b / w);
}

export function accentFor(url: string | null): { value: string } {
	const state = $state({ value: (url && cache.get(url)) || FALLBACK });
	if (url && !cache.has(url)) {
		extract(url)
			.then((c) => { cache.set(url, c); state.value = c; })
			.catch(() => cache.set(url, FALLBACK));
	}
	return state;
}
