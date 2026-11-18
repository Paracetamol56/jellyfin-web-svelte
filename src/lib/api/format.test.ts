import { describe, expect, it } from 'vitest';
import { bytes, clock, duration, episodeCode, initials, itemSubtitle, progress, qualityLabel, rangeLabel } from './format';

describe('format', () => {
	it('clock', () => {
		expect(clock(0)).toBe('0:00');
		expect(clock(125)).toBe('2:05');
		expect(clock(3725)).toBe('1:02:05');
		expect(clock(-4)).toBe('0:00');
	});
	it('duration from ticks', () => {
		expect(duration(22 * 60 * 1e7)).toBe('22m');
		expect(duration(103 * 60 * 1e7)).toBe('1h 43m');
		expect(duration(0)).toBe('');
	});
	it('quality uses width for letterboxed films', () => {
		expect(qualityLabel(1600, 3840)).toBe('4K');
		expect(qualityLabel(804, 1920)).toBe('1080P');
		expect(qualityLabel(304, 720)).toBe('SD');
		expect(qualityLabel(720, 1280)).toBe('720P');
		expect(qualityLabel(null)).toBeNull();
	});
	it('HDR names', () => {
		expect(rangeLabel('DOVIWithHDR10Plus', 'HDR')).toBe('Dolby Vision · HDR10+');
		expect(rangeLabel('Unknown', 'SDR')).toBe('SDR');
	});
	it('bytes', () => {
		expect(bytes(3_511_000_000)).toBe('3.27 GB');
		expect(bytes(512)).toBe('512 B');
	});
	it('progress prefers server percentage', () => {
		expect(progress({ UserData: { Key: 'k', PlayedPercentage: 40 } })).toBe(40);
		expect(progress({ RunTimeTicks: 100, UserData: { Key: 'k', PlaybackPositionTicks: 25 } })).toBe(25);
		expect(progress({})).toBe(0);
	});
	it('subtitles per type', () => {
		expect(episodeCode({ Type: 'Episode', ParentIndexNumber: 1, IndexNumber: 8 })).toBe('S1 · E8');
		expect(itemSubtitle({ Type: 'Episode', SeriesName: 'Edgerunners', ParentIndexNumber: 1, IndexNumber: 8 })).toBe('Edgerunners · S1 · E8');
		expect(itemSubtitle({ Type: 'MusicAlbum', AlbumArtist: 'Mogwai', ProductionYear: 2026 })).toBe('Mogwai · 2026');
		expect(itemSubtitle({ Type: 'Movie', ProductionYear: 2007, RunTimeTicks: 63 * 60 * 1e7 })).toBe('2007 · 1h 3m');
	});
	it('initials', () => {
		expect(initials('Kenji Mizuhashi')).toBe('KM');
		expect(initials('Zendaya')).toBe('Z');
	});
});
