import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models';

export interface Sample {
	t: number;
	streams: number;
	transcodes: number;
}

const KEEP_MS = 15 * 60_000;

/** A rolling record of how many streams were running, sampled while the dashboard is open. */
class Live {
	samples = $state<Sample[]>([]);

	record(sessions: SessionInfoDto[], t = Date.now()): void {
		const playing = sessions.filter((s) => s.NowPlayingItem);
		const sample: Sample = { t, streams: playing.length, transcodes: playing.filter((s) => s.PlayState?.PlayMethod === 'Transcode').length };
		const last = this.samples[this.samples.length - 1];
		if (last && last.t === t) return;
		this.samples = [...this.samples.filter((s) => t - s.t <= KEEP_MS), sample];
	}
}

export const live = new Live();
