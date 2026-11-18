<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Play from '@lucide/svelte/icons/play';
	import Check from '@lucide/svelte/icons/check';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { backdropImage, primaryImage } from '#lib/api/images.ts';
	import { duration, progress } from '#lib/api/format.ts';
	import { fetchEpisodes, fetchSeasons } from '#lib/api/queries.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';
	import ItemContextMenu from '#lib/components/menu/ItemContextMenu.svelte';
	import ItemMenuButton from '#lib/components/menu/ItemMenuButton.svelte';

	let { series, initialSeasonId, onplay }: { series: BaseItemDto; initialSeasonId?: string; onplay: (episodes: BaseItemDto[], index: number) => void } = $props();

	const seasons = createQuery(() => ({ queryKey: ['seasons', session.userId, series.Id], queryFn: () => fetchSeasons(series.Id!) }));
	let picked = $state<string | undefined>(undefined);
	// First unfinished season by default, so "where was I" is one glance away.
	const seasonId = $derived(
		picked ?? initialSeasonId ?? (seasons.data ?? []).find((s) => !s.UserData?.Played)?.Id ?? seasons.data?.[0]?.Id
	);
	const episodes = createQuery(() => ({
		queryKey: ['episodes', session.userId, series.Id, seasonId],
		queryFn: () => fetchEpisodes(series.Id!, seasonId!),
		enabled: !!seasonId
	}));
</script>

<section aria-labelledby="episodes" class="flex flex-col gap-5">
	<div class="flex flex-wrap items-center gap-4">
		<h2 id="episodes" class="text-2xl font-bold md:text-[30px]">Episodes</h2>
		{#if (seasons.data?.length ?? 0) > 1}
			<div role="group" aria-label="Season" class="flex flex-wrap gap-1">
				{#each seasons.data ?? [] as s (s.Id)}
					<Button
						size="sm"
						variant={seasonId === s.Id ? 'secondary' : 'ghost'}
						aria-pressed={seasonId === s.Id}
						class={seasonId === s.Id ? '' : 'text-muted-foreground font-normal'}
						onclick={() => (picked = s.Id!)}>{s.Name}</Button
					>
				{/each}
			</div>
		{/if}
	</div>

	<ol class="flex list-none flex-col gap-3">
		{#if episodes.isPending}
			{#each { length: 4 } as _, i (i)}<li><Skeleton class="h-[120px] rounded-2xl" /></li>{/each}
		{/if}
		{#each episodes.data ?? [] as ep, i (ep.Id)}
			{@const img = (ep.ImageTags?.Primary ? primaryImage(ep, 480) : null) ?? backdropImage(ep, 480)}
			{@const pct = progress(ep)}
			<li>
			<ItemContextMenu item={ep} context={{ hereId: series.Id ?? undefined }} class="bg-card border-border flex items-center gap-4 rounded-2xl border p-3 md:gap-5">
				<button
					type="button"
					class="group bg-muted relative aspect-video w-[132px] shrink-0 cursor-pointer overflow-hidden rounded-xl md:w-[200px]"
					aria-label="Play episode {ep.IndexNumber}: {ep.Name}"
					onclick={() => onplay(episodes.data ?? [], i)}
				>
					{#if img}<img src={img} alt="" loading="lazy" class="size-full object-cover" />{/if}
					<span class="bg-ink/50 absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
						<Play class="size-8 fill-white text-white" aria-hidden="true" />
					</span>
					{#if pct > 0 && pct < 100}
						<span class="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25"><span class="bg-primary block h-full" style="width: {pct}%"></span></span>
					{/if}
				</button>
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<div class="flex items-baseline gap-2">
						<span class="text-muted-foreground text-sm font-semibold tabular-nums">{ep.IndexNumber ?? '–'}</span>
						<a href={resolve('/item/[id]', { id: ep.Id! })} class="truncate font-semibold hover:text-primary">{ep.Name}</a>
						{#if ep.UserData?.Played}<span class="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center self-center rounded-full"><Check class="size-3.5" strokeWidth={3} aria-hidden="true" /><span class="sr-only">Watched</span></span>{/if}
					</div>
					{#if ep.Overview}<p class="text-muted-foreground line-clamp-2 text-sm max-sm:hidden">{ep.Overview}</p>{/if}
					<span class="text-muted-foreground text-xs">{[duration(ep.RunTimeTicks), ep.PremiereDate ? new Date(ep.PremiereDate).getFullYear() : null].filter(Boolean).join(' · ')}</span>
				</div>
				<ItemMenuButton item={ep} context={{ hereId: series.Id ?? undefined }} />
			</ItemContextMenu>
			</li>
		{/each}
	</ol>
</section>
