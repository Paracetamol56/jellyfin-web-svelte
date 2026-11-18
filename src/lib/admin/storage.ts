import type { SystemStorageDto } from '@jellyfin/sdk/lib/generated-client/models';

export interface Disk {
	free: number;
	used: number;
	folders: { label: string; path: string }[];
}

/** Folders on the same disk report identical numbers: one entry per disk, with its folders listed, biggest first. */
export function groupDisks(s: SystemStorageDto): Disk[] {
	const folders = [
		['Program data', s.ProgramDataFolder],
		['Cache', s.CacheFolder],
		['Image cache', s.ImageCacheFolder],
		['Metadata', s.InternalMetadataFolder],
		['Transcoding', s.TranscodingTempFolder],
		['Logs', s.LogFolder],
		...(s.Libraries ?? []).flatMap((l) => (l.Folders ?? []).map((f) => [l.Name ?? 'Library', f] as const))
	] as const;
	const byDisk = new Map<string, Disk>();
	for (const [label, f] of folders) {
		if (!f) continue;
		const key = f.DeviceId || `${f.FreeSpace}-${f.UsedSpace}`;
		const d = byDisk.get(key) ?? { free: f.FreeSpace ?? 0, used: f.UsedSpace ?? 0, folders: [] };
		d.folders.push({ label, path: f.Path ?? '' });
		byDisk.set(key, d);
	}
	return [...byDisk.values()].sort((a, b) => b.free + b.used - (a.free + a.used));
}
