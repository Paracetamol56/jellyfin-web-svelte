<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { searchLibrary, type SearchFilter } from '#lib/api/queries.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { hashParams } from '#lib/hash-params.svelte.ts';
	import { playTracks } from '#lib/player/actions.ts';
	import MediaCard from '#lib/components/MediaCard.svelte';
	import TrackList from '#lib/components/detail/TrackList.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const params = $derived(hashParams());
	const urlFilter: SearchFilter = $derived({
		q: params.get('q') ?? undefined,
		tag: params.get('tag') ?? undefined,
		genre: params.get('genre') ?? undefined,
		studio: params.get('studio') ?? undefined,
		year: params.get('year') ? Number(params.get('year')) : undefined
	});
	const facet = $derived(urlFilter.tag ? `Tagged “${urlFilter.tag}”` : urlFilter.genre ? `Genre: ${urlFilter.genre}` : urlFilter.studio ? `Studio: ${urlFilter.studio}` : urlFilter.year ? `Released in ${urlFilter.year}` : null);

	// `text` is what's typed; `committed` is what's searched. Typing commits after a pause, Enter commits at once,
	// and a new query arriving from outside (the header search box, a link) replaces both.
	let text = $state('');
	let committed = $state<string | undefined>(undefined);
	const filter: SearchFilter = $derived({ ...urlFilter, q: committed });
	let timer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const fromUrl = urlFilter.q;
		text = fromUrl ?? '';
		committed = fromUrl;
	});

	function commit(q: string) {
		clearTimeout(timer);
		q = q.trim();
		committed = q || undefined;
		// Keep the address bar in step (shareable/back-able) without a router round trip that could swallow the update.
		const url = location.pathname + location.search + '#' + resolve('/search').replace(/^#/, '') + (q ? `?q=${encodeURIComponent(q)}` : '');
		history.replaceState(history.state, '', url);
	}
	const onInput = () => {
		clearTimeout(timer);
		timer = setTimeout(() => commit(text), 350);
	};

	const active = $derived(!!(filter.q && filter.q.length >= 2) || !!facet);
	const results = createQuery(() => ({
		queryKey: ['search', session.userId, filter],
		queryFn: () => searchLibrary(filter),
		enabled: active,
		staleTime: 30_000
	}));
	const square = (kind: string) => ['Albums', 'Artists', 'Playlists & collections'].includes(kind);
</script>

<svelte:head><title>{filter.q ? `“${filter.q}” · ` : ''}Search · Jellyfin</title></svelte:head>

<main class="mx-auto flex max-w-[1360px] flex-col gap-10 px-4 pt-7 pb-18 md:px-10">
	<form role="search" onsubmit={(e) => (e.preventDefault(), commit(text))} class="flex flex-col gap-3">
		<label for="search-page" class="font-display text-4xl font-extrabold md:text-5xl">{facet ?? 'Search'}</label>
		{#if !facet}
			<div class="bg-card border-border focus-within:border-ring flex h-14 items-center gap-3 rounded-2xl border px-4">
				<Search class="text-muted-foreground size-5" aria-hidden="true" />
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="search-page"
					type="search"
					autofocus
					bind:value={text}
					oninput={onInput}
					placeholder="Movies, shows, episodes, music, people"
					class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-lg outline-none [&::-webkit-search-cancel-button]:appearance-none"
				/>
				{#if text}
					<button type="button" aria-label="Clear search" class="hover:bg-accent grid size-11 cursor-pointer place-items-center rounded-full" onclick={() => ((text = ''), commit(''))}><X class="size-5" /></button>
				{/if}
			</div>
		{:else}
			<a href={resolve('/search')} class="text-primary text-sm font-semibold hover:underline">New search</a>
		{/if}
	</form>

	{#if !active}
		<p class="text-muted-foreground">Type at least two letters to search all your libraries.</p>
	{:else if results.isPending}
		<div class="flex flex-col gap-5">
			<Skeleton class="h-8 w-40" />
			<div class="flex gap-5 overflow-hidden">{#each { length: 7 } as _, i (i)}<Skeleton class="aspect-[2/3] w-[170px] shrink-0 rounded-[14px]" />{/each}</div>
		</div>
	{:else if results.isError}
		<p role="alert" class="text-destructive">Search failed: {results.error.message}</p>
	{:else if !results.data?.length}
		<p class="text-muted-foreground" role="status">Nothing matches {filter.q ? `“${filter.q}”` : 'this filter'}.</p>
	{:else}
		<p class="sr-only" role="status">{results.data.reduce((n, r) => n + r.items.length, 0)} results</p>
		{#each results.data as group (group.kind)}
			<section aria-labelledby="g-{group.kind}" class="flex flex-col gap-5">
				<h2 id="g-{group.kind}" class="text-2xl font-bold md:text-[30px]">{group.kind}</h2>
				{#if group.kind === 'Songs'}
					<TrackList tracks={group.items} showAlbum onplay={(i) => playTracks(group.items, i)} />
				{:else}
					<ul class="grid gap-x-5 gap-y-7 {group.kind === 'Episodes' ? 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]'}">
						{#each group.items as item (item.Id)}
							<li class="min-w-0"><MediaCard {item} shape={group.kind === 'Episodes' ? 'wide' : square(group.kind) ? 'square' : 'poster'} /></li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{/if}
</main>
