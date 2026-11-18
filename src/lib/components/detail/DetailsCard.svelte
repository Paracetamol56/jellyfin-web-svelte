<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { duration } from '#lib/api/format.ts';

	let { item }: { item: BaseItemDto } = $props();

	const directors = $derived((item.People ?? []).filter((p) => p.Type === 'Director').slice(0, 3));
	const writers = $derived((item.People ?? []).filter((p) => p.Type === 'Writer').slice(0, 3));
	const studios = $derived((item.Studios ?? []).slice(0, 2));
	// Playlists carry plain genre names (no ids), so fall back to those.
	const genres = $derived(item.GenreItems?.length ? item.GenreItems : (item.Genres ?? []).map((Name) => ({ Name, Id: undefined as string | undefined })));
	const collection = $derived(item.Type === 'Playlist' || item.Type === 'MusicAlbum');
	const facts = $derived(
		collection
			? ([
					['Tracks', item.ChildCount ? String(item.ChildCount) : null],
					['Duration', duration(item.RunTimeTicks ?? item.CumulativeRunTimeTicks) || null],
					['Created', item.Type === 'Playlist' && item.DateCreated ? new Date(item.DateCreated).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : null]
				].filter(([, v]) => v) as [string, string][])
			: []
	);
	const links = $derived((item.ExternalUrls ?? []).filter((l) => l.Url).slice(0, 4));
	const premiere = $derived(item.PremiereDate ? new Date(item.PremiereDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : null);
	const row = 'flex justify-between gap-3';
	const label = 'text-muted-foreground shrink-0';
	const search = (key: 'genre' | 'studio', v: string) => resolve('/search') + `?${key}=${encodeURIComponent(v)}`;
</script>

{#if directors.length || studios.length || (genres.length && !collection) || links.length || premiere || facts.length}
	<div class="bg-card border-border flex flex-col gap-3 rounded-[20px] border p-[22px] text-sm">
		<h2 class="text-muted-foreground font-sans text-xs font-bold tracking-[0.1em] uppercase">Details</h2>
		{#each facts as [k, v] (k)}
			<div class={row}><span class={label}>{k}</span><span class="text-right">{v}</span></div>
		{/each}
		{#if directors.length}
			<div class={row}>
				<span class={label}>{directors.length > 1 ? 'Directors' : 'Director'}</span>
				<span class="text-right">
					{#each directors as p, i (p.Id)}{#if i},&nbsp;{/if}<a class="hover:text-primary" href={resolve('/item/[id]', { id: p.Id! })}>{p.Name}</a>{/each}
				</span>
			</div>
		{/if}
		{#if writers.length}
			<div class={row}>
				<span class={label}>Writing</span>
				<span class="text-right">
					{#each writers as p, i (p.Id)}{#if i},&nbsp;{/if}<a class="hover:text-primary" href={resolve('/item/[id]', { id: p.Id! })}>{p.Name}</a>{/each}
				</span>
			</div>
		{/if}
		{#if studios.length}
			<div class={row}>
				<span class={label}>Studio</span>
				<span class="text-right">
					{#each studios as s, i (s.Id ?? s.Name)}{#if i},&nbsp;{/if}<a class="hover:text-primary" href={search('studio', s.Name ?? '')}>{s.Name}</a>{/each}
				</span>
			</div>
		{/if}
		{#if genres.length && !collection}
			<div class={row}>
				<span class={label}>Genres</span>
				<span class="text-right">
					{#each genres as g, i (g.Name)}{#if i},&nbsp;{/if}<a class="hover:text-primary" href={search('genre', g.Name ?? '')}>{g.Name}</a>{/each}
				</span>
			</div>
		{/if}
		{#if premiere}
			<div class={row}><span class={label}>Released</span><span class="text-right">{premiere}</span></div>
		{/if}
		{#if links.length}
			<div class={row}>
				<span class={label}>Links</span>
				<span class="flex flex-wrap justify-end gap-3">
					{#each links as l (l.Url)}
						<a href={l.Url} target="_blank" rel="noopener noreferrer" class="text-primary inline-flex items-center gap-1 hover:underline">
							{l.Name}<ExternalLink class="size-3.5" aria-hidden="true" /><span class="sr-only">(opens in a new tab)</span>
						</a>
					{/each}
				</span>
			</div>
		{/if}
	</div>
{/if}
