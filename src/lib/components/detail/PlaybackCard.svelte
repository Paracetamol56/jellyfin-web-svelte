<script lang="ts">
	import type { BaseItemDto, MediaStream } from '@jellyfin/sdk/lib/generated-client/models';
	import { bytes, qualityLabel, rangeLabel } from '#lib/api/format.ts';

	let {
		item,
		sourceId = $bindable(),
		audioIndex = $bindable(),
		subtitleIndex = $bindable()
	}: { item: BaseItemDto; sourceId?: string; audioIndex?: number; subtitleIndex?: number } = $props();

	const sources = $derived(item.MediaSources ?? []);
	const source = $derived(sources.find((s) => s.Id === sourceId) ?? sources[0]);
	const streams = $derived(source?.MediaStreams ?? []);
	const video = $derived(streams.find((s) => s.Type === 'Video'));
	const audio = $derived(streams.filter((s) => s.Type === 'Audio'));
	const subs = $derived(streams.filter((s) => s.Type === 'Subtitle'));

	// Defaults follow the server's choice for this source.
	$effect(() => {
		if (!source) return;
		sourceId ??= source.Id ?? undefined;
		audioIndex ??= source.DefaultAudioStreamIndex ?? audio[0]?.Index ?? undefined;
		subtitleIndex ??= source.DefaultSubtitleStreamIndex ?? -1;
	});

	function videoLabel(v: MediaStream | undefined): string {
		if (!v) return '';
		return [qualityLabel(v.Height, v.Width)?.toLowerCase(), v.Codec?.toUpperCase(), rangeLabel(v.VideoRangeType, v.VideoRange)]
			.filter(Boolean)
			.join(' · ');
	}

	const select = 'border-border bg-background h-11 w-full rounded-xl border px-3.5 text-sm';
	const row = 'flex justify-between gap-3 text-sm';
</script>

{#if source}
	<div class="bg-card border-border flex flex-col gap-3.5 rounded-[20px] border p-[22px]">
		<h2 class="text-muted-foreground font-sans text-xs font-bold tracking-[0.1em] uppercase">Playback</h2>
		{#if sources.length > 1}
			<div class="flex flex-col gap-1.5">
				<label for="pb-source" class="text-muted-foreground text-sm">Version</label>
				<select id="pb-source" class={select} bind:value={sourceId} onchange={() => ((audioIndex = undefined), (subtitleIndex = undefined))}>
					{#each sources as s (s.Id)}<option value={s.Id}>{s.Name}</option>{/each}
				</select>
			</div>
		{/if}
		{#if video}
			<div class={row}><span class="text-muted-foreground">Video</span><span class="text-right">{videoLabel(video)}</span></div>
		{/if}
		{#if audio.length}
			<div class="flex flex-col gap-1.5">
				<label for="pb-audio" class="text-muted-foreground text-sm">Audio</label>
				<select id="pb-audio" class={select} bind:value={audioIndex}>
					{#each audio as a (a.Index)}<option value={a.Index}>{a.DisplayTitle ?? a.Language ?? `Track ${a.Index}`}</option>{/each}
				</select>
			</div>
		{/if}
		<div class="flex flex-col gap-1.5">
			<label for="pb-subs" class="text-muted-foreground text-sm">Subtitles</label>
			<select id="pb-subs" class={select} bind:value={subtitleIndex} disabled={!subs.length}>
				<option value={-1}>Off</option>
				{#each subs as s (s.Index)}<option value={s.Index}>{s.DisplayTitle ?? s.Language ?? `Track ${s.Index}`}</option>{/each}
			</select>
		</div>
		{#if source.Size}
			<div class="{row} border-border border-t pt-3"><span class="text-muted-foreground">File size</span><span>{bytes(source.Size)}</span></div>
		{/if}
	</div>
{/if}
