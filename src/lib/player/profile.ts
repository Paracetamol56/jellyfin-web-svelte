import { getBrowserDeviceProfile } from '@jellyfin/sdk/lib/utils/browser-profiles';
import type { DeviceProfile, DirectPlayProfile, TranscodingProfile } from '@jellyfin/sdk/lib/generated-client/models';

// What this browser can play natively, from canPlayType probes, plus how to
// transcode the rest (HLS, played through hls.js where not native).
// The SDK's own profile helper only describes subtitles.

let cached: DeviceProfile | null = null;

function probe(el: HTMLMediaElement, type: string): boolean {
	return el.canPlayType(type).replace(/no/, '') !== '';
}

export function deviceProfile(): DeviceProfile {
	if (cached) return cached;
	const v = document.createElement('video');
	const a = document.createElement('audio');
	const ua = navigator.userAgent;
	const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/iPhone|iPad/.test(ua);
	const firefox = /Firefox\//.test(ua);
	const safari = !chromium && !firefox && /Safari\//.test(ua);

	const videoCodecs: string[] = [];
	if (probe(v, 'video/mp4; codecs="avc1.640029"')) videoCodecs.push('h264');
	if (probe(v, 'video/mp4; codecs="hvc1.1.6.L120.90"') || probe(v, 'video/mp4; codecs="hev1.1.6.L120.90"')) videoCodecs.push('hevc');
	if (probe(v, 'video/mp4; codecs="av01.0.08M.08"')) videoCodecs.push('av1');
	if (probe(v, 'video/webm; codecs="vp9"')) videoCodecs.push('vp9');

	const audioCodecs: string[] = [];
	if (probe(a, 'audio/mp4; codecs="mp4a.40.2"')) audioCodecs.push('aac');
	if (probe(a, 'audio/mpeg')) audioCodecs.push('mp3');
	if (probe(a, 'audio/ogg; codecs="opus"') || probe(a, 'audio/webm; codecs="opus"')) audioCodecs.push('opus');
	if (probe(a, 'audio/flac')) audioCodecs.push('flac');
	if (probe(a, 'audio/ogg; codecs="vorbis"')) audioCodecs.push('vorbis');
	if (probe(a, 'audio/mp4; codecs="ac-3"')) audioCodecs.push('ac3');
	if (probe(a, 'audio/mp4; codecs="ec-3"')) audioCodecs.push('eac3');
	if (probe(a, 'audio/mp4; codecs="alac"')) audioCodecs.push('alac');
	if (probe(a, 'audio/wav')) audioCodecs.push('pcm_s16le', 'pcm_s24le');

	const vc = videoCodecs.join(',');
	const ac = audioCodecs.filter((c) => !c.startsWith('pcm')).join(',');
	const direct: DirectPlayProfile[] = [
		{ Container: 'mp4,m4v', Type: 'Video', VideoCodec: vc, AudioCodec: ac },
		{ Container: 'webm', Type: 'Video', VideoCodec: videoCodecs.filter((c) => ['vp9', 'av1'].includes(c)).concat('vp8').join(','), AudioCodec: 'opus,vorbis' }
	];
	// Chromium (and recent Firefox) handle Matroska with codecs they support.
	if (chromium || firefox) direct.push({ Container: 'mkv', Type: 'Video', VideoCodec: vc, AudioCodec: ac });
	if (safari) direct.push({ Container: 'mov', Type: 'Video', VideoCodec: vc, AudioCodec: ac });

	const audioContainers: [string, string][] = [
		['mp3', 'mp3'],
		['aac', 'aac'],
		['m4a,mp4,m4b', audioCodecs.filter((c) => ['aac', 'alac', 'flac', 'opus'].includes(c)).join(',')],
		['flac', 'flac'],
		['ogg,oga', 'opus,vorbis,flac'],
		['webm,webma', 'opus,vorbis'],
		['opus', 'opus'],
		['wav', 'pcm_s16le,pcm_s24le']
	];
	for (const [container, codecs] of audioContainers) {
		const usable = codecs.split(',').filter((c) => audioCodecs.includes(c));
		if (usable.length) direct.push({ Container: container, Type: 'Audio', AudioCodec: usable.join(',') });
	}

	const transcodeVideo = videoCodecs.includes('hevc') && safari ? 'hevc,h264' : 'h264';
	const transcoding: TranscodingProfile[] = [
		{
			Container: 'ts',
			Type: 'Video',
			VideoCodec: transcodeVideo,
			AudioCodec: audioCodecs.includes('ac3') ? 'aac,mp3,ac3' : 'aac,mp3',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: '6',
			MinSegments: 1,
			BreakOnNonKeyFrames: true
		},
		{
			Container: 'ts',
			Type: 'Audio',
			AudioCodec: 'aac',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: '2',
			MinSegments: 1,
			BreakOnNonKeyFrames: true
		},
		{ Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Static', Protocol: 'http', MaxAudioChannels: '2' }
	];

	cached = {
		Name: 'Jellyfin Svelte Client',
		MaxStreamingBitrate: 120_000_000,
		MaxStaticBitrate: 100_000_000,
		MusicStreamingTranscodingBitrate: 384_000,
		DirectPlayProfiles: direct,
		TranscodingProfiles: transcoding,
		ContainerProfiles: [],
		CodecProfiles: [],
		SubtitleProfiles: getBrowserDeviceProfile({ ssaExternal: true }, v).SubtitleProfiles
	};
	return cached;
}
