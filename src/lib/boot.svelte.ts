// Progress of the first load, for the splash screen.
//   0 – 30 %   checking the saved sign-in (creeps forward, never quite arrives, until the server answers)
//   32 – 100 % the first screen's data: share of the active queries that have finished
// The splash lifts once nothing is loading any more, after a short grace period for follow-up queries,
// and at the latest after a hard cap, so a screen that polls can't hold it up.
import { queryClient } from '#lib/query-client.ts';

const NO_QUERIES_MS = 350; // the screen never asked for data: nothing to wait for
const SETTLE_MS = 250; // queries that start right after others finish still count
const MAX_MS = 6000;

class Boot {
	done = $state(false);
	progress = $state(4);
	#phase: 'session' | 'data' | 'finished' = 'session';
	#timers: ReturnType<typeof setTimeout>[] = [];
	#creep: ReturnType<typeof setInterval> | undefined;
	#unsubscribe: (() => void) | undefined;
	#settle: ReturnType<typeof setTimeout> | undefined;

	/** Start creeping while the saved session is checked. Call once, at startup. */
	start(): void {
		if (this.#creep || this.#phase !== 'session') return;
		this.#creep = setInterval(() => {
			if (this.#phase === 'session') this.#set(this.progress + (28 - this.progress) * 0.07);
		}, 100);
	}

	/** The saved session was checked. Without a user there is nothing to load behind the splash. */
	sessionReady(signedIn: boolean): void {
		if (this.#phase !== 'session') return;
		clearInterval(this.#creep);
		if (!signedIn) return this.#finish();
		this.#phase = 'data';
		this.#set(32);
		const cache = queryClient.getQueryCache();
		// Cache events can arrive while a component is rendering; measure just after, never during.
		this.#unsubscribe = cache.subscribe(() => this.#measureSoon());
		this.#timers.push(setTimeout(() => this.#measure(true), NO_QUERIES_MS), setTimeout(() => this.#finish(), MAX_MS));
		this.#measureSoon();
	}

	#queued = false;
	#measureSoon(): void {
		if (this.#queued) return;
		this.#queued = true;
		queueMicrotask(() => {
			this.#queued = false;
			this.#measure();
		});
	}

	#measure(timeout = false): void {
		if (this.#phase !== 'data') return;
		const active = queryClient.getQueryCache().getAll().filter((q) => q.getObserversCount() > 0);
		const loading = active.filter((q) => q.state.fetchStatus === 'fetching').length;
		if (!active.length) return timeout ? this.#finish() : undefined;
		this.#set(32 + 68 * ((active.length - loading) / active.length) * 0.97);
		clearTimeout(this.#settle);
		if (!loading) this.#settle = setTimeout(() => this.#finish(), SETTLE_MS);
	}

	#set(p: number): void {
		this.progress = Math.max(this.progress, Math.min(100, p)); // never goes backwards
	}

	#finish(): void {
		if (this.#phase === 'finished') return;
		this.#phase = 'finished';
		clearInterval(this.#creep);
		clearTimeout(this.#settle);
		this.#timers.forEach(clearTimeout);
		this.#unsubscribe?.();
		this.progress = 100;
		// Let the fill reach the top before the splash fades.
		setTimeout(() => (this.done = true), 300);
	}
}

export const boot = new Boot();
