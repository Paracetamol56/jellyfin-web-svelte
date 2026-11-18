<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { session } from '#lib/api/session.svelte.ts';
	import { fetchArtistAlbums, fetchByPerson, fetchChildren, fetchItem, fetchSimilar, keys } from '#lib/api/queries.ts';
	import { playItem, playMix, playTracks } from '#lib/player/actions.ts';
	import { toggleFavorite as markFavorite, toggleWatched as markWatched } from '#lib/item-actions.ts';
	import ItemHero from '#lib/components/detail/ItemHero.svelte';
	import PlaybackCard from '#lib/components/detail/PlaybackCard.svelte';
	import DetailsCard from '#lib/components/detail/DetailsCard.svelte';
	import CastRow from '#lib/components/detail/CastRow.svelte';
	import Chapters from '#lib/components/detail/Chapters.svelte';
	import EpisodeList from '#lib/components/detail/EpisodeList.svelte';
	import TrackList from '#lib/components/detail/TrackList.svelte';
	import MediaCard from '#lib/components/MediaCard.svelte';
	import ShelfRow from '#lib/components/ShelfRow.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const id = $derived(page.params.id!);

	const query = createQuery(() => ({ queryKey: keys.item(id), queryFn: () => fetchItem(id) }));
	const raw = $derived(query.data);

	// A season shows as its series, opened on that season.
	const seriesQuery = createQuery(() => ({
		queryKey: keys.item(raw?.SeriesId ?? ''),
		queryFn: () => fetchItem(raw!.SeriesId!),
		enabled: raw?.Type === 'Season' && !!raw.SeriesId
	}));
	const item: BaseItemDto | undefined = $derived(raw?.Type === 'Season' ? seriesQuery.data : raw);
	const type = $derived(item?.Type);

	const isPlayableVideo = $derived(item?.MediaType === 'Video');
	const isContainer = $derived(['MusicAlbum', 'Playlist', 'BoxSet'].includes(type ?? ''));

	const children = createQuery(() => ({
		queryKey: ['children', session.userId, item?.Id],
		queryFn: () => fetchChildren(item!),
		enabled: !!item && isContainer
	}));
	const credits = createQuery(() => ({
		queryKey: ['person', session.userId, item?.Id],
		queryFn: () => fetchByPerson(item!.Id!),
		enabled: type === 'Person'
	}));
	const albums = createQuery(() => ({
		queryKey: ['artistAlbums', session.userId, item?.Id],
		queryFn: () => fetchArtistAlbums(item!.Id!),
		enabled: type === 'MusicArtist'
	}));
	const similar = createQuery(() => ({
		queryKey: ['similar', session.userId, item?.Id],
		queryFn: () => fetchSimilar(item!.Id!),
		enabled: !!item && ['Movie', 'Series', 'MusicAlbum', 'MusicArtist'].includes(type ?? '')
	}));

	// Track choices from the Playback card feed straight into the player.
	let sourceId = $state<string | undefined>();
	let audioIndex = $state<number | undefined>();
	let subtitleIndex = $state<number | undefined>();
	$effect(() => {
		id; // reset per item
		sourceId = audioIndex = subtitleIndex = undefined;
	});

	function play(start?: number) {
		if (!item) return;
		if (type === 'MusicArtist') return playMix(item);
		playItem(item, { sourceId, audioIndex, subtitleIndex, start });
	}

	const tracks = $derived((children.data ?? []).filter((c) => c.MediaType === 'Audio'));
	const gridChildren = $derived((children.data ?? []).filter((c) => c.MediaType !== 'Audio'));

	const toggleWatched = () => item && markWatched(item);
	const toggleFavorite = () => item && markFavorite(item);

	const playLabel = $derived(
		type === 'Series' ? 'Play next' : type === 'MusicArtist' ? 'Artist mix' : isContainer ? 'Play all' : undefined
	);
	const canPlay = $derived(isPlayableVideo || isContainer || ['Series', 'MusicArtist', 'Audio'].includes(type ?? ''));
	const tag = (t: string) => `#/search?tag=${encodeURIComponent(t)}`;
</script>

<svelte:head><title>{item?.Name ?? 'Loading'} · Jellyfin</title></svelte:head>

{#if query.isError}
	<main class="mx-auto max-w-[1360px] px-4 py-16 md:px-10">
		<h1 class="text-3xl font-extrabold">Couldn't load this item</h1>
		<p class="text-muted-foreground mt-2">{query.error.message}</p>
	</main>
{:else if !item}
	<div class="bg-[#15151C]">
		<div class="mx-auto flex max-w-[1360px] items-end gap-12 px-4 pt-[100px] pb-14 md:px-10">
			<Skeleton class="aspect-[2/3] w-[160px] rounded-[18px] bg-white/5 md:w-[280px]" />
			<div class="flex flex-1 flex-col gap-4"><Skeleton class="h-16 w-2/3 bg-white/5" /><Skeleton class="h-14 w-60 rounded-full bg-white/5" /></div>
		</div>
	</div>
{:else}
	{#key item.Id}
		<ItemHero
			{item}
			{playLabel}
			onplay={canPlay ? () => play() : undefined}
			onshuffle={isContainer && tracks.length > 1 ? () => playItem(item!, { shuffle: true }) : undefined}
			onwatched={type !== 'Person' && type !== 'MusicArtist' && type !== 'Playlist' ? toggleWatched : undefined}
			onfavorite={toggleFavorite}
		/>

		<main class="mx-auto flex max-w-[1360px] flex-col gap-16 px-4 pt-12 pb-18 md:px-10">
			{#if item.Overview || item.Taglines?.length || item.Tags?.length || isPlayableVideo || type === 'Series' || type === 'Playlist' || type === 'MusicAlbum'}
				<div class="flex flex-wrap gap-10">
					<div class="flex min-w-0 flex-[999_1_560px] flex-col gap-[22px]">
						{#if item.Taglines?.[0]}
							<p class="font-display text-brand-purple text-2xl leading-tight font-medium tracking-[-0.015em] md:text-[28px]">“{item.Taglines[0]}”</p>
						{/if}
						{#if item.Overview}
							<p class="text-muted-foreground max-w-[68ch] text-[17px] leading-[1.65] whitespace-pre-line">{item.Overview}</p>
						{/if}
						{#if (type === 'Playlist' || type === 'MusicAlbum') && item.Genres?.length}
							<ul aria-label="Genres" class="flex flex-wrap gap-2">
								{#each item.Genres.slice(0, 16) as g (g)}
									<li><a href={`#/search?genre=${encodeURIComponent(g)}`} class="border-border bg-card hover:border-ring inline-block rounded-full border px-[13px] py-[7px] text-[13px]">{g}</a></li>
								{/each}
							</ul>
						{/if}
						{#if item.Tags?.length}
							<ul aria-label="Tags" class="flex flex-wrap gap-2">
								{#each item.Tags.slice(0, 16) as t (t)}
									<li><a href={tag(t)} class="border-border bg-card hover:border-ring inline-block rounded-full border px-[13px] py-[7px] text-[13px]">{t}</a></li>
								{/each}
							</ul>
						{/if}
					</div>
					{#if isPlayableVideo || type === 'Series' || type === 'MusicAlbum' || type === 'Playlist'}
						<aside class="flex flex-[1_1_340px] flex-col gap-4">
							{#if isPlayableVideo}<PlaybackCard {item} bind:sourceId bind:audioIndex bind:subtitleIndex />{/if}
							<DetailsCard {item} />
						</aside>
					{/if}
				</div>
			{/if}

			{#if type === 'Series'}
				<EpisodeList series={item} initialSeasonId={raw?.Type === 'Season' ? raw.Id! : undefined} onplay={(eps, i) => playTracks(eps, i)} />
			{/if}

			{#if tracks.length || (children.isPending && type === 'MusicAlbum')}
				<section aria-label="Tracks"><TrackList {tracks} loading={children.isPending} showAlbum={type === 'Playlist'} playlistId={type === 'Playlist' ? (item.Id ?? undefined) : undefined} hereId={item.Id ?? undefined} onplay={(i) => playTracks(tracks, i)} /></section>
			{/if}

			{#if gridChildren.length}
				<section aria-labelledby="items" class="flex flex-col gap-5">
					<h2 id="items" class="text-2xl font-bold md:text-[30px]">{type === 'BoxSet' ? 'In this collection' : 'Items'}</h2>
					<ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
						{#each gridChildren as c (c.Id)}<li class="min-w-0"><MediaCard item={c} /></li>{/each}
					</ul>
				</section>
			{/if}

			{#if type === 'MusicArtist' && albums.data?.length}
				<section aria-labelledby="albums" class="flex flex-col gap-5">
					<h2 id="albums" class="text-2xl font-bold md:text-[30px]">Albums</h2>
					<ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
						{#each albums.data as a (a.Id)}<li class="min-w-0"><MediaCard item={a} shape="square" /></li>{/each}
					</ul>
				</section>
			{/if}

			{#if type === 'Person' && credits.data?.length}
				<section aria-labelledby="credits" class="flex flex-col gap-5">
					<h2 id="credits" class="text-2xl font-bold md:text-[30px]">In your library</h2>
					<ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
						{#each credits.data as c (c.Id)}<li class="min-w-0"><MediaCard item={c} /></li>{/each}
					</ul>
				</section>
			{/if}

			{#if item.People?.length}<CastRow people={item.People} />{/if}

			{#if isPlayableVideo}<Chapters {item} onplay={(t) => play(t)} />{/if}

			{#if similar.data?.length}
				<ShelfRow title="More like this" cardWidth={type === 'MusicAlbum' || type === 'MusicArtist' ? 'w-[160px] md:w-[180px]' : 'w-[150px] md:w-[170px]'}>
					{#snippet children(cls)}
						{#each similar.data ?? [] as s (s.Id)}
							<div class={cls}><MediaCard item={s} shape={type === 'MusicAlbum' || type === 'MusicArtist' ? 'square' : 'poster'} /></div>
						{/each}
					{/snippet}
				</ShelfRow>
			{/if}
		</main>
	{/key}
{/if}
