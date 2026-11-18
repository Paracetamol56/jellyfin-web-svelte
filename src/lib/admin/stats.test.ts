import { describe, expect, it } from 'vitest';
import { activityByDay, addedByMonth, classify, decadeCounts, distinctUsers, playHeatmap, resolutionCounts } from './stats';

// 2026-11-15 is a Sunday. Local-time constructors keep these tests timezone-independent.
const NOW = new Date(2026, 10, 15, 12, 0, 0);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe('classify', () => {
	it('counts playback starts, not stops', () => {
		expect(classify({ Type: 'VideoPlayback' })).toBe('video');
		expect(classify({ Type: 'AudioPlayback' })).toBe('music');
		expect(classify({ Type: 'VideoPlaybackStopped' })).toBe('other');
		expect(classify({ Type: 'AuthenticationSucceeded' })).toBe('signin');
		expect(classify({})).toBe('other');
	});
});

describe('activityByDay', () => {
	const entries = [
		{ Type: 'VideoPlayback', Date: at(2026, 10, 15) },
		{ Type: 'AudioPlayback', Date: at(2026, 10, 15, 3) },
		{ Type: 'AudioPlayback', Date: at(2026, 10, 15, 22) },
		{ Type: 'AuthenticationSucceeded', Date: at(2026, 10, 13) },
		{ Type: 'SessionStarted', Date: at(2026, 10, 13) },
		{ Type: 'VideoPlayback', Date: at(2026, 9, 1) } // outside the window
	];
	const rows = activityByDay(entries, 7, NOW);
	it('has one row per day, oldest first, ending today', () => {
		expect(rows).toHaveLength(7);
		expect(rows[6].date).toEqual(new Date(2026, 10, 15));
		expect(rows[0].date).toEqual(new Date(2026, 10, 9));
	});
	it('buckets by kind and ignores other events and old entries', () => {
		expect(rows[6]).toMatchObject({ video: 1, music: 2, signin: 0 });
		expect(rows[4]).toMatchObject({ video: 0, music: 0, signin: 1 });
		expect(rows.reduce((n, r) => n + r.video + r.music + r.signin, 0)).toBe(4);
	});
});

describe('playHeatmap', () => {
	it('always has 7 × 24 cells with Monday first', () => {
		const cells = playHeatmap([{ Type: 'AudioPlayback', Date: at(2026, 10, 15, 21) }]); // Sunday 21:00
		expect(cells).toHaveLength(168);
		expect(cells.find((c) => c.count)).toEqual({ weekday: 6, hour: 21, count: 1 });
		const monday = playHeatmap([{ Type: 'VideoPlayback', Date: at(2026, 10, 9, 8) }]);
		expect(monday.find((c) => c.count)).toEqual({ weekday: 0, hour: 8, count: 1 });
	});
	it('ignores non-play events and respects "since"', () => {
		const entries = [
			{ Type: 'AuthenticationSucceeded', Date: at(2026, 10, 15) },
			{ Type: 'AudioPlayback', Date: at(2026, 9, 1) }
		];
		expect(playHeatmap(entries, new Date(2026, 10, 1)).every((c) => c.count === 0)).toBe(true);
	});
});

describe('addedByMonth', () => {
	it('fills quiet months with zeros and counts per kind', () => {
		const rows = addedByMonth(
			[
				{ kind: 'movies', created: at(2026, 10, 2) },
				{ kind: 'movies', created: at(2026, 10, 20) },
				{ kind: 'albums', created: at(2026, 8, 5) },
				{ kind: 'episodes', created: at(2025, 0, 1) } // too old
			],
			6,
			NOW
		);
		expect(rows).toHaveLength(6);
		expect(rows[5]).toMatchObject({ movies: 2, albums: 0 });
		expect(rows[3]).toMatchObject({ albums: 1 });
		expect(rows[4]).toMatchObject({ movies: 0, episodes: 0, albums: 0 });
	});
});

describe('decadeCounts / resolutionCounts', () => {
	it('lists every decade between the first and last, including empty ones', () => {
		expect(decadeCounts([1957, 1999, 2001, 2007, null, undefined, 0])).toEqual([
			{ label: '1950s', count: 1 },
			{ label: '1960s', count: 0 },
			{ label: '1970s', count: 0 },
			{ label: '1980s', count: 0 },
			{ label: '1990s', count: 1 },
			{ label: '2000s', count: 2 }
		]);
		expect(decadeCounts([])).toEqual([]);
	});
	it('classifies letterboxed 4K by width and orders best first', () => {
		const out = resolutionCounts([{ Height: 1600, Width: 3840 }, { Height: 1080, Width: 1920 }, { Height: 804, Width: 1920 }, { Height: 304, Width: 720 }, {}]);
		expect(out).toEqual([
			{ label: '4K', count: 1 },
			{ label: '1080P', count: 2 },
			{ label: 'SD', count: 1 }
		]);
	});
});

describe('distinctUsers', () => {
	it('counts people with plays or sign-ins in the period', () => {
		const since = new Date(2026, 10, 8);
		expect(
			distinctUsers(
				[
					{ Type: 'AudioPlayback', Date: at(2026, 10, 14), UserId: 'a' },
					{ Type: 'AuthenticationSucceeded', Date: at(2026, 10, 13), UserId: 'b' },
					{ Type: 'AudioPlayback', Date: at(2026, 10, 1), UserId: 'c' },
					{ Type: 'SessionStarted', Date: at(2026, 10, 14), UserId: 'd' }
				],
				since
			)
		).toBe(2);
	});
});
