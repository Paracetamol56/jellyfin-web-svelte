// Deterministic two-tone colours for items that have no artwork at all,
// echoing the typographic posters in the design. (Loading images stay neutral.)
const PAIRS: [string, string][] = [
	['#3A2A1A', '#F1C27D'],
	['#5A1620', '#FFD0C2'],
	['#1E3C6E', '#BFE0FF'],
	['#E8E4DA', '#1A1A1A'],
	['#CDB89A', '#2B1E12'],
	['#9ED1CB', '#123733'],
	['#C4502A', '#FFE7B0'],
	['#2B2233', '#E9D6F2'],
	['#41507A', '#F2E6C9'],
	['#14341F', '#D7F25A']
];

export function fallbackColors(seed: string): { bg: string; fg: string } {
	let h = 0;
	for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
	const [bg, fg] = PAIRS[Math.abs(h) % PAIRS.length];
	return { bg, fg };
}
