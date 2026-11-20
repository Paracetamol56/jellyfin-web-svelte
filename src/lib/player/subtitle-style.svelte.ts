// How subtitles look in the video player. Applied as CSS variables on the <video>, which the
// `video::cue` rules in app.css read. Saved on this device.
export type SubtitleSize = 'small' | 'medium' | 'large' | 'xl';
export type SubtitleColor = 'white' | 'yellow' | 'cyan' | 'green';
export type SubtitleOutline = 'none' | 'normal' | 'thick';

export interface SubtitleStyle {
	size: SubtitleSize;
	color: SubtitleColor;
	/** Keep italics from the subtitle file (off: always upright). */
	italic: boolean;
	/** Dark box behind the text. */
	box: boolean;
	/** Black border around the letters. */
	outline: SubtitleOutline;
}

/** Upright white letters with a black border, no box. */
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = { size: 'medium', color: 'white', italic: false, box: false, outline: 'normal' };

export const SIZES: Record<SubtitleSize, { label: string; vmin: number }> = {
	small: { label: 'Small', vmin: 3.2 },
	medium: { label: 'Medium', vmin: 4.2 },
	large: { label: 'Large', vmin: 5.4 },
	xl: { label: 'XL', vmin: 6.8 }
};
export const COLORS: Record<SubtitleColor, { label: string; css: string }> = {
	white: { label: 'White', css: '#FFFFFF' },
	yellow: { label: 'Yellow', css: '#FFE45C' },
	cyan: { label: 'Cyan', css: '#7FE3FF' },
	green: { label: 'Green', css: '#9BF28B' }
};
export const OUTLINES: Record<SubtitleOutline, { label: string; em: number }> = {
	none: { label: 'None', em: 0 },
	normal: { label: 'Normal', em: 0.05 },
	thick: { label: 'Thick', em: 0.09 }
};

const KEY = 'jf.subtitleStyle';

/** Eight shadows around each letter make a border; `::cue` has no text stroke. */
function border(em: number): string {
	if (!em) return 'none';
	const d = [
		[-1, -1], [0, -1], [1, -1],
		[-1, 0], [1, 0],
		[-1, 1], [0, 1], [1, 1]
	];
	return d.map(([x, y]) => `${x * em}em ${y * em}em 0 #000`).join(', ') + `, 0 0 ${em * 2.4}em #000`;
}

/** The CSS variables for a style, as an inline `style` string. */
export function subtitleVars(s: SubtitleStyle): string {
	return [
		`--sub-size:${SIZES[s.size].vmin}vmin`,
		`--sub-color:${COLORS[s.color].css}`,
		`--sub-bg:${s.box ? 'rgba(0,0,0,0.78)' : 'transparent'}`,
		`--sub-italic:${s.italic ? 'italic' : 'normal'}`,
		`--sub-shadow:${border(OUTLINES[s.outline].em)}`
	].join(';');
}

function load(): SubtitleStyle {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SubtitleStyle> | null;
		const d = DEFAULT_SUBTITLE_STYLE;
		return {
			size: saved?.size && saved.size in SIZES ? saved.size : d.size,
			color: saved?.color && saved.color in COLORS ? saved.color : d.color,
			italic: typeof saved?.italic === 'boolean' ? saved.italic : d.italic,
			box: typeof saved?.box === 'boolean' ? saved.box : d.box,
			outline: saved?.outline && saved.outline in OUTLINES ? saved.outline : d.outline
		};
	} catch {
		return { ...DEFAULT_SUBTITLE_STYLE };
	}
}

class SubtitleStyles {
	value = $state<SubtitleStyle>(load());
	readonly vars = $derived(subtitleVars(this.value));

	set(patch: Partial<SubtitleStyle>): void {
		this.value = { ...this.value, ...patch };
		try {
			localStorage.setItem(KEY, JSON.stringify(this.value));
		} catch {
			/* storage blocked: the choice lasts until reload */
		}
	}

	reset(): void {
		this.value = { ...DEFAULT_SUBTITLE_STYLE };
		try {
			localStorage.removeItem(KEY);
		} catch {
			/* nothing saved */
		}
	}

	get isDefault(): boolean {
		return JSON.stringify(this.value) === JSON.stringify(DEFAULT_SUBTITLE_STYLE);
	}
}

export const subtitleStyle = new SubtitleStyles();
