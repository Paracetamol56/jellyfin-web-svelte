<script lang="ts">
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import Play from '@lucide/svelte/icons/play';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Dices from '@lucide/svelte/icons/dices';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ArrowDownWideNarrow from '@lucide/svelte/icons/arrow-down-wide-narrow';
	import ArrowUpNarrowWide from '@lucide/svelte/icons/arrow-up-narrow-wide';
	import X from '@lucide/svelte/icons/x';
	import { DropdownMenu, Popover } from 'bits-ui';
	import { menuContent } from '#lib/components/menu/styles.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import {
		fetchGenres,
		fetchItem,
		fetchLibraryTab,
		fetchRandomItem,
		filtersFor,
		keys,
		LIBRARY_PAGE,
		SORTS,
		sortsFor,
		tabsFor,
		type LibraryFilters,
		type LibraryTab,
		type SortKey
	} from '#lib/api/queries.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { primaryImage } from '#lib/api/images.ts';
	import { itemSubtitle } from '#lib/api/format.ts';
	import { hashParams } from '#lib/hash-params.svelte.ts';
	import { playLibrary, playTracks } from '#lib/player/actions.ts';
	import MediaCard from '#lib/components/MediaCard.svelte';
	import TrackList from '#lib/components/detail/TrackList.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const id = $derived(page.params.id!);
	const params = $derived(hashParams());
	const view = createQuery(() => ({ queryKey: keys.item(id), queryFn: () => fetchItem(id) }));
	const tabs = $derived(tabsFor(view.data?.CollectionType));
	const tab = $derived((tabs.find(([t]) => t === params.get('tab'))?.[0] ?? 'items') as LibraryTab);
	const sorts = $derived(sortsFor(view.data?.CollectionType));
	const sort = $derived((sorts.find(([k]) => k === params.get('sort'))?.[0] ?? 'name') as SortKey);
	const order = $derived((params.get('order') as 'asc' | 'desc' | null) ?? null);
	const effectiveOrder = $derived(order ?? (SORTS[sort].order === 'Ascending' ? 'asc' : 'desc'));
	const available = $derived(filtersFor(view.data?.CollectionType, tab));
	const filters: LibraryFilters = $derived({
		show: available.includes('show') ? ((params.get('show') as LibraryFilters['show']) ?? undefined) : undefined,
		genres: available.includes('genres') ? params.getAll('genre') : undefined,
		decade: available.includes('decade') && params.get('decade') ? Number(params.get('decade')) : undefined,
		quality: available.includes('quality') ? ((params.get('quality') as LibraryFilters['quality']) ?? undefined) : undefined,
		subs: available.includes('subs') && params.get('subs') === '1' ? true : undefined,
		status: available.includes('status') ? ((params.get('status') as LibraryFilters['status']) ?? undefined) : undefined,
		score: available.includes('score') && params.get('score') ? Number(params.get('score')) : undefined
	});
	const genreList = createQuery(() => ({
		queryKey: ['genres', session.userId, id],
		queryFn: () => fetchGenres(view.data!),
		enabled: !!view.data && available.includes('genres'),
		staleTime: 300_000
	}));
	const pageNo = $derived(Math.max(0, Number(params.get('page') ?? 1) - 1));
	const letter = $derived(params.get('letter'));

	let mode = $state<'grid' | 'list'>((localStorage.getItem('jf.libraryView') as 'grid' | 'list') ?? 'grid');
	$effect(() => localStorage.setItem('jf.libraryView', mode));

	const items = createQuery(() => ({
		queryKey: ['libraryTab', session.userId, id, tab, sort, order, pageNo, letter, filters],
		queryFn: () => fetchLibraryTab(view.data!, tab, { sort, order, page: pageNo, letter, filters }),
		enabled: !!view.data,
		placeholderData: keepPreviousData
	}));
	const total = $derived(items.data?.total ?? 0);
	const pages = $derived(Math.max(1, Math.ceil(total / LIBRARY_PAGE)));

	/** Change one or more URL parameters (resets paging unless a page is given). Arrays become repeated params. */
	function set(next: Record<string, string | string[] | null>) {
		const p = new URLSearchParams(params);
		if (!('page' in next)) p.delete('page');
		for (const [k, v] of Object.entries(next)) {
			p.delete(k);
			if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
			else if (v == null || v === '' || (k === 'tab' && v === 'items') || (k === 'sort' && v === 'name') || (k === 'page' && v === '1')) continue;
			else p.set(k, v);
		}
		const qs = p.toString();
		goto(resolve('/library/[id]', { id }) + (qs ? `?${qs}` : ''), { replace: tab === (next.tab ?? tab) });
	}

	const square = $derived(view.data?.CollectionType === 'music' || view.data?.CollectionType === 'playlists' || tab === 'artists');
	const noun = $derived(
		tab === 'artists' ? 'artists' : tab === 'songs' ? 'songs' : tab === 'genres' ? 'genres'
			: ({ music: 'albums', movies: 'movies', tvshows: 'shows', playlists: 'playlists', boxsets: 'collections' } as Record<string, string>)[view.data?.CollectionType ?? ''] ?? 'items'
	);
	const isMusic = $derived(view.data?.CollectionType === 'music');
	const SHOW: [NonNullable<LibraryFilters['show']>, string][] = $derived(
		isMusic || tab !== 'items'
			? [['favorite', 'Favorites'], ['played', 'Played'], ['unplayed', 'Not played']]
			: [['unplayed', 'Unwatched'], ['played', 'Watched'], ['resumable', 'In progress'], ['favorite', 'Favorites']]
	);
	const DECADES = Array.from({ length: 8 }, (_, i) => Math.floor(new Date().getFullYear() / 10) * 10 - i * 10);
	const QUALITY: [NonNullable<LibraryFilters['quality']>, string][] = [['4k', '4K'], ['hd', 'HD'], ['sd', 'SD']];
	const STATUS: [NonNullable<LibraryFilters['status']>, string][] = [['Continuing', 'Ongoing'], ['Ended', 'Ended']];
	const SCORES = [6, 7, 8];

	// Active filters as removable chips.
	const chips = $derived.by(() => {
		const out: { label: string; clear: Record<string, string | string[] | null> }[] = [];
		if (filters.show) out.push({ label: SHOW.find(([k]) => k === filters.show)?.[1] ?? filters.show, clear: { show: null } });
		for (const g of filters.genres ?? []) out.push({ label: g, clear: { genre: (filters.genres ?? []).filter((x) => x !== g) } });
		if (filters.decade) out.push({ label: `${filters.decade}s`, clear: { decade: null } });
		if (filters.quality) out.push({ label: QUALITY.find(([k]) => k === filters.quality)?.[1] ?? '', clear: { quality: null } });
		if (filters.subs) out.push({ label: 'Has subtitles', clear: { subs: null } });
		if (filters.status) out.push({ label: STATUS.find(([k]) => k === filters.status)?.[1] ?? '', clear: { status: null } });
		if (filters.score) out.push({ label: `Rated ${filters.score}+`, clear: { score: null } });
		return out;
	});
	const clearAll = { show: null, genre: [], decade: null, quality: null, subs: null, status: null, score: null };
	const opt = 'h-9 cursor-pointer rounded-full border border-border px-3.5 text-sm hover:border-ring aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground';
	const legend = 'text-muted-foreground mb-2 text-xs font-bold tracking-[0.1em] uppercase';

	const playable = $derived(view.data?.CollectionType === 'music');
	const pickable = $derived(['movies', 'tvshows'].includes(view.data?.CollectionType ?? '') && tab === 'items');
	const sortLabel = $derived(sorts.find(([k]) => k === sort)?.[1] ?? 'Name');
	let rolling = $state(false);
	/** Roll the dice: open a random item from what's currently listed (filters and letter apply). */
	async function surprise() {
		if (!view.data || rolling) return;
		rolling = true;
		try {
			const pick = await fetchRandomItem(view.data, filters, letter);
			if (pick?.Id) goto(resolve('/item/[id]', { id: pick.Id }));
			else toasts.show('Nothing matches these filters.');
		} catch {
			toasts.error("Couldn't pick one. Try again.");
		} finally {
			rolling = false;
		}
	}
	const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
	const from = $derived(total ? pageNo * LIBRARY_PAGE + 1 : 0);
	const to = $derived(Math.min(total, (pageNo + 1) * LIBRARY_PAGE));

	function href(item: BaseItemDto): string {
		if (item.Type === 'Genre' || item.Type === 'MusicGenre') return resolve('/search') + `?genre=${encodeURIComponent(item.Name ?? '')}`;
		return resolve('/item/[id]', { id: item.Id! });
	}
</script>

<svelte:head><title>{view.data?.Name ?? 'Library'} · Jellyfin</title></svelte:head>

<div class="relative overflow-hidden">
	<div
		aria-hidden="true"
		class="font-display pointer-events-none absolute top-6 -left-3.5 text-[160px] leading-[0.8] font-extrabold tracking-[-0.03em] whitespace-nowrap opacity-[0.06] select-none md:text-[420px]"
	>
		{view.data?.Name ?? ''}
	</div>

	<main class="relative mx-auto flex max-w-[1360px] flex-col gap-7 px-4 pt-7 pb-18 md:px-10 md:pt-9">
		<div class="flex flex-wrap items-baseline gap-x-4 gap-y-3">
			<h1 class="text-[28px] leading-none font-extrabold md:text-[40px]">{view.data?.Name ?? ''}</h1>
			<span class="text-muted-foreground text-sm" aria-live="polite">{items.data ? `${total.toLocaleString()} ${noun}` : ' '}</span>
		</div>

		{#if tabs.length > 1}
			<nav aria-label="{view.data?.Name} sections" class="max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 md:border-border md:border-b">
				<div class="flex gap-2 md:gap-1.5">
					{#each tabs as [t, label] (t)}
						<a
							href={resolve('/library/[id]', { id }) + (t === 'items' ? '' : `?tab=${t}`)}
							aria-current={tab === t ? 'page' : undefined}
							class="text-muted-foreground aria-[current=page]:text-foreground shrink-0 text-[15px] aria-[current=page]:font-semibold max-md:border-border max-md:flex max-md:h-11 max-md:items-center max-md:rounded-full max-md:border max-md:px-[18px] max-md:aria-[current=page]:border-transparent max-md:aria-[current=page]:bg-secondary md:-mb-px md:mr-[18px] md:border-b-2 md:border-transparent md:px-1 md:py-3 md:aria-[current=page]:border-primary"
						>{label}</a>
					{/each}
				</div>
			</nav>
		{/if}

		{#if tab !== 'genres'}
			<div class="flex flex-wrap items-center gap-2.5">
				{#if playable && view.data}
					<button
						type="button"
						onclick={() => playLibrary(view.data!, false)}
						class="text-ink inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full px-5 font-bold [background:var(--brand-grad)]"
					>
						<Play class="size-[18px] fill-current" aria-hidden="true" />Play all
					</button>
					<Button variant="outline" class="bg-card font-medium" onclick={() => playLibrary(view.data!, true)}>
						<Shuffle class="size-[18px]" aria-hidden="true" />Shuffle
					</Button>
				{/if}
				{#if pickable}
					<button
						type="button"
						disabled={rolling}
						onclick={surprise}
						class="text-ink inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full px-5 font-bold disabled:opacity-70 [background:var(--brand-grad)]"
					>
						<Dices class="size-5 {rolling ? 'animate-spin' : ''}" aria-hidden="true" />{view.data?.CollectionType === 'movies' ? 'Random movie' : 'Random show'}
					</button>
				{/if}
				<div class="flex-[1_1_20px]"></div>
				{#if tab !== 'artists'}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger class="border-border bg-card hover:bg-accent inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 text-sm" aria-label="Sort by: {sortLabel}">
							<ArrowUpDown class="text-muted-foreground size-[18px]" aria-hidden="true" />
							<span class="text-muted-foreground">Sort</span><span class="font-semibold">{sortLabel}</span>
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} class="{menuContent} min-w-56">
								<DropdownMenu.RadioGroup value={sort} onValueChange={(v) => set({ sort: v, order: null })}>
									{#each sorts as [key, label] (key)}
										<DropdownMenu.RadioItem
											value={key}
											class="data-highlighted:bg-accent flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none select-none data-[state=checked]:font-semibold"
										>
											{#snippet children({ checked })}
												<span class="grid size-4 place-items-center">{#if checked}<Check class="text-primary size-4" aria-hidden="true" />{/if}</span>{label}
											{/snippet}
										</DropdownMenu.RadioItem>
									{/each}
								</DropdownMenu.RadioGroup>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				{/if}
				{#if sort !== 'random'}
					<Button
						variant="outline"
						size="icon"
						class="bg-card"
						aria-label={effectiveOrder === 'asc' ? 'Ascending order (switch to descending)' : 'Descending order (switch to ascending)'}
						onclick={() => set({ order: effectiveOrder === 'asc' ? 'desc' : 'asc' })}
					>
						{#if effectiveOrder === 'asc'}<ArrowUpNarrowWide />{:else}<ArrowDownWideNarrow />{/if}
					</Button>
				{/if}
				<Popover.Root>
					<Popover.Trigger class="border-border bg-card hover:bg-accent inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm">
						<SlidersHorizontal class="size-[18px]" aria-hidden="true" />Filter
						{#if chips.length}<span class="bg-primary text-primary-foreground grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold">{chips.length}</span>{/if}
					</Popover.Trigger>
					<Popover.Portal>
						<Popover.Content
							align="end"
							sideOffset={8}
							collisionPadding={16}
							class="bg-popover text-popover-foreground border-border z-50 flex max-h-[min(640px,80dvh)] w-[min(420px,calc(100vw-32px))] flex-col gap-5 overflow-y-auto rounded-3xl border p-5 shadow-2xl"
						>
							{#if available.includes('show')}
								<fieldset>
									<legend class={legend}>Show</legend>
									<div class="flex flex-wrap gap-2">
										{#each SHOW as [k, label] (k)}
											<button type="button" class={opt} aria-pressed={filters.show === k} onclick={() => set({ show: filters.show === k ? null : k })}>{label}</button>
										{/each}
									</div>
								</fieldset>
							{/if}
							{#if available.includes('genres') && genreList.data?.length}
								<fieldset>
									<legend class={legend}>Genres</legend>
									<div class="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
										{#each genreList.data as g (g.Id)}
											{@const on = filters.genres?.includes(g.Name ?? '')}
											<button
												type="button"
												class={opt}
												aria-pressed={on}
												onclick={() => set({ genre: on ? (filters.genres ?? []).filter((x) => x !== g.Name) : [...(filters.genres ?? []), g.Name ?? ''] })}
											>{g.Name}</button>
										{/each}
									</div>
								</fieldset>
							{/if}
							{#if available.includes('decade')}
								<fieldset>
									<legend class={legend}>Decade</legend>
									<div class="flex flex-wrap gap-2">
										{#each DECADES as d (d)}
											<button type="button" class={opt} aria-pressed={filters.decade === d} onclick={() => set({ decade: filters.decade === d ? null : String(d) })}>{d}s</button>
										{/each}
									</div>
								</fieldset>
							{/if}
							{#if available.includes('quality')}
								<fieldset>
									<legend class={legend}>Video</legend>
									<div class="flex flex-wrap gap-2">
										{#each QUALITY as [k, label] (k)}
											<button type="button" class={opt} aria-pressed={filters.quality === k} onclick={() => set({ quality: filters.quality === k ? null : k })}>{label}</button>
										{/each}
										{#if available.includes('subs')}
											<button type="button" class={opt} aria-pressed={!!filters.subs} onclick={() => set({ subs: filters.subs ? null : '1' })}>Has subtitles</button>
										{/if}
									</div>
								</fieldset>
							{/if}
							{#if available.includes('status')}
								<fieldset>
									<legend class={legend}>Status</legend>
									<div class="flex flex-wrap gap-2">
										{#each STATUS as [k, label] (k)}
											<button type="button" class={opt} aria-pressed={filters.status === k} onclick={() => set({ status: filters.status === k ? null : k })}>{label}</button>
										{/each}
									</div>
								</fieldset>
							{/if}
							{#if available.includes('score')}
								<fieldset>
									<legend class={legend}>Community rating</legend>
									<div class="flex flex-wrap gap-2">
										{#each SCORES as n (n)}
											<button type="button" class={opt} aria-pressed={filters.score === n} onclick={() => set({ score: filters.score === n ? null : String(n) })}>{n}+</button>
										{/each}
									</div>
								</fieldset>
							{/if}
							{#if chips.length}
								<button type="button" class="text-primary self-start text-sm font-semibold hover:underline" onclick={() => set(clearAll)}>Clear all filters</button>
							{/if}
						</Popover.Content>
					</Popover.Portal>
				</Popover.Root>
				{#if tab !== 'songs'}
					<div role="group" aria-label="View" class="border-border bg-card flex rounded-full border p-[3px]">
						<button type="button" aria-label="Grid view" aria-pressed={mode === 'grid'} onclick={() => (mode = 'grid')} class="text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground grid size-[38px] cursor-pointer place-items-center rounded-full"><LayoutGrid class="size-[18px]" /></button>
						<button type="button" aria-label="List view" aria-pressed={mode === 'list'} onclick={() => (mode = 'list')} class="text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground grid size-[38px] cursor-pointer place-items-center rounded-full"><List class="size-[18px]" /></button>
					</div>
				{/if}
				{#if pages > 1}
					<div class="ml-1.5 flex items-center gap-1.5">
						<span class="font-display mr-1 text-[15px] font-bold tracking-[-0.01em] tabular-nums">{from}–{to} <span class="text-muted-foreground font-medium">/ {total.toLocaleString()}</span></span>
						<Button variant="outline" size="icon" aria-label="Previous page" disabled={pageNo === 0} onclick={() => set({ page: String(pageNo) })}><ChevronLeft /></Button>
						<Button variant="outline" size="icon" aria-label="Next page" disabled={pageNo >= pages - 1} onclick={() => set({ page: String(pageNo + 2) })}><ChevronRight /></Button>
					</div>
				{/if}
			</div>
		{/if}

		{#if chips.length && tab !== 'genres'}
			<ul aria-label="Active filters" class="-mt-3 flex flex-wrap items-center gap-2">
				{#each chips as c (c.label)}
					<li>
						<button type="button" onclick={() => set(c.clear)} class="bg-secondary hover:bg-accent inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-sm font-medium" aria-label="Remove filter {c.label}">
							{c.label}<X class="size-3.5" aria-hidden="true" />
						</button>
					</li>
				{/each}
				<li><button type="button" class="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-2 text-sm" onclick={() => set(clearAll)}>Clear all</button></li>
			</ul>
		{/if}

		<div class="flex items-start gap-6">
			<div class="min-w-0 flex-1 transition-opacity {items.isPlaceholderData ? 'opacity-60' : ''}">
				{#if items.isPending}
					<ul class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8">
						{#each { length: 18 } as _, k (k)}<li><Skeleton class="{square ? 'aspect-square' : 'aspect-[2/3]'} rounded-xl" /></li>{/each}
					</ul>
				{:else if items.isError}
					<p role="alert" class="text-destructive">Couldn't load this library: {items.error.message}</p>
				{:else if !items.data?.items.length}
					<p class="text-muted-foreground">{chips.length ? 'Nothing matches these filters.' : letter ? `Nothing starting with “${letter}”.` : 'Nothing here yet.'}</p>
				{:else if tab === 'songs'}
					<TrackList tracks={items.data.items} showAlbum onplay={(i) => playTracks(items.data!.items, i)} />
				{:else if tab === 'genres'}
					<ul class="flex flex-wrap gap-2">
						{#each items.data.items as g (g.Id)}
							<li><a href={href(g)} class="border-border bg-card hover:border-ring inline-flex h-11 items-center rounded-full border px-5 font-medium">{g.Name}</a></li>
						{/each}
					</ul>
				{:else if mode === 'list'}
					<div class="text-muted-foreground border-border grid grid-cols-[56px_minmax(0,3fr)_minmax(0,2fr)_70px] items-center gap-4 border-b px-3 pb-2.5 text-xs font-semibold tracking-[0.06em] uppercase max-md:hidden" aria-hidden="true">
						<span></span><span>{tab === 'artists' ? 'Artist' : 'Title'}</span><span>{view.data?.CollectionType === 'music' ? 'Artist' : 'Details'}</span><span>Year</span>
					</div>
					<ul class="flex flex-col">
						{#each items.data.items as item (item.Id)}
							{@const thumb = primaryImage(item, 112)}
							<li class="border-border border-b">
								<a href={href(item)} class="hover:bg-accent grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 rounded-lg px-3 py-2 md:grid-cols-[56px_minmax(0,3fr)_minmax(0,2fr)_70px]">
									<span class="bg-muted size-14 overflow-hidden {tab === 'artists' ? 'rounded-full' : 'rounded-lg'}">{#if thumb}<img src={thumb} alt="" loading="lazy" class="size-full object-cover" />{/if}</span>
									<span class="truncate text-[15px] font-semibold">{item.Name}</span>
									<span class="text-muted-foreground truncate text-sm max-md:hidden">{item.AlbumArtist ?? item.Genres?.slice(0, 2).join(', ') ?? ''}</span>
									<span class="text-muted-foreground text-sm tabular-nums max-md:hidden">{item.ProductionYear ?? ''}</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<ul class="grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:gap-x-5 md:gap-y-8">
						{#each items.data.items as item (item.Id)}
							<li class="min-w-0"><MediaCard {item} shape={square ? 'square' : 'poster'} subtitle={tab === 'artists' ? '' : itemSubtitle(item)} /></li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if tab !== 'genres'}
				<nav aria-label="Jump to letter" class="sticky top-6 flex w-7 shrink-0 flex-col items-center gap-0.5 max-md:hidden">
					{#each LETTERS as l (l)}
						<a
							href={(() => {
								const p = new URLSearchParams(params);
								p.delete('page');
								if (letter === l) p.delete('letter');
								else p.set('letter', l);
								const qs = p.toString();
								return resolve('/library/[id]', { id }) + (qs ? `?${qs}` : '');
							})()}
							aria-current={letter === l ? 'true' : undefined}
							aria-label={l === '#' ? 'Numbers and symbols' : `Starting with ${l}`}
							class="text-muted-foreground hover:text-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground w-7 rounded-md py-0.5 text-center text-[11px] font-semibold"
						>{l}</a>
					{/each}
				</nav>
			{/if}
		</div>
		{#if letter}
			<p class="text-sm"><a class="text-primary font-semibold hover:underline" href={resolve('/library/[id]', { id }) + (tab !== 'items' ? `?tab=${tab}` : '')}>Show all {noun}</a> · <Search class="inline size-3.5" aria-hidden="true" /> starting with “{letter}”</p>
		{/if}
	</main>
</div>
