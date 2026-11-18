import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(supported: string[]) {
	vi.resetModules();
	HTMLMediaElement.prototype.canPlayType = (t: string) => (supported.some((s) => t.includes(s)) ? 'probably' : '');
	return (await import('./profile')).deviceProfile();
}

afterEach(() => {
	HTMLMediaElement.prototype.canPlayType = () => '';
});

describe('deviceProfile', () => {
	it('lists only codecs the browser can decode', async () => {
		const p = await load(['avc1', 'mp4a', 'audio/mpeg']);
		const mp4 = p.DirectPlayProfiles!.find((d) => d.Container === 'mp4,m4v')!;
		expect(mp4.VideoCodec).toBe('h264');
		expect(mp4.AudioCodec).toBe('aac,mp3');
		expect(p.DirectPlayProfiles!.some((d) => d.Type === 'Audio' && d.Container === 'flac')).toBe(false);
	});
	it('always offers HLS transcoding for video and audio', async () => {
		const p = await load([]);
		expect(p.TranscodingProfiles!.map((t) => `${t.Type}:${t.Protocol}`)).toEqual(expect.arrayContaining(['Video:hls', 'Audio:hls']));
	});
	it('adds HEVC/AV1 when supported', async () => {
		const p = await load(['avc1', 'hvc1', 'av01', 'mp4a']);
		expect(p.DirectPlayProfiles!.find((d) => d.Container === 'mp4,m4v')!.VideoCodec).toBe('h264,hevc,av1');
	});
});
