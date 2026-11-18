<script lang="ts" module>
	export interface MenuContext {
		/** Item is an entry in this playlist (enables "Remove from playlist"). */
		playlistId?: string;
		/** Item is this entry of the play queue (enables queue actions). */
		queueIndex?: number;
		/** Hide "Go to …" links that point at the page we're on. */
		hereId?: string;
	}
</script>

<script lang="ts">
	import { artistsOf } from '#lib/components/ArtistLinks.svelte';
	// Menu items shared by the right-click menu and the ⋯ button (bits-ui uses the same item parts for both).
	import { DropdownMenu } from 'bits-ui';
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CirclePlay from '@lucide/svelte/icons/circle-play';
	import Disc3 from '@lucide/svelte/icons/disc-3';
	import Download from '@lucide/svelte/icons/download';
	import Heart from '@lucide/svelte/icons/heart';
	import Info from '@lucide/svelte/icons/info';
	import Link from '@lucide/svelte/icons/link';
	import ListEnd from '@lucide/svelte/icons/list-end';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import ListStart from '@lucide/svelte/icons/list-start';
	import ListX from '@lucide/svelte/icons/list-x';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Tv from '@lucide/svelte/icons/tv';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { session } from '#lib/api/session.svelte.ts';
	import { dialogs } from '#lib/dialogs.svelte.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import {
		addToPlaylist,
		can,
		canMarkWatched,
		canPlay,
		copyLink,
		download,
		isQueueable,
		playItem,
		playMix,
		queueLast,
		queueNext,
		refreshMetadata,
		removeFromPlaylist,
		toggleFavorite,
		toggleWatched,
		userPlaylists
	} from '#lib/item-actions.ts';

	let { item, context = {} }: { item: BaseItemDto; context?: MenuContext } = $props();

	const q = $derived(context.queueIndex);
	const inQueue = $derived(q != null);
	const music = $derived(isQueueable(item));
	const container = $derived(['MusicAlbum', 'Playlist', 'MusicArtist', 'MusicGenre', 'Series', 'Season', 'BoxSet'].includes(item.Type ?? ''));
	const albumId = $derived(item.Type === 'Audio' ? item.AlbumId : null);
	const artists = $derived(item.Type === 'Audio' || item.Type === 'MusicAlbum' ? artistsOf(item).filter((a) => a.Id && a.Id !== context.hereId) : []);
	const seriesId = $derived(item.Type === 'Episode' || item.Type === 'Season' ? item.SeriesId : null);
	const canAddToPlaylist = $derived(item.Type !== 'Playlist' && item.Type !== 'Person' && item.Type !== 'CollectionFolder' && !!item.Id);

	let playlistsOpen = $state(false);
	const playlists = createQuery(() => ({
		queryKey: ['userPlaylists', session.userId],
		queryFn: userPlaylists,
		enabled: playlistsOpen,
		staleTime: 30_000
	}));

	const go = (id: string) => goto(resolve('/item/[id]', { id }));
	const cls = 'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none select-none data-highlighted:bg-accent data-disabled:opacity-50';
	const sep = 'bg-border my-1 h-px';
	const icon = 'size-4 shrink-0 text-muted-foreground';
</script>

<!-- Queue entry -->
{#if inQueue}
	{#if q !== player.index}
		<DropdownMenu.Item class={cls} onSelect={() => player.jump(q!)}><CirclePlay class={icon} />Play now</DropdownMenu.Item>
		<DropdownMenu.Item class={cls} disabled={q === player.index + 1 || q! < player.index} onSelect={() => player.move(q!, player.index + 1)}>
			<ArrowUpToLine class={icon} />Play next
		</DropdownMenu.Item>
	{/if}
	<DropdownMenu.Item class={cls} disabled={q === 0} onSelect={() => player.move(q!, q! - 1)}><ArrowUp class={icon} />Move up</DropdownMenu.Item>
	<DropdownMenu.Item class={cls} disabled={q === player.queue.length - 1} onSelect={() => player.move(q!, q! + 1)}><ArrowDown class={icon} />Move down</DropdownMenu.Item>
	<DropdownMenu.Item class={cls} onSelect={() => player.removeAt(q!)}><ListX class={icon} />Remove from queue</DropdownMenu.Item>
	<DropdownMenu.Separator class={sep} />
{:else if canPlay(item)}
	<DropdownMenu.Item class={cls} onSelect={() => (item.Type === 'MusicArtist' ? playItem(item) : playItem(item))}><Play class={icon} />Play</DropdownMenu.Item>
	{#if container && music}
		<DropdownMenu.Item class={cls} onSelect={() => playItem(item, { shuffle: true })}><Shuffle class={icon} />Shuffle</DropdownMenu.Item>
	{/if}
	{#if music}
		<DropdownMenu.Item class={cls} onSelect={() => queueNext(item)}><ListStart class={icon} />Play next</DropdownMenu.Item>
		<DropdownMenu.Item class={cls} onSelect={() => queueLast(item)}><ListEnd class={icon} />Add to queue</DropdownMenu.Item>
		{#if item.Type !== 'Playlist'}
			<DropdownMenu.Item class={cls} onSelect={() => playMix(item)}><Sparkles class={icon} />Instant mix</DropdownMenu.Item>
		{/if}
	{/if}
	<DropdownMenu.Separator class={sep} />
{/if}

{#if canAddToPlaylist}
	<DropdownMenu.Sub bind:open={playlistsOpen}>
		<DropdownMenu.SubTrigger class={cls}><ListPlus class={icon} /><span class="flex-1">Add to playlist</span><ChevronRight class="size-4" /></DropdownMenu.SubTrigger>
		<DropdownMenu.SubContent class="bg-popover text-popover-foreground border-border z-[55] max-h-80 min-w-56 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl" sideOffset={4}>
			<DropdownMenu.Item class={cls} onSelect={() => dialogs.open('playlist', item)}><Plus class={icon} />New playlist…</DropdownMenu.Item>
			{#if playlists.data?.length}<DropdownMenu.Separator class={sep} />{/if}
			{#if playlists.isPending}
				<DropdownMenu.Item class={cls} disabled>Loading playlists…</DropdownMenu.Item>
			{/if}
			{#each playlists.data ?? [] as pl (pl.Id)}
				<DropdownMenu.Item class={cls} onSelect={() => addToPlaylist(pl, [item])}><ListMusic class={icon} /><span class="truncate">{pl.Name}</span></DropdownMenu.Item>
			{/each}
		</DropdownMenu.SubContent>
	</DropdownMenu.Sub>
{/if}
{#if context.playlistId && item.PlaylistItemId}
	<DropdownMenu.Item class={cls} onSelect={() => removeFromPlaylist(context.playlistId!, item)}><ListX class={icon} />Remove from playlist</DropdownMenu.Item>
{/if}

{#if (albumId && albumId !== context.hereId) || artists.length > 0 || (seriesId && seriesId !== context.hereId)}
	<DropdownMenu.Separator class={sep} />
	{#if albumId && albumId !== context.hereId}
		<DropdownMenu.Item class={cls} onSelect={() => go(albumId)}><Disc3 class={icon} />Go to album</DropdownMenu.Item>
	{/if}
	{#each artists as a (a.Id)}
		<DropdownMenu.Item class={cls} onSelect={() => go(a.Id!)}><UserRound class={icon} />{artists.length > 1 ? `Go to ${a.Name}` : 'Go to artist'}</DropdownMenu.Item>
	{/each}
	{#if seriesId && seriesId !== context.hereId}
		<DropdownMenu.Item class={cls} onSelect={() => go(seriesId)}><Tv class={icon} />Go to series</DropdownMenu.Item>
	{/if}
{/if}

<DropdownMenu.Separator class={sep} />
{#if canMarkWatched(item)}
	<DropdownMenu.Item class={cls} onSelect={() => toggleWatched(item)}>
		<Check class={icon} />{item.UserData?.Played ? 'Mark as unwatched' : 'Mark as watched'}
	</DropdownMenu.Item>
{/if}
{#if item.Type !== 'CollectionFolder'}
	<DropdownMenu.Item class={cls} onSelect={() => toggleFavorite(item)}>
		<Heart class="{icon} {item.UserData?.IsFavorite ? 'fill-current' : ''}" />{item.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'}
	</DropdownMenu.Item>
{/if}
<DropdownMenu.Item class={cls} onSelect={() => dialogs.open('info', item)}><Info class={icon} />Media info</DropdownMenu.Item>
<DropdownMenu.Item class={cls} onSelect={() => copyLink(item)}><Link class={icon} />Copy link</DropdownMenu.Item>
{#if can.download(item)}
	<DropdownMenu.Item class={cls} onSelect={() => download(item)}><Download class={icon} />Download</DropdownMenu.Item>
{/if}

{#if can.edit() || can.delete(item)}
	<DropdownMenu.Separator class={sep} />
	<DropdownMenu.Group>
		<DropdownMenu.GroupHeading class="text-muted-foreground px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-[0.1em] uppercase">Manage</DropdownMenu.GroupHeading>
		{#if can.edit()}
			<DropdownMenu.Item class={cls} onSelect={() => dialogs.open('edit', item)}><Pencil class={icon} />Edit metadata…</DropdownMenu.Item>
			<DropdownMenu.Item class={cls} onSelect={() => refreshMetadata(item)}><RefreshCw class={icon} />Refresh metadata</DropdownMenu.Item>
		{/if}
		{#if can.delete(item)}
			<DropdownMenu.Item class="{cls} text-destructive" onSelect={() => dialogs.open('delete', item)}><Trash2 class="size-4 shrink-0" />Delete…</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Group>
{/if}
