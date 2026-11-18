<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { getItemUpdateApi } from '@jellyfin/sdk/lib/utils/api/item-update-api';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { api, session } from '#lib/api/session.svelte.ts';
	import { fetchItem } from '#lib/api/queries.ts';
	import { refreshItemViews } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	let { item, open = $bindable() }: { item: BaseItemDto; open: boolean } = $props();

	const full = createQuery(() => ({ queryKey: ['item', session.userId, item.Id], queryFn: () => fetchItem(item.Id!), staleTime: 0 }));
	const audio = $derived(item.Type === 'Audio' || item.Type === 'MusicAlbum');
	const video = $derived(['Movie', 'Series', 'Episode', 'Season', 'Video', 'BoxSet'].includes(item.Type ?? ''));

	// Form state, filled once the full item arrives.
	let f = $state({
		Name: '', OriginalTitle: '', ForcedSortName: '', Overview: '', ProductionYear: '', PremiereDate: '',
		OfficialRating: '', CommunityRating: '', Genres: '', Tags: '', Studios: '',
		Album: '', AlbumArtists: '', Artists: '', IndexNumber: '', ParentIndexNumber: '', LockData: false
	});
	let loaded = $state(false);
	let saving = $state(false);
	const list = (a: (string | null | undefined)[] | null | undefined) => (a ?? []).filter(Boolean).join(', ');
	const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
	const num = (s: string) => (s.trim() === '' ? null : Number(s));

	$effect(() => {
		const d = full.data;
		if (!d || loaded) return;
		f = {
			Name: d.Name ?? '', OriginalTitle: d.OriginalTitle ?? '', ForcedSortName: d.ForcedSortName ?? '', Overview: d.Overview ?? '',
			ProductionYear: d.ProductionYear?.toString() ?? '', PremiereDate: d.PremiereDate?.slice(0, 10) ?? '',
			OfficialRating: d.OfficialRating ?? '', CommunityRating: d.CommunityRating?.toString() ?? '',
			Genres: list(d.Genres), Tags: list(d.Tags), Studios: list(d.Studios?.map((s) => s.Name)),
			Album: d.Album ?? '', AlbumArtists: list(d.AlbumArtists?.map((a) => a.Name)), Artists: list(d.Artists),
			IndexNumber: d.IndexNumber?.toString() ?? '', ParentIndexNumber: d.ParentIndexNumber?.toString() ?? '', LockData: !!d.LockData
		};
		loaded = true;
	});

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!full.data) return;
		saving = true;
		try {
			const d = full.data;
			const dto: BaseItemDto = {
				...d,
				Name: f.Name.trim(),
				OriginalTitle: f.OriginalTitle.trim() || null,
				ForcedSortName: f.ForcedSortName.trim() || null,
				Overview: f.Overview,
				ProductionYear: num(f.ProductionYear),
				PremiereDate: f.PremiereDate ? new Date(f.PremiereDate).toISOString() : null,
				OfficialRating: f.OfficialRating.trim() || null,
				CommunityRating: num(f.CommunityRating),
				Genres: split(f.Genres),
				Tags: split(f.Tags),
				LockData: f.LockData,
				...(video ? { Studios: split(f.Studios).map((Name) => ({ Name })) } : {}),
				...(audio
					? {
							Album: f.Album.trim() || null,
							AlbumArtists: split(f.AlbumArtists).map((Name) => ({ Name })),
							Artists: split(f.Artists),
							IndexNumber: num(f.IndexNumber),
							ParentIndexNumber: num(f.ParentIndexNumber)
						}
					: {})
			};
			await getItemUpdateApi(api()).updateItem({ itemId: d.Id!, baseItemDto: dto });
			refreshItemViews();
			toasts.show('Metadata saved');
			open = false;
		} catch {
			toasts.error("Couldn't save the changes.");
		} finally {
			saving = false;
		}
	}

	const field = 'flex flex-col gap-1.5';
	const textarea = 'border-input bg-card placeholder:text-muted-foreground min-h-32 w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus-visible:border-ring';
</script>

<Dialog bind:open title="Edit metadata" description={item.Name ?? ''} wide>
	{#if !loaded}
		<div class="flex flex-col gap-3">{#each { length: 6 } as _, i (i)}<Skeleton class="h-11" />{/each}</div>
	{:else}
		<form id="edit-meta" onsubmit={save} class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="{field} sm:col-span-2"><Label for="m-name">Title</Label><Input id="m-name" required bind:value={f.Name} /></div>
			<div class={field}><Label for="m-orig">Original title</Label><Input id="m-orig" bind:value={f.OriginalTitle} /></div>
			<div class={field}><Label for="m-sort">Sort title</Label><Input id="m-sort" bind:value={f.ForcedSortName} placeholder="Same as title" /></div>
			<div class="{field} sm:col-span-2"><Label for="m-overview">Overview</Label><textarea id="m-overview" class={textarea} bind:value={f.Overview}></textarea></div>
			<div class={field}><Label for="m-year">Year</Label><Input id="m-year" inputmode="numeric" bind:value={f.ProductionYear} /></div>
			<div class={field}><Label for="m-date">Release date</Label><Input id="m-date" type="date" bind:value={f.PremiereDate} /></div>
			{#if audio}
				<div class={field}><Label for="m-album">Album</Label><Input id="m-album" bind:value={f.Album} /></div>
				<div class={field}><Label for="m-aa">Album artists</Label><Input id="m-aa" bind:value={f.AlbumArtists} placeholder="Comma-separated" /></div>
				{#if item.Type === 'Audio'}
					<div class={field}><Label for="m-artists">Artists</Label><Input id="m-artists" bind:value={f.Artists} placeholder="Comma-separated" /></div>
					<div class="grid grid-cols-2 gap-3">
						<div class={field}><Label for="m-track">Track</Label><Input id="m-track" inputmode="numeric" bind:value={f.IndexNumber} /></div>
						<div class={field}><Label for="m-disc">Disc</Label><Input id="m-disc" inputmode="numeric" bind:value={f.ParentIndexNumber} /></div>
					</div>
				{/if}
			{/if}
			{#if video}
				<div class={field}><Label for="m-rating">Parental rating</Label><Input id="m-rating" bind:value={f.OfficialRating} placeholder="e.g. PG-13" /></div>
				<div class={field}><Label for="m-score">Community rating</Label><Input id="m-score" inputmode="decimal" bind:value={f.CommunityRating} placeholder="0–10" /></div>
				<div class="{field} sm:col-span-2"><Label for="m-studios">Studios</Label><Input id="m-studios" bind:value={f.Studios} placeholder="Comma-separated" /></div>
			{/if}
			<div class={field}><Label for="m-genres">Genres</Label><Input id="m-genres" bind:value={f.Genres} placeholder="Comma-separated" /></div>
			<div class={field}><Label for="m-tags">Tags</Label><Input id="m-tags" bind:value={f.Tags} placeholder="Comma-separated" /></div>
			<label class="flex cursor-pointer items-start gap-3 sm:col-span-2">
				<input type="checkbox" class="accent-primary mt-0.5 size-5" bind:checked={f.LockData} />
				<span><span class="block font-semibold">Lock this item</span><span class="text-muted-foreground block text-sm">Metadata refreshes won't overwrite your changes.</span></span>
			</label>
		</form>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button type="submit" form="edit-meta" disabled={!loaded || saving}>{saving ? 'Saving…' : 'Save'}</Button>
	{/snippet}
</Dialog>
