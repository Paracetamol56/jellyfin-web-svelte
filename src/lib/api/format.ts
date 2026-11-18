import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

const TICKS_PER_SECOND = 10_000_000;

export function ticksToSeconds(ticks: number | null | undefined): number {
	return (ticks ?? 0) / TICKS_PER_SECOND;
}

export function secondsToTicks(seconds: number): number {
	return Math.round(seconds * TICKS_PER_SECOND);
}

/** 125 → "2:05", 3725 → "1:02:05" */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Runtime as "1h 43m" / "22m". */
export function duration(ticks: number | null | undefined): string {
	const mins = Math.round(ticksToSeconds(ticks) / 60);
	if (!mins) return '';
	const h = Math.floor(mins / 60);
	return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function minutesLeft(item: BaseItemDto): string {
	const total = item.RunTimeTicks ?? 0;
	const done = item.UserData?.PlaybackPositionTicks ?? 0;
	const mins = Math.max(1, Math.round(ticksToSeconds(total - done) / 60));
	return `${mins} minute${mins === 1 ? '' : 's'} left`;
}

export function progress(item: BaseItemDto): number {
	const pct = item.UserData?.PlayedPercentage;
	if (pct) return Math.min(100, pct);
	const total = item.RunTimeTicks ?? 0;
	return total ? Math.min(100, ((item.UserData?.PlaybackPositionTicks ?? 0) / total) * 100) : 0;
}

/** Resolution class; uses width too so letterboxed films (3840×1600) aren't under-labelled. */
export function qualityLabel(height: number | null | undefined, width?: number | null): string | null {
	if (!height && !width) return null;
	const h = height ?? 0;
	const w = width ?? 0;
	if (w >= 3200 || h >= 2000) return '4K';
	if (w >= 2400 || h >= 1400) return '1440P';
	if (w >= 1800 || h >= 1000) return '1080P';
	if (w >= 1200 || h >= 700) return '720P';
	if (w >= 960 || h >= 540) return '540P';
	return 'SD';
}

const RANGES: Record<string, string> = {
	DOVI: 'Dolby Vision',
	DOVIWithHDR10: 'Dolby Vision · HDR10',
	DOVIWithHDR10Plus: 'Dolby Vision · HDR10+',
	DOVIWithHLG: 'Dolby Vision · HLG',
	DOVIWithSDR: 'Dolby Vision',
	HDR10: 'HDR10',
	HDR10Plus: 'HDR10+',
	HLG: 'HLG',
	SDR: 'SDR'
};
export function rangeLabel(rangeType: string | null | undefined, range: string | null | undefined): string | null {
	if (rangeType && rangeType !== 'Unknown') return RANGES[rangeType] ?? rangeType;
	return range && range !== 'Unknown' ? range : null;
}

/** "S1 · E8" */
export function episodeCode(item: BaseItemDto): string {
	if (item.Type !== 'Episode') return '';
	const s = item.ParentIndexNumber != null ? `S${item.ParentIndexNumber}` : '';
	const e = item.IndexNumber != null ? `E${item.IndexNumber}` : '';
	return [s, e].filter(Boolean).join(' · ');
}

export function itemSubtitle(item: BaseItemDto): string {
	switch (item.Type) {
		case 'Episode':
			return [item.SeriesName, episodeCode(item)].filter(Boolean).join(' · ');
		case 'MusicAlbum':
		case 'Audio':
			return [item.AlbumArtist ?? item.Artists?.[0], item.ProductionYear].filter(Boolean).join(' · ');
		case 'Series':
			return [item.ProductionYear, item.Status === 'Continuing' ? 'Ongoing' : null].filter(Boolean).join(' · ');
		default:
			return [item.ProductionYear, duration(item.RunTimeTicks)].filter(Boolean).join(' · ');
	}
}

export function bytes(n: number | null | undefined): string {
	if (!n) return '';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let i = 0;
	let v = n;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 100 || i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Wall-clock time the item would finish if started now. */
export function endsAt(item: BaseItemDto): string {
	const total = item.RunTimeTicks ?? 0;
	if (!total) return '';
	const left = ticksToSeconds(total - (item.UserData?.PlaybackPositionTicks ?? 0));
	return new Date(Date.now() + left * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function initials(name: string | null | undefined): string {
	return (name ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join('');
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
/** "3 minutes ago", "yesterday"… */
export function ago(date: string | null | undefined): string {
	if (!date) return '';
	const s = (new Date(date).getTime() - Date.now()) / 1000;
	const abs = Math.abs(s);
	if (abs < 45) return 'just now';
	if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
	if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
	return new Date(date).toLocaleDateString();
}

/** "TranscodeReasons" values → short human text. */
export function transcodeReason(r: string): string {
	return r
		.replace(/NotSupported$/, ' not supported')
		.replace(/ExceedsLimit$/, ' over the limit')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/^./, (c) => c.toUpperCase());
}
