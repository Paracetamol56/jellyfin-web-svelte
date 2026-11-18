<script lang="ts">
	import { createQueries, createQuery } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { fetchLatest, fetchNextUp, fetchResume, fetchViews, keys } from '#lib/api/queries.ts';
	import HomeHero from '#lib/components/HomeHero.svelte';
	import LibraryTile from '#lib/components/LibraryTile.svelte';
	import MediaCard from '#lib/components/MediaCard.svelte';
	import ShelfRow from '#lib/components/ShelfRow.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const views = createQuery(() => ({ queryKey: keys.views(), queryFn: fetchViews }));
	const resume = createQuery(() => ({ queryKey: keys.resume(), queryFn: () => fetchResume(8) }));
	const nextUp = createQuery(() => ({ queryKey: keys.nextUp(), queryFn: () => fetchNextUp(6) }));

	const SHELF_TYPES = ['movies', 'tvshows', 'music', 'homevideos', 'books', 'boxsets'];
	const shelfViews = $derived((views.data ?? []).filter((v) => SHELF_TYPES.includes(v.CollectionType ?? '')));
	const tileViews = $derived((views.data ?? []).filter((v) => v.CollectionType !== 'livetv').slice(0, 4));

	const latest = createQueries(() => ({
		queries: shelfViews.map((v) => ({ queryKey: keys.latest(v.Id!), queryFn: () => fetchLatest(v.Id!) }))
	}));

	const slides = $derived.by(() => {
		type Kind = 'Continue watching' | 'Next up' | 'Recently added';
		const seen = new Set<string>();
		const out: { item: BaseItemDto; kind: Kind }[] = [];
		const add = (items: BaseItemDto[] | undefined, kind: Kind) => {
			for (const item of items ?? []) {
				if (!item.Id || seen.has(item.Id) || out.length >= 5) continue;
				seen.add(item.Id);
				out.push({ item, kind });
			}
		};
		add(resume.data?.slice(0, 3), 'Continue watching');
		add(nextUp.data?.slice(0, 2), 'Next up');
		if (out.length < 3) {
			const movies = shelfViews.findIndex((v) => v.CollectionType === 'movies');
			add(movies >= 0 ? latest[movies]?.data?.slice(0, 3) : undefined, 'Recently added');
		}
		return out;
	});
	const heroLoading = $derived(resume.isPending || nextUp.isPending);

	function rowTitle(v: BaseItemDto): string {
		return v.CollectionType === 'music' ? `Latest in ${v.Name}` : `Recently added in ${v.Name}`;
	}
</script>

<svelte:head><title>Home · Jellyfin</title></svelte:head>

<main class="mx-auto flex max-w-[1360px] flex-col gap-14 px-4 pt-7 pb-18 md:px-10">
	<section class="flex flex-wrap gap-6" aria-label="Featured and libraries">
		{#if slides.length}
			<HomeHero {slides} />
		{:else if heroLoading}
			<Skeleton class="min-h-[440px] min-w-0 flex-[999_1_620px] rounded-3xl" />
		{/if}

		<nav aria-label="Libraries" class="grid flex-[1_1_380px] grid-cols-2 gap-4">
			{#if views.isPending}
				{#each { length: 4 } as _, i (i)}<Skeleton class="min-h-[200px] rounded-[20px]" />{/each}
			{:else}
				{#each tileViews as v (v.Id)}<LibraryTile view={v} />{/each}
			{/if}
		</nav>
	</section>

	{#if resume.data?.length}
		<ShelfRow title="Continue watching" cardWidth="w-[260px] md:w-[300px]">
			{#snippet children(cls)}
				{#each resume.data ?? [] as item (item.Id)}
					<div class={cls}><MediaCard {item} shape="wide" /></div>
				{/each}
			{/snippet}
		</ShelfRow>
	{/if}

	{#if nextUp.data?.length}
		<ShelfRow title="Next up" cardWidth="w-[260px] md:w-[300px]">
			{#snippet children(cls)}
				{#each nextUp.data ?? [] as item (item.Id)}
					<div class={cls}><MediaCard {item} shape="wide" /></div>
				{/each}
			{/snippet}
		</ShelfRow>
	{/if}

	{#each shelfViews as v, i (v.Id)}
		{@const q = latest[i]}
		{#if q?.isPending}
			<div class="flex flex-col gap-5">
				<Skeleton class="h-9 w-80" />
				<div class="flex gap-5 overflow-hidden">
					{#each { length: 7 } as _, k (k)}<Skeleton class="aspect-[2/3] w-[180px] shrink-0 rounded-[14px]" />{/each}
				</div>
			</div>
		{:else if q?.data?.length}
			<ShelfRow title={rowTitle(v)} href={resolve('/library/[id]', { id: v.Id! })}>
				{#snippet children(cls)}
					{#each q.data ?? [] as item (item.Id)}
						<div class={cls}><MediaCard {item} shape={v.CollectionType === 'music' ? 'square' : 'poster'} /></div>
					{/each}
				{/snippet}
			</ShelfRow>
		{/if}
	{/each}

	{#if views.isError}
		<p role="alert" class="text-destructive">Couldn't load your libraries: {views.error.message}</p>
	{/if}
</main>
