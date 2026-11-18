import Hls from 'hls.js';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import type { BaseItemDto, MediaSourceInfo, PlayMethod } from '@jellyfin/sdk/lib/generated-client/models';
import { api, jellyfin, session } from '#lib/api/session.svelte.ts';
import { primaryImage } from '#lib/api/images.ts';
import { secondsToTicks, ticksToSeconds } from '#lib/api/format.ts';
import { deviceProfile } from './profile.ts';

export type Repeat = 'off' | 'all' | 'one';
export interface PlayOptions {
	/** Start position in seconds; defaults to the saved resume point. */
	start?: number;
	sourceId?: string;
	audioIndex?: number;
	/** -1 turns subtitles off. */
	subtitleIndex?: number;
}

const REPORT_INTERVAL = 10_000;
const QUEUE_KEY = 'jf.queue';

function store(): Storage | null {
	try {
		return localStorage;
	} catch {
		return null;
	}
}

/** Developer switch: play without telling the server (no watch history or resume points). */
function reportingEnabled(): boolean {
	return store()?.getItem('jf.disablePlaybackReporting') !== '1';
}

class Player {
	queue = $state<BaseItemDto[]>([]);
	index = $state(0);
	current: BaseItemDto | null = $derived(this.queue[this.index] ?? null);
	kind: 'audio' | 'video' | null = $derived(
		this.current ? (this.current.MediaType === 'Audio' ? 'audio' : 'video') : null
	);

	playing = $state(false);
	buffering = $state(false);
	time = $state(0);
	duration = $state(0);
	error = $state<string | null>(null);
	volume = $state(Number(store()?.getItem('jf.volume') ?? 1));
	muted = $state(false);
	repeat = $state<Repeat>('off');
	shuffled = $state(false);
	playMethod = $state<PlayMethod | null>(null);
	source = $state<MediaSourceInfo | null>(null);
	audioIndex = $state<number | undefined>(undefined);
	subtitleIndex = $state<number>(-1);

	private options: PlayOptions = {};
	private original: BaseItemDto[] = [];
	private audioEl: HTMLAudioElement | null = null;
	private videoEl: HTMLVideoElement | null = null;
	private hls: Hls | null = null;
	private playSessionId: string | null = null;
	private reportTimer: ReturnType<typeof setInterval> | null = null;
	private loadToken = 0;

	get el(): HTMLMediaElement | null {
		return this.kind === 'audio' ? this.audioEl : this.videoEl;
	}

	get progress(): number {
		return this.duration ? (this.time / this.duration) * 100 : 0;
	}

	// ── public API ────────────────────────────────────────────────

	async play(items: BaseItemDto[], index = 0, options: PlayOptions = {}): Promise<void> {
		await this.endCurrent();
		items = items.map((i) => ({ ...i })); // own copies: the same track can be queued twice
		this.original = items;
		this.queue = items;
		this.shuffled = false;
		this.index = index;
		this.options = options;
		this.save();
		await this.load();
	}

	/** Bring back the last music queue (paused) after a reload. */
	restore(): void {
		if (this.current) return;
		try {
			const raw = store()?.getItem(QUEUE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as { userId: string; queue: BaseItemDto[]; index: number; time: number };
			if (saved.userId !== session.userId || !saved.queue?.length) return;
			this.original = saved.queue;
			this.queue = saved.queue;
			this.index = Math.min(saved.index, saved.queue.length - 1);
			this.time = saved.time ?? 0;
			this.duration = ticksToSeconds(saved.queue[this.index]?.RunTimeTicks);
		} catch {
			store()?.removeItem(QUEUE_KEY);
		}
	}

	private lastSave = 0;
	/** Music queues survive reloads; video always restarts from its page. */
	private save(force = true): void {
		if (!force && Date.now() - this.lastSave < 5000) return;
		this.lastSave = Date.now();
		try {
			if (!this.queue.length || this.kind !== 'audio') store()?.removeItem(QUEUE_KEY);
			else
				store()?.setItem(
					QUEUE_KEY,
					JSON.stringify({ userId: session.userId, queue: this.queue.slice(0, 500), index: this.index, time: Math.floor(this.time) })
				);
		} catch {
			/* storage full or blocked: not worth failing playback over */
		}
	}

	/** Append to the queue (or start playing if nothing is). */
	enqueue(items: BaseItemDto[]): void {
		if (!this.current) {
			this.play(items);
			return;
		}
		const copies = items.map((i) => ({ ...i }));
		this.queue = [...this.queue, ...copies];
		this.original = [...this.original, ...copies];
		this.save();
	}

	/** Insert right after the current track. */
	playNext(items: BaseItemDto[]): void {
		if (!this.current) {
			this.play(items);
			return;
		}
		const copies = items.map((i) => ({ ...i }));
		const q = [...this.queue];
		q.splice(this.index + 1, 0, ...copies);
		this.queue = q;
		const at = this.original.indexOf(this.current);
		const o = [...this.original];
		o.splice(at + 1, 0, ...copies);
		this.original = o;
		this.save();
	}

	/** Remove one entry; removing the playing track moves on to the next one. */
	async removeAt(i: number): Promise<void> {
		if (i < 0 || i >= this.queue.length) return;
		const entry = this.queue[i];
		this.original = this.original.filter((o) => o !== entry);
		if (i !== this.index) {
			this.queue = this.queue.filter((_, k) => k !== i);
			if (i < this.index) this.index--;
			this.save();
			return;
		}
		const wasPlaying = this.playing;
		await this.endCurrent();
		const q = this.queue.filter((_, k) => k !== i);
		if (!q.length) {
			this.queue = [];
			this.index = 0;
			this.save();
			this.updateMediaSession();
			return;
		}
		this.queue = q;
		this.index = Math.min(i, q.length - 1);
		this.time = 0;
		this.options = {};
		this.save();
		if (wasPlaying) await this.load();
		else this.updateMediaSession();
	}

	/** Reorder: move the entry at `from` so it ends up at `to`. */
	move(from: number, to: number): void {
		const n = this.queue.length;
		if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
		const cur = this.queue[this.index];
		const q = [...this.queue];
		const [entry] = q.splice(from, 1);
		q.splice(to, 0, entry);
		this.queue = q;
		this.index = q.indexOf(cur);
		this.save();
	}

	/** Keep the current track, drop everything after it. */
	clearUpcoming(): void {
		const keep = this.queue.slice(0, this.index + 1);
		this.original = this.original.filter((o) => keep.includes(o));
		this.queue = keep;
		this.save();
	}

	/** Apply server user data (favourite, played) to queued copies of an item. */
	patch(itemId: string, change: Partial<BaseItemDto>): void {
		this.queue = this.queue.map((q) => (q.Id === itemId ? { ...q, ...change, UserData: { ...q.UserData, ...change.UserData } as BaseItemDto['UserData'] } : q));
		this.original = this.original.map((o) => this.queue.find((q) => q.Id === o.Id && o.Id === itemId) ?? o);
	}

	toggle(): void {
		const el = this.el;
		// Restored queue: nothing loaded yet, so start the stream where we left off.
		if (this.current && (!el || !this.source)) {
			this.options = { start: this.time };
			this.load();
			return;
		}
		if (!el) return;
		if (el.paused) el.play().catch(() => {});
		else el.pause();
	}

	seek(seconds: number): void {
		const el = this.el;
		if (!el || !this.source) {
			// Restored queue that isn't loaded yet: just move the start point.
			this.time = Math.max(0, Math.min(seconds, this.duration || seconds));
			this.save();
			return;
		}
		el.currentTime = Math.max(0, Math.min(seconds, this.duration || seconds));
		this.time = el.currentTime;
		this.report('progress');
	}

	skip(delta: number): void {
		this.seek(this.time + delta);
	}

	async next(): Promise<void> {
		if (this.index < this.queue.length - 1) await this.jump(this.index + 1);
		else if (this.repeat === 'all' && this.queue.length) await this.jump(0);
	}

	async previous(): Promise<void> {
		// Like most players: restart the track unless we're near its start.
		if (this.time > 3 || this.index === 0) this.seek(0);
		else await this.jump(this.index - 1);
	}

	async jump(index: number): Promise<void> {
		if (index < 0 || index >= this.queue.length) return;
		await this.endCurrent();
		this.index = index;
		this.options = {};
		this.time = 0;
		this.save();
		await this.load();
	}

	setVolume(v: number): void {
		this.volume = Math.max(0, Math.min(1, v));
		this.muted = this.volume === 0;
		if (this.el) {
			this.el.volume = this.volume;
			this.el.muted = this.muted;
		}
		store()?.setItem('jf.volume', String(this.volume));
	}

	toggleMute(): void {
		this.muted = !this.muted;
		if (this.el) this.el.muted = this.muted;
	}

	cycleRepeat(): void {
		this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
	}

	toggleShuffle(): void {
		const cur = this.current;
		if (!cur) return;
		if (this.shuffled) {
			this.queue = this.original;
			this.index = Math.max(0, this.original.findIndex((i) => i.Id === cur.Id));
		} else {
			const rest = this.queue.filter((_, i) => i !== this.index);
			for (let i = rest.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[rest[i], rest[j]] = [rest[j], rest[i]];
			}
			this.queue = [cur, ...rest];
			this.index = 0;
		}
		this.shuffled = !this.shuffled;
		this.save();
	}

	/** Change audio or subtitle track; restarts the stream at the current position. */
	async setTracks(t: { audioIndex?: number; subtitleIndex?: number }): Promise<void> {
		const at = this.time;
		await this.endCurrent();
		this.options = {
			...this.options,
			sourceId: this.source?.Id ?? undefined,
			audioIndex: t.audioIndex ?? this.audioIndex,
			subtitleIndex: t.subtitleIndex ?? this.subtitleIndex,
			start: at
		};
		await this.load();
	}

	async stop(): Promise<void> {
		await this.endCurrent();
		this.queue = [];
		this.original = [];
		this.index = 0;
		this.time = 0;
		this.save();
		this.updateMediaSession();
	}

	/** The video page hands its element over while it is mounted. */
	attachVideo(el: HTMLVideoElement): void {
		this.videoEl = el;
		this.bind(el);
		if (this.kind === 'video') this.load();
	}

	detachVideo(el: HTMLVideoElement): void {
		if (this.videoEl !== el) return;
		if (this.kind === 'video') this.stop();
		this.videoEl = null;
	}

	// ── loading ───────────────────────────────────────────────────

	private async load(): Promise<void> {
		const item = this.current;
		if (!item?.Id) return;
		if (this.kind === 'audio' && !this.audioEl) {
			this.audioEl = new Audio();
			this.audioEl.preload = 'auto';
			this.bind(this.audioEl);
		}
		const el = this.el;
		if (!el) return; // video waits for attachVideo()

		const token = ++this.loadToken;
		this.error = null;
		this.buffering = true;
		this.time = this.options.start ?? ticksToSeconds(item.UserData?.PlaybackPositionTicks);
		this.duration = ticksToSeconds(item.RunTimeTicks);
		this.updateMediaSession();

		try {
			const profile = deviceProfile();
			const { data } = await getMediaInfoApi(api()).getPostedPlaybackInfo({
				itemId: item.Id,
				playbackInfoDto: {
					UserId: session.userId,
					DeviceProfile: profile,
					MediaSourceId: this.options.sourceId,
					AudioStreamIndex: this.options.audioIndex,
					SubtitleStreamIndex: this.options.subtitleIndex,
					StartTimeTicks: secondsToTicks(this.time),
					MaxStreamingBitrate: 120_000_000,
					AutoOpenLiveStream: true,
					EnableDirectPlay: true,
					EnableDirectStream: true,
					EnableTranscoding: true
				}
			});
			if (token !== this.loadToken) return;
			if (data.ErrorCode) throw new Error(`Server refused playback (${data.ErrorCode})`);
			const source = data.MediaSources?.find((s) => s.Id === this.options.sourceId) ?? data.MediaSources?.[0];
			if (!source) throw new Error('No playable source');

			this.source = source;
			this.playSessionId = data.PlaySessionId ?? null;
			this.audioIndex = this.options.audioIndex ?? source.DefaultAudioStreamIndex ?? undefined;
			this.subtitleIndex = this.options.subtitleIndex ?? source.DefaultSubtitleStreamIndex ?? -1;

			const direct = source.SupportsDirectPlay || (!source.TranscodingUrl && source.SupportsDirectStream);
			if (!direct && !source.TranscodingUrl) throw new Error("This file can't be played in this browser, and the server didn't offer a converted stream.");
			this.playMethod = direct ? 'DirectPlay' : 'Transcode';
			const base = session.serverUrl!;
			const url = direct
				? `${base}/${this.kind === 'audio' ? 'Audio' : 'Videos'}/${item.Id}/stream?${new URLSearchParams({
						static: 'true',
						mediaSourceId: source.Id ?? '',
						deviceId: jellyfin.deviceInfo.id,
						api_key: session.accessToken ?? '',
						...(source.ETag ? { Tag: source.ETag } : {})
					})}`
				: base + source.TranscodingUrl;

			this.attachSource(el, url);
			if (this.kind === 'video') this.attachSubtitles(el as HTMLVideoElement, source);
			el.volume = this.volume;
			el.muted = this.muted;

			const start = this.time;
			// Transcodes already start at StartTimeTicks; direct play seeks client-side.
			if (direct && start > 0) el.addEventListener('loadedmetadata', () => (el.currentTime = start), { once: true });
			await el.play().catch((e: DOMException) => {
				if (e.name !== 'AbortError') throw e;
			});
			this.report('start');
		} catch (e) {
			if (token !== this.loadToken) return;
			this.buffering = false;
			this.playing = false;
			this.error = e instanceof Error ? e.message : 'Playback failed';
		}
	}

	private attachSource(el: HTMLMediaElement, url: string): void {
		this.hls?.destroy();
		this.hls = null;
		const isHls = url.includes('.m3u8');
		if (isHls && !el.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
			const hls = new Hls({ startPosition: 0, maxBufferLength: 30 });
			hls.on(Hls.Events.ERROR, (_e, d) => {
				if (d.fatal) this.error = `Stream error: ${d.details}`;
			});
			hls.loadSource(url);
			hls.attachMedia(el);
			this.hls = hls;
		} else {
			el.src = url;
		}
	}

	private attachSubtitles(el: HTMLVideoElement, source: MediaSourceInfo): void {
		el.querySelectorAll('track').forEach((t) => t.remove());
		const sub = source.MediaStreams?.find((s) => s.Type === 'Subtitle' && s.Index === this.subtitleIndex);
		if (!sub || sub.DeliveryMethod !== 'External' || !sub.DeliveryUrl) return; // burned in, or off
		const track = document.createElement('track');
		track.kind = 'subtitles';
		track.label = sub.DisplayTitle ?? sub.Language ?? 'Subtitles';
		track.srclang = sub.Language ?? 'und';
		track.src = sub.IsExternalUrl ? sub.DeliveryUrl : session.serverUrl + sub.DeliveryUrl;
		track.default = true;
		el.appendChild(track);
		track.track.mode = 'showing';
	}

	// ── element events ────────────────────────────────────────────

	private bound = new WeakSet<HTMLMediaElement>();

	private bind(el: HTMLMediaElement): void {
		if (this.bound.has(el)) return;
		this.bound.add(el);
		el.addEventListener('playing', () => {
			this.playing = true;
			this.buffering = false;
			this.startReporting();
		});
		el.addEventListener('pause', () => {
			this.playing = false;
			this.report('progress');
		});
		el.addEventListener('waiting', () => (this.buffering = true));
		el.addEventListener('canplay', () => (this.buffering = false));
		el.addEventListener('timeupdate', () => {
			if (el !== this.el) return;
			this.time = el.currentTime;
			this.save(false);
		});
		el.addEventListener('durationchange', () => {
			if (el === this.el && Number.isFinite(el.duration) && el.duration > 0) this.duration = el.duration;
		});
		el.addEventListener('ended', () => this.onEnded());
		el.addEventListener('error', () => {
			if (el !== this.el || !el.error) return;
			this.error = el.error.message || 'This file could not be played';
			this.buffering = false;
		});
	}

	private async onEnded(): Promise<void> {
		if (this.repeat === 'one') {
			this.seek(0);
			this.el?.play();
			return;
		}
		if (this.index < this.queue.length - 1 || this.repeat === 'all') await this.next();
		else {
			await this.endCurrent();
			this.playing = false;
		}
	}

	// ── server reporting ──────────────────────────────────────────

	private startReporting(): void {
		if (this.reportTimer) return;
		this.reportTimer = setInterval(() => this.report('progress'), REPORT_INTERVAL);
	}

	private stopReporting(): void {
		if (this.reportTimer) clearInterval(this.reportTimer);
		this.reportTimer = null;
	}

	private report(kind: 'start' | 'progress' | 'stop'): Promise<unknown> | void {
		const item = this.current;
		if (!item?.Id || !this.playSessionId || !session.api || !reportingEnabled()) return;
		const info = {
			ItemId: item.Id,
			MediaSourceId: this.source?.Id ?? undefined,
			PlaySessionId: this.playSessionId,
			PositionTicks: secondsToTicks(this.time),
			PlayMethod: this.playMethod ?? undefined,
			AudioStreamIndex: this.audioIndex,
			SubtitleStreamIndex: this.subtitleIndex,
			IsPaused: !this.playing,
			IsMuted: this.muted,
			VolumeLevel: Math.round(this.volume * 100),
			CanSeek: true,
			RepeatMode: this.repeat === 'one' ? 'RepeatOne' : this.repeat === 'all' ? 'RepeatAll' : 'RepeatNone',
			NowPlayingQueue: this.queue.slice(0, 100).map((i) => ({ Id: i.Id, PlaylistItemId: i.PlaylistItemId }))
		} as const;
		const s = getSessionApi(session.api);
		const p =
			kind === 'start'
				? s.reportPlaybackStart({ playbackStartInfo: info })
				: kind === 'progress'
					? s.reportPlaybackProgress({ playbackProgressInfo: info })
					: s.reportPlaybackStopped({
							playbackStopInfo: { ItemId: info.ItemId, MediaSourceId: info.MediaSourceId, PlaySessionId: info.PlaySessionId, PositionTicks: info.PositionTicks }
						});
		return p.catch(() => {});
	}

	/** Report the stop and release the stream (the server kills the transcode). */
	private async endCurrent(): Promise<void> {
		this.loadToken++;
		this.stopReporting();
		const el = this.el;
		if (this.playSessionId) await this.report('stop');
		this.playSessionId = null;
		this.hls?.destroy();
		this.hls = null;
		if (el) {
			el.pause();
			el.removeAttribute('src');
			el.load();
		}
		this.playing = false;
		this.buffering = false;
		this.source = null;
	}

	// ── OS media controls (lock screen, media keys) ───────────────

	private updateMediaSession(): void {
		if (!('mediaSession' in navigator)) return;
		const item = this.current;
		if (!item) {
			navigator.mediaSession.metadata = null;
			return;
		}
		const art = primaryImage(item, 512);
		navigator.mediaSession.metadata = new MediaMetadata({
			title: item.Name ?? '',
			artist: item.Type === 'Episode' ? (item.SeriesName ?? '') : (item.Artists ?? []).join(', '),
			album: item.Album ?? (item.Type === 'Episode' ? (item.SeasonName ?? '') : ''),
			artwork: art ? [{ src: art, sizes: '512x512' }] : []
		});
		const ms = navigator.mediaSession;
		ms.setActionHandler('play', () => this.el?.play());
		ms.setActionHandler('pause', () => this.el?.pause());
		ms.setActionHandler('nexttrack', () => this.next());
		ms.setActionHandler('previoustrack', () => this.previous());
		ms.setActionHandler('seekto', (d) => d.seekTime != null && this.seek(d.seekTime));
	}
}

export const player = new Player();
