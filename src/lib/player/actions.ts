import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getInstantMixApi } from '@jellyfin/sdk/lib/utils/api/instant-mix-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import { api, session } from '#lib/api/session.svelte.ts';
import { fetchChildren, fetchEpisodes, fetchSeasons, fetchSeriesNextUp } from '#lib/api/queries.ts';
import { player, type PlayOptions } from './player.svelte.ts';

const isVideo = (i: BaseItemDto) => i.MediaType === 'Video';

/** Start video items and open the full-screen player. */
async function playVideo(items: BaseItemDto[], index: number, options: PlayOptions = {}) {
	const id = items[index]?.Id;
	if (!id) return;
	// The video page attaches its <video> element and playback starts there.
	player.play(items, index, options);
	await goto(resolve('/play/[id]', { id }));
}

/** Rest of the season after an episode, so "next episode" just works. */
async function seasonQueue(ep: BaseItemDto): Promise<{ items: BaseItemDto[]; index: number }> {
	if (!ep.SeriesId || !ep.SeasonId) return { items: [ep], index: 0 };
	const eps = await fetchEpisodes(ep.SeriesId, ep.SeasonId).catch(() => [ep]);
	const index = Math.max(0, eps.findIndex((e) => e.Id === ep.Id));
	return { items: eps.length ? eps : [ep], index };
}

/** "Play" for any item: works out what that means for its type. */
export async function playItem(item: BaseItemDto, options: PlayOptions & { shuffle?: boolean } = {}): Promise<void> {
	switch (item.Type) {
		case 'Episode': {
			const { items, index } = await seasonQueue(item);
			return playVideo(items, index, options);
		}
		case 'Series': {
			const next = await fetchSeriesNextUp(item.Id!);
			if (next) return playItem(next);
			const seasons = await fetchSeasons(item.Id!);
			if (!seasons[0]?.Id) return;
			const eps = await fetchEpisodes(item.Id!, seasons[0].Id);
			return playVideo(eps, 0);
		}
		case 'Season': {
			const eps = await fetchEpisodes(item.SeriesId!, item.Id!);
			const start = Math.max(0, eps.findIndex((e) => !e.UserData?.Played));
			return playVideo(eps, start);
		}
		case 'MusicAlbum':
		case 'Playlist':
		case 'BoxSet': {
			const children = (await fetchChildren(item)).filter((c) => c.MediaType === 'Audio' || c.MediaType === 'Video');
			if (!children.length) return;
			if (children.every(isVideo)) return playVideo(children, 0);
			const tracks = children.filter((c) => c.MediaType === 'Audio');
			await player.play(tracks, 0);
			if (options.shuffle) player.toggleShuffle();
			return;
		}
		case 'MusicArtist':
		case 'MusicGenre':
			return playMix(item);
		case 'Audio':
			return player.play([item], 0, options);
		default:
			if (isVideo(item)) return playVideo([item], 0, options);
	}
}

/** Queue tracks from a list (album, playlist, search results) starting at one of them. */
export async function playTracks(tracks: BaseItemDto[], index: number): Promise<void> {
	const first = tracks[index];
	if (first && isVideo(first)) {
		return first.Type === 'Episode' ? playItem(first) : playVideo(tracks.filter(isVideo), Math.max(0, tracks.filter(isVideo).indexOf(first)));
	}
	await player.play(tracks, index);
}

/** Server-generated mix based on an item (artist radio). */
export async function playMix(item: BaseItemDto): Promise<void> {
	const { data } = await getInstantMixApi(api()).getInstantMixFromItem({ itemId: item.Id!, userId: session.userId, limit: 100 });
	if (data.Items?.length) await player.play(data.Items, 0);
}

/** Play or shuffle a whole library (music: tracks; movies/shows: videos). */
export async function playLibrary(view: BaseItemDto, shuffle: boolean): Promise<void> {
	const { fetchLibraryPlayable } = await import('#lib/api/queries.ts');
	const items = await fetchLibraryPlayable(view, shuffle);
	if (!items.length) return;
	if (items[0].MediaType === 'Audio') await player.play(items, 0);
	else await playVideo(items, 0);
}
