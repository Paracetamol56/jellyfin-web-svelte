// "10-foot" TV layout: chosen explicitly (?tv / settings) or detected for big screens without a fine pointer.
const KEY = 'jf.layout';

function stored(): string | null {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

class Layout {
	pref = $state<'auto' | 'tv' | 'desktop'>((stored() as 'tv' | 'desktop' | null) ?? 'auto');
	private detected = $state(false);

	constructor() {
		if (location.search.includes('tv') || location.hash.includes('tv=1')) this.pref = 'tv';
		const mq = matchMedia('(min-width: 1800px) and (not (pointer: fine))');
		this.detected = mq.matches;
		mq.addEventListener('change', (e) => (this.detected = e.matches));
	}

	get tv(): boolean {
		return this.pref === 'tv' || (this.pref === 'auto' && this.detected);
	}

	set(p: 'auto' | 'tv' | 'desktop') {
		this.pref = p;
		try {
			if (p === 'auto') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, p);
		} catch {
			/* per-device preference only */
		}
	}
}

export const layout = new Layout();
