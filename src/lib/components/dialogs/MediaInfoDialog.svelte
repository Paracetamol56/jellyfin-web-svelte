<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { BaseItemDto, MediaStream } from '@jellyfin/sdk/lib/generated-client/models';
	import { fetchItem } from '#lib/api/queries.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { bytes, duration, rangeLabel } from '#lib/api/format.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	let { item, open = $bindable() }: { item: BaseItemDto; open: boolean } = $props();

	const full = createQuery(() => ({ queryKey: ['item', session.userId, item.Id], queryFn: () => fetchItem(item.Id!) }));
	const it = $derived(full.data ?? item);
	const source = $derived(it.MediaSources?.[0]);
	const streams = $derived(source?.MediaStreams ?? []);

	const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null);
	const kbps = (n: number | null | undefined) => (n ? (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mbps` : `${Math.round(n / 1000)} kbps`) : null);

	function details(s: MediaStream): string {
		if (s.Type === 'Video')
			return [s.Width && s.Height ? `${s.Width}×${s.Height}` : null, s.RealFrameRate ? `${+s.RealFrameRate.toFixed(3)} fps` : null, s.BitDepth ? `${s.BitDepth}-bit` : null, rangeLabel(s.VideoRangeType, s.VideoRange), s.Profile].filter(Boolean).join(' · ');
		if (s.Type === 'Audio')
			return [s.ChannelLayout ?? (s.Channels ? `${s.Channels} ch` : null), s.SampleRate ? `${(s.SampleRate / 1000).toFixed(1)} kHz` : null, s.BitDepth ? `${s.BitDepth}-bit` : null, s.Profile].filter(Boolean).join(' · ');
		return [s.Title, s.IsForced ? 'Forced' : null, s.IsExternal ? 'External' : 'Embedded'].filter(Boolean).join(' · ');
	}

	const general = $derived(
		[
			['Type', it.Type],
			['Container', source?.Container],
			['Size', bytes(source?.Size)],
			['Bitrate', kbps(source?.Bitrate)],
			['Runtime', duration(it.RunTimeTicks)],
			['Released', it.PremiereDate ? new Date(it.PremiereDate).toLocaleDateString() : null],
			['Added', date(it.DateCreated)],
			['Last played', date(it.UserData?.LastPlayedDate)],
			['Play count', it.UserData?.PlayCount ? String(it.UserData.PlayCount) : null],
			['Path', source?.Path ?? it.Path],
			['Item ID', it.Id]
		].filter(([, v]) => v) as [string, string][]
	);
	const providers = $derived(Object.entries(it.ProviderIds ?? {}).filter(([, v]) => v));
	const row = 'grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-1.5 text-sm';
</script>

<Dialog bind:open title="Media info" description={it.Name ?? ''} wide>
	{#if full.isPending}
		<div class="flex flex-col gap-2">{#each { length: 6 } as _, i (i)}<Skeleton class="h-6" />{/each}</div>
	{:else}
		<dl class="divide-border divide-y">
			{#each general as [k, v] (k)}
				<div class={row}><dt class="text-muted-foreground">{k}</dt><dd class="font-mono text-[13px] break-all">{v}</dd></div>
			{/each}
			{#if providers.length}
				<div class={row}><dt class="text-muted-foreground">Provider IDs</dt><dd class="font-mono text-[13px] break-all">{providers.map(([k, v]) => `${k}: ${v}`).join(' · ')}</dd></div>
			{/if}
		</dl>
		{#if streams.length}
			<h3 class="mt-6 mb-2 font-sans text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">Streams</h3>
			<div class="border-border overflow-x-auto rounded-xl border">
				<table class="w-full text-left text-sm">
					<thead class="bg-muted text-muted-foreground text-xs">
						<tr><th class="px-3 py-2 font-semibold">#</th><th class="px-3 py-2 font-semibold">Type</th><th class="px-3 py-2 font-semibold">Codec</th><th class="px-3 py-2 font-semibold">Language</th><th class="px-3 py-2 font-semibold">Details</th><th class="px-3 py-2 font-semibold">Bitrate</th></tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each streams as s (s.Index)}
							<tr>
								<td class="px-3 py-2 tabular-nums">{s.Index}</td>
								<td class="px-3 py-2">{s.Type}{s.IsDefault ? ' · default' : ''}</td>
								<td class="px-3 py-2 font-mono text-[13px] uppercase">{s.Codec ?? ''}</td>
								<td class="px-3 py-2">{s.Language ?? ''}</td>
								<td class="px-3 py-2">{details(s)}</td>
								<td class="px-3 py-2 whitespace-nowrap tabular-nums">{kbps(s.BitRate) ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</Dialog>
