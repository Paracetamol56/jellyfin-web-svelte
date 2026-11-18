<script lang="ts">
	import ArtistLinks, { artistsOf, type ArtistRef } from '#lib/components/ArtistLinks.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Heart from '@lucide/svelte/icons/heart';
	import Play from '@lucide/svelte/icons/play';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Star from '@lucide/svelte/icons/star';
	import Film from '@lucide/svelte/icons/film';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { fetchViews, keys } from '#lib/api/queries.ts';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { backdropImage, primaryImage } from '#lib/api/images.ts';
	import { duration, endsAt, progress } from '#lib/api/format.ts';
	import { accentFor } from '#lib/accent.svelte.ts';
	import ArtPlaceholder from '#lib/components/ArtPlaceholder.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import ItemMenuButton from '#lib/components/menu/ItemMenuButton.svelte';

	let {
		item,
		playLabel,
		onplay,
		onshuffle,
		onwatched,
		onfavorite
	}: {
		item: BaseItemDto;
		playLabel?: string;
		onplay?: () => void;
		onshuffle?: () => void;
		onwatched?: () => void;
		onfavorite?: () => void;
	} = $props();

	const square = $derived(['MusicAlbum', 'MusicArtist', 'Audio', 'Playlist'].includes(item.Type ?? ''));
	const person = $derived(item.Type === 'Person');
	const poster = $derived(primaryImage(item, 560));
	const backdrop = $derived(backdropImage(item, 1920));
	const accent = $derived(accentFor(backdrop ?? poster));

	const kind = $derived(
		({ Movie: 'Film', Series: 'Series', Episode: 'Episode', Season: 'Season', MusicAlbum: 'Album', MusicArtist: 'Artist', Playlist: 'Playlist', BoxSet: 'Collection', Person: 'Person' } as Record<string, string>)[item.Type ?? ''] ?? item.Type
	);
	const views = createQuery(() => ({ queryKey: keys.views(), queryFn: fetchViews }));
	const LIBRARY_OF: Record<string, string> = {
		Movie: 'movies', Series: 'tvshows', Season: 'tvshows', Episode: 'tvshows',
		MusicAlbum: 'music', MusicArtist: 'music', Audio: 'music', Playlist: 'playlists', BoxSet: 'boxsets'
	};
	const library = $derived((views.data ?? []).find((v) => v.CollectionType === LIBRARY_OF[item.Type ?? '']));
	const search = (key: string, v: string | number) => resolve('/search') + `?${key}=${encodeURIComponent(String(v))}`;
	// Header line: every part leads somewhere (library, artist/series/studio, year).
	const meta = $derived.by(() => {
		const out: { label: string | number; href?: string; artists?: ArtistRef[] }[] = [];
		if (kind) out.push({ label: kind, href: library?.Id ? resolve('/library/[id]', { id: library.Id }) : undefined });
		if (item.Type === 'Episode' && item.SeriesName) out.push({ label: item.SeriesName, href: item.SeriesId ? resolve('/item/[id]', { id: item.SeriesId }) : undefined });
		else if (item.Type === 'MusicAlbum' || item.Type === 'Audio') {
			const artists = artistsOf(item);
			if (artists.length) out.push({ label: artists.map((a) => a.Name).join(', '), artists });
			if (item.Type === 'Audio' && item.AlbumId && item.Album) out.push({ label: item.Album, href: resolve('/item/[id]', { id: item.AlbumId }) });
		} else if (item.Studios?.[0]?.Name) out.push({ label: item.Studios[0].Name, href: search('studio', item.Studios[0].Name) });
		if (item.ProductionYear) out.push({ label: item.ProductionYear, href: search('year', item.ProductionYear) });
		return out;
	});
	const resumable = $derived(progress(item) > 0 && progress(item) < 100);
	const label = $derived(playLabel ?? (resumable ? 'Resume' : item.UserData?.Played ? 'Play again' : 'Play'));
	const trailer = $derived(item.RemoteTrailers?.[0]?.Url ?? null);
	const original = $derived(item.OriginalTitle && item.OriginalTitle !== item.Name ? item.OriginalTitle : null);
	const runtime = $derived(item.Type === 'Series' ? null : duration(item.RunTimeTicks ?? item.CumulativeRunTimeTicks));
	const ends = $derived(['Movie', 'Episode'].includes(item.Type ?? '') ? endsAt(item) : '');
	const pill = 'rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5';
	const round = 'size-14 rounded-full border border-white/20 bg-ink/40 text-[#F1F0F4] hover:bg-ink/60';
</script>

<section aria-label="Overview" class="relative overflow-hidden bg-[#15151C] text-[#F1F0F4]">
	{#if backdrop}
		<img src={backdrop} alt="" class="absolute inset-0 size-full object-cover object-top" />
	{:else if poster}
		<!-- No backdrop (albums, people): a blurred blow-up of the artwork instead -->
		<img src={poster} alt="" class="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-3xl saturate-150" />
	{/if}
	<div aria-hidden="true" class="absolute inset-0 bg-[linear-gradient(90deg,#0B0B10F2_0%,#0B0B10CC_40%,#0B0B1066_100%),linear-gradient(0deg,#0B0B10_0%,#0B0B10B3_30%,transparent_70%)]"></div>

	<div class="relative mx-auto flex max-w-[1360px] flex-wrap items-end gap-8 px-4 pt-16 pb-10 md:gap-12 md:px-10 md:pt-[100px] md:pb-14">
		<div
			class="bg-muted relative overflow-hidden shadow-[0_30px_60px_#00000080] max-md:w-[160px] md:w-[280px] {person ? 'aspect-square rounded-full md:w-[240px]' : square ? 'aspect-square rounded-[18px]' : 'aspect-[2/3] rounded-[18px]'}"
		>
			{#if poster}
				<img src={poster} alt="{kind}: {item.Name}" class="size-full object-cover" />
			{:else}
				<div role="img" aria-label="{kind}: {item.Name}" class="size-full"><ArtPlaceholder name={item.Name} size="lg" /></div>
			{/if}
		</div>

		<div class="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
			<div class="flex flex-wrap gap-2.5 text-xs font-bold tracking-[0.1em] text-[#D3CFEA] uppercase">
				{#each meta as m, i (i)}
					{#if i > 0}<span aria-hidden="true">·</span>{/if}
					{#if m.artists}<span><ArtistLinks artists={m.artists} class="underline-offset-4 hover:text-white hover:underline" /></span>
					{:else if m.href}<a href={m.href} class="underline-offset-4 hover:text-white hover:underline">{m.label}</a>{:else}<span>{m.label}</span>{/if}
				{/each}
			</div>
			<div>
				<h1 class="text-4xl leading-[0.98] font-extrabold text-balance md:text-6xl">{item.Name}</h1>
				{#if original}<p class="mt-3 text-lg text-[#D3CFEA]">{original}</p>{/if}
			</div>

			<ul class="flex flex-wrap gap-2 text-[13px]">
				{#if runtime}<li class={pill}>{runtime}</li>{/if}
				{#if item.ChildCount && item.Type !== 'Person'}<li class={pill}>{item.ChildCount} {item.Type === 'Series' ? (item.ChildCount === 1 ? 'season' : 'seasons') : item.Type === 'MusicAlbum' || item.Type === 'Playlist' ? (item.ChildCount === 1 ? 'track' : 'tracks') : 'items'}</li>{/if}
				{#if item.OfficialRating}<li class={pill}>{item.OfficialRating}</li>{/if}
				{#if item.CommunityRating}
					<li class="{pill} flex items-center gap-1.5">
						<Star class="size-3.5 fill-[#F5C451] text-[#F5C451]" aria-hidden="true" /><span>{item.CommunityRating.toFixed(1)}</span>
						<span class="sr-only">out of 10</span>
					</li>
				{/if}
				{#if ends}<li class={pill}>Ends at {ends}</li>{/if}
				{#if item.UserData?.Played}
					<li class="grid size-[30px] place-items-center self-center rounded-full bg-[#33B7E6] text-[#0B0B10]" title="Watched">
						<Check class="size-[18px]" strokeWidth={3} aria-hidden="true" /><span class="sr-only">Watched</span>
					</li>
				{/if}
			</ul>

			{#if true}
				<div class="mt-1.5 flex flex-wrap items-center gap-3">
					{#if onplay}
						<button
							type="button"
							onclick={onplay}
							class="text-ink inline-flex h-14 cursor-pointer items-center gap-3 rounded-full px-[30px] text-base font-bold transition-[filter] hover:brightness-110"
							style="background: {accent.value}"
						>
							<Play class="size-5 fill-current" aria-hidden="true" />{label}
						</button>
					{/if}
					{#if onshuffle}
						<Button variant="overlay" class="h-14 px-[22px] text-[15px] font-medium" onclick={onshuffle}>
							<Shuffle aria-hidden="true" />Shuffle
						</Button>
					{/if}
					{#if trailer}
						<Button variant="overlay" href={trailer} target="_blank" rel="noopener noreferrer" class="h-14 px-[22px] text-[15px] font-medium">
							<Film aria-hidden="true" />Trailer
						</Button>
					{/if}
					{#if onwatched}
						<Button
							variant="overlay"
							size="icon"
							class="{round} {item.UserData?.Played ? 'text-[#33B7E6]' : ''}"
							aria-label={item.UserData?.Played ? 'Mark unwatched' : 'Mark watched'}
							aria-pressed={!!item.UserData?.Played}
							onclick={onwatched}
						>
							<Check />
						</Button>
					{/if}
					{#if onfavorite}
						<Button
							variant="overlay"
							size="icon"
							class={round}
							aria-label={item.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'}
							aria-pressed={!!item.UserData?.IsFavorite}
							onclick={onfavorite}
						>
							<Heart class={item.UserData?.IsFavorite ? 'fill-[#FF6B8B] text-[#FF6B8B]' : ''} />
						</Button>
					{/if}
					<ItemMenuButton {item} context={{ hereId: item.Id ?? undefined }} class="grid size-14 cursor-pointer place-items-center rounded-full border border-white/20 bg-ink/40 text-[#F1F0F4] hover:bg-ink/60" />
				</div>
			{/if}
		</div>
	</div>
</section>
