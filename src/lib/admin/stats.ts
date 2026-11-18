// Turning raw server data into chart-ready numbers. Pure functions, no I/O (see stats.test.ts).
import { group, timeDay, timeMonth } from 'd3';
import { qualityLabel } from '#lib/api/format.ts';

export type ActivityKind = 'video' | 'music' | 'signin' | 'other';
export interface ActivityLike {
	Type?: string | null;
	Date?: string | null;
}

/** Playback "start" events only: the matching "…Stopped" entries are the same play. */
export function classify(e: ActivityLike): ActivityKind {
	switch (e.Type) {
		case 'VideoPlayback':
			return 'video';
		case 'AudioPlayback':
			return 'music';
		case 'AuthenticationSucceeded':
			return 'signin';
		default:
			return 'other';
	}
}

export interface DayCount {
	date: Date;
	label: string;
	video: number;
	music: number;
	signin: number;
}

/** One row per local calendar day, oldest first, ending today, with zeros for quiet days. */
export function activityByDay(entries: ActivityLike[], days: number, now = new Date()): DayCount[] {
	const end = timeDay.floor(now);
	const start = timeDay.offset(end, -(days - 1));
	const rows = new Map<number, DayCount>();
	for (const d of timeDay.range(start, timeDay.offset(end, 1))) {
		rows.set(+d, { date: d, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), video: 0, music: 0, signin: 0 });
	}
	for (const e of entries) {
		if (!e.Date) continue;
		const row = rows.get(+timeDay.floor(new Date(e.Date)));
		const kind = classify(e);
		if (row && kind !== 'other') row[kind]++;
	}
	return [...rows.values()];
}

export interface HeatCell {
	/** 0 = Monday … 6 = Sunday */
	weekday: number;
	hour: number;
	count: number;
}

/** Plays (video + music) by local weekday and hour: always 7 × 24 cells. */
export function playHeatmap(entries: ActivityLike[], since?: Date): HeatCell[] {
	const counts = new Map<number, number>();
	for (const e of entries) {
		if (!e.Date) continue;
		const kind = classify(e);
		if (kind !== 'video' && kind !== 'music') continue;
		const d = new Date(e.Date);
		if (since && d < since) continue;
		const key = ((d.getDay() + 6) % 7) * 24 + d.getHours();
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return Array.from({ length: 7 * 24 }, (_, i) => ({ weekday: Math.floor(i / 24), hour: i % 24, count: counts.get(i) ?? 0 }));
}

export interface MonthAdds {
	date: Date;
	label: string;
	movies: number;
	episodes: number;
	albums: number;
}

/** Items added per month for the last `months` months (oldest first), by kind, from their DateCreated. */
export function addedByMonth(
	items: { kind: 'movies' | 'episodes' | 'albums'; created?: string | null }[],
	months = 12,
	now = new Date()
): MonthAdds[] {
	const end = timeMonth.floor(now);
	const start = timeMonth.offset(end, -(months - 1));
	const rows = new Map<number, MonthAdds>();
	for (const m of timeMonth.range(start, timeMonth.offset(end, 1))) {
		rows.set(+m, { date: m, label: `${m.toLocaleDateString([], { month: 'short' })} ’${String(m.getFullYear()).slice(2)}`, movies: 0, episodes: 0, albums: 0 });
	}
	for (const it of items) {
		if (!it.created) continue;
		const row = rows.get(+timeMonth.floor(new Date(it.created)));
		if (row) row[it.kind]++;
	}
	return [...rows.values()];
}

export interface Bin {
	label: string;
	count: number;
}

/** "1990s", "2000s"… oldest first; items without a year are skipped. */
export function decadeCounts(years: (number | null | undefined)[]): Bin[] {
	const known = years.filter((y): y is number => typeof y === 'number' && y > 1800);
	if (!known.length) return [];
	const byDecade = group(known, (y) => Math.floor(y / 10) * 10);
	const first = Math.min(...byDecade.keys());
	const last = Math.max(...byDecade.keys());
	const out: Bin[] = [];
	for (let d = first; d <= last; d += 10) out.push({ label: `${d}s`, count: byDecade.get(d)?.length ?? 0 });
	return out;
}

const RESOLUTION_ORDER = ['4K', '1440P', '1080P', '720P', '540P', 'SD'];
/** Movies per resolution class, best first, only classes that occur. */
export function resolutionCounts(items: { Height?: number | null; Width?: number | null }[]): Bin[] {
	const counts = new Map<string, number>();
	for (const it of items) {
		const label = qualityLabel(it.Height, it.Width);
		if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return RESOLUTION_ORDER.filter((l) => counts.has(l)).map((label) => ({ label, count: counts.get(label)! }));
}

/** Distinct values among sign-in/playback entries are not available by name in the log, so users are counted via UserId. */
export function distinctUsers(entries: (ActivityLike & { UserId?: string | null })[], since: Date): number {
	const ids = new Set<string>();
	for (const e of entries) {
		const kind = classify(e);
		if (e.UserId && e.Date && new Date(e.Date) >= since && (kind === 'video' || kind === 'music' || kind === 'signin')) ids.add(e.UserId);
	}
	return ids.size;
}
