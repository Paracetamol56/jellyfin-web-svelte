<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { clock, ticksToSeconds } from '#lib/api/format.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';
	import ItemContextMenu from '#lib/components/menu/ItemContextMenu.svelte';
	import ItemMenuButton from '#lib/components/menu/ItemMenuButton.svelte';

	let {
		tracks,
		loading = false,
		showAlbum = false,
		playlistId,
		hereId,
		onplay
	}: { tracks: BaseItemDto[]; loading?: boolean; showAlbum?: boolean; playlistId?: string; hereId?: string; onplay: (index: number) => void } = $props();

	const discs = $derived(new Set(tracks.map((t) => t.ParentIndexNumber ?? 1)).size > 1);
	const albumArtist = $derived(tracks[0]?.AlbumArtist);
</script>

<ol class="flex list-none flex-col">
	{#if loading}
		{#each { length: 8 } as _, i (i)}<li><Skeleton class="my-1 h-12 rounded-xl" /></li>{/each}
	{/if}
	{#each tracks as t, i (t.Id)}
		{@const current = player.current?.Id === t.Id}
		{@const artists = (t.Artists ?? []).join(', ')}
		{#if discs && (i === 0 || (tracks[i - 1].ParentIndexNumber ?? 1) !== (t.ParentIndexNumber ?? 1))}
			<li class="text-muted-foreground px-3 pt-5 pb-2 text-xs font-bold tracking-[0.1em] uppercase">Disc {t.ParentIndexNumber ?? 1}</li>
		{/if}
		<li>
			<ItemContextMenu item={t} context={{ playlistId, hereId }} class="group/row flex items-center gap-1">
			<button
				type="button"
				onclick={() => onplay(i)}
				aria-label="Play {t.Name}{artists && artists !== albumArtist ? ` by ${artists}` : ''}"
				aria-current={current ? 'true' : undefined}
				class="group hover:bg-accent aria-[current=true]:text-primary flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-xl px-3 text-left"
			>
				<span class="text-muted-foreground grid w-6 shrink-0 place-items-center text-sm tabular-nums">
					<span class="group-hover:hidden">{showAlbum ? i + 1 : (t.IndexNumber ?? i + 1)}</span>
					<Play class="hidden size-4 fill-current group-hover:block" aria-hidden="true" />
				</span>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="truncate font-semibold">{t.Name}</span>
					{#if showAlbum || (artists && artists !== albumArtist)}
						<span class="text-muted-foreground truncate text-[13px]">{[artists, showAlbum ? t.Album : null].filter(Boolean).join(' · ')}</span>
					{/if}
				</span>
				<span class="text-muted-foreground text-sm tabular-nums">{clock(ticksToSeconds(t.RunTimeTicks))}</span>
			</button>
			<span class="opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
				<ItemMenuButton item={t} context={{ playlistId, hereId }} />
			</span>
			</ItemContextMenu>
		</li>
	{/each}
</ol>
