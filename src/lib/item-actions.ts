import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getPlaylistApi } from '@jellyfin/sdk/lib/utils/api/playlist-api';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { BaseItemKind, ItemSortBy, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import { api, session } from '#lib/api/session.svelte.ts';
import { CARD_FIELDS, fetchChildren } from '#lib/api/queries.ts';
import { player } from '#lib/player/player.svelte.ts';
import { playItem, playMix } from '#lib/player/actions.ts';
import { queryClient, refreshItemViews } from '#lib/query-client.ts';
import { toasts } from '#lib/toast.svelte.ts';

const MUSIC = ['Audio', 'MusicAlbum', 'MusicArtist', 'MusicGenre', 'Playlist'];

/** Can this item's tracks go into the music queue? */
export function isQueueable(item: BaseItemDto): boolean {
	return MUSIC.includes(item.Type ?? '') && (item.Type !== 'Playlist' || item.MediaType !== 'Video');
}

export function canPlay(item: BaseItemDto): boolean {
	return item.MediaType === 'Video' || item.MediaType === 'Audio' || ['Series', 'Season', 'MusicAlbum', 'MusicArtist', 'Playlist', 'BoxSet', 'MusicGenre'].includes(item.Type ?? '');
}

export function canMarkWatched(item: BaseItemDto): boolean {
	return ['Movie', 'Episode', 'Series', 'Season', 'Video', 'BoxSet', 'MusicVideo'].includes(item.Type ?? '');
}

export const can = {
	edit: () => !!session.user?.Policy?.IsAdministrator,
	delete: (item: BaseItemDto) =>
		item.CanDelete !== false && (!!session.user?.Policy?.IsAdministrator || !!session.user?.Policy?.EnableContentDeletion),
	download: (item: BaseItemDto) =>
		item.CanDownload !== false && !!session.user?.Policy?.EnableContentDownloading && (item.MediaType === 'Audio' || item.MediaType === 'Video')
};

/** All tracks an item stands for, in listening order. */
export async function resolveTracks(item: BaseItemDto): Promise<BaseItemDto[]> {
	switch (item.Type) {
		case 'Audio':
			return [item];
		case 'MusicAlbum':
		case 'Playlist':
			return (await fetchChildren(item)).filter((c) => c.MediaType === 'Audio');
		case 'MusicArtist':
		case 'MusicGenre': {
			const { data } = await getLibraryApi(api()).getItems({
				userId: session.userId,
				recursive: true,
				includeItemTypes: [BaseItemKind.Audio],
				...(item.Type === 'MusicArtist' ? { artistIds: [item.Id!] } : { genreIds: [item.Id!] }),
				sortBy: [ItemSortBy.ProductionYear, ItemSortBy.Album, ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber],
				fields: CARD_FIELDS,
				limit: 500
			});
			return data.Items ?? [];
		}
		default:
			return [];
	}
}

const plural = (n: number) => `${n} ${n === 1 ? 'track' : 'tracks'}`;

export async function queueNext(item: BaseItemDto): Promise<void> {
	const tracks = await resolveTracks(item);
	if (!tracks.length) return toasts.error('Nothing playable in this item.');
	player.playNext(tracks);
	toasts.show(`${plural(tracks.length)} will play next`);
}

export async function queueLast(item: BaseItemDto): Promise<void> {
	const tracks = await resolveTracks(item);
	if (!tracks.length) return toasts.error('Nothing playable in this item.');
	player.enqueue(tracks);
	toasts.show(`Added ${plural(tracks.length)} to the queue`);
}

export { playItem, playMix };

export async function toggleFavorite(item: BaseItemDto): Promise<void> {
	if (!item.Id) return;
	const fav = !!item.UserData?.IsFavorite;
	const ud = getUserDataApi(api());
	const p = { itemId: item.Id, userId: session.userId };
	try {
		const { data } = await (fav ? ud.unmarkFavoriteItem(p) : ud.markFavoriteItem(p));
		player.patch(item.Id, { UserData: data });
		refreshItemViews();
		toasts.show(fav ? 'Removed from favorites' : 'Added to favorites');
	} catch {
		toasts.error("Couldn't update favorites.");
	}
}

export async function toggleWatched(item: BaseItemDto): Promise<void> {
	if (!item.Id) return;
	const played = !!item.UserData?.Played;
	const ud = getUserDataApi(api());
	const p = { itemId: item.Id, userId: session.userId };
	try {
		await (played ? ud.markUnplayedItem(p) : ud.markPlayedItem(p));
		refreshItemViews();
		toasts.show(played ? 'Marked as unwatched' : 'Marked as watched');
	} catch {
		toasts.error("Couldn't update watched state.");
	}
}

export async function userPlaylists(): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		recursive: true,
		includeItemTypes: [BaseItemKind.Playlist],
		sortBy: [ItemSortBy.SortName],
		limit: 200
	});
	return data.Items ?? [];
}

export async function addToPlaylist(playlist: BaseItemDto, items: BaseItemDto[]): Promise<void> {
	try {
		await getPlaylistApi(api()).addItemToPlaylist({ playlistId: playlist.Id!, ids: items.map((i) => i.Id!), userId: session.userId });
		queryClient.invalidateQueries({ queryKey: ['children', session.userId, playlist.Id] });
		toasts.show(`Added to “${playlist.Name}”`, {
			action: { label: 'Open', run: () => goto(resolve('/item/[id]', { id: playlist.Id! })) }
		});
	} catch {
		toasts.error("Couldn't add to the playlist.");
	}
}

export async function createPlaylist(name: string, items: BaseItemDto[]): Promise<void> {
	const video = items.length > 0 && items.every((i) => i.MediaType === 'Video' || ['Series', 'Season', 'Movie'].includes(i.Type ?? ''));
	const { data } = await getPlaylistApi(api()).createPlaylist({
		createPlaylistDto: { Name: name, Ids: items.map((i) => i.Id!).filter(Boolean), UserId: session.userId, MediaType: video ? 'Video' : 'Audio' }
	});
	queryClient.invalidateQueries({ queryKey: ['libraryTab'] });
	toasts.show(`Created “${name}”`, { action: data.Id ? { label: 'Open', run: () => goto(resolve('/item/[id]', { id: data.Id! })) } : undefined });
}

export async function removeFromPlaylist(playlistId: string, item: BaseItemDto): Promise<void> {
	if (!item.PlaylistItemId) return;
	try {
		await getPlaylistApi(api()).removeItemFromPlaylist({ playlistId, entryIds: [item.PlaylistItemId] });
		queryClient.invalidateQueries({ queryKey: ['children', session.userId, playlistId] });
		toasts.show(`Removed “${item.Name}” from the playlist`);
	} catch {
		toasts.error("Couldn't remove it from the playlist.");
	}
}

export async function refreshMetadata(item: BaseItemDto): Promise<void> {
	try {
		await getLibraryApi(api()).refreshItem({
			itemId: item.Id!,
			metadataRefreshMode: 'FullRefresh',
			imageRefreshMode: 'FullRefresh',
			replaceAllMetadata: false,
			replaceAllImages: false
		});
		toasts.show(`Refreshing metadata for “${item.Name}”. Changes appear in a moment.`);
		setTimeout(refreshItemViews, 8000);
	} catch {
		toasts.error("Couldn't start a metadata refresh.");
	}
}

export async function deleteItem(item: BaseItemDto): Promise<void> {
	await getLibraryApi(api()).deleteItem({ itemId: item.Id! });
	refreshItemViews();
	toasts.show(`Deleted “${item.Name}”`);
}

export function download(item: BaseItemDto): void {
	const url = getLibraryApi(api()).getDownloadUrl({ itemId: item.Id! });
	const a = document.createElement('a');
	a.href = url;
	a.download = '';
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export async function copyLink(item: BaseItemDto): Promise<void> {
	const url = `${location.origin}${location.pathname}#/item/${item.Id}`;
	try {
		await navigator.clipboard.writeText(url);
		toasts.show('Link copied');
	} catch {
		toasts.error("Couldn't copy the link.");
	}
}
