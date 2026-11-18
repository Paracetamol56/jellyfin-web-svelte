import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import { getUserViewApi } from '@jellyfin/sdk/lib/utils/api/user-view-api';
import {
	BaseItemKind,
	ItemFields,
	ItemFilter,
	ItemSortBy,
	SortOrder,
	type BaseItemDto,
	type CollectionType
} from '@jellyfin/sdk/lib/generated-client/models';
import { api, session } from './session.svelte';

/** Fields every card needs; keeps payloads small. */
export const CARD_FIELDS = [
	ItemFields.PrimaryImageAspectRatio,
	ItemFields.Height,
	ItemFields.Width,
	ItemFields.Overview,
	ItemFields.Genres,
	ItemFields.ChildCount
];

export const keys = {
	views: () => ['views', session.userId] as const,
	latest: (parentId: string) => ['latest', session.userId, parentId] as const,
	resume: () => ['resume', session.userId] as const,
	nextUp: () => ['nextUp', session.userId] as const,
	library: (parentId: string, sort: string) => ['library', session.userId, parentId, sort] as const,
	item: (id: string) => ['item', session.userId, id] as const
};

export async function fetchViews(): Promise<BaseItemDto[]> {
	const { data } = await getUserViewApi(api()).getUserViews({ userId: session.userId });
	return data.Items ?? [];
}

export async function fetchLatest(parentId: string, limit = 16): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getLatestMedia({
		userId: session.userId,
		parentId,
		limit,
		fields: CARD_FIELDS,
		enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
		imageTypeLimit: 1
	});
	return data;
}

export async function fetchResume(limit = 8): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getResumeItems({
		userId: session.userId,
		limit,
		mediaTypes: ['Video'],
		fields: CARD_FIELDS,
		enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
		imageTypeLimit: 1
	});
	return data.Items ?? [];
}

export async function fetchNextUp(limit = 6): Promise<BaseItemDto[]> {
	const { data } = await getShowApi(api()).getNextUp({
		userId: session.userId,
		limit,
		fields: CARD_FIELDS,
		enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
		imageTypeLimit: 1,
		enableResumable: false
	});
	return data.Items ?? [];
}

/** Which item kinds a library view lists at its top level. */
export function kindsFor(type: CollectionType | null | undefined): BaseItemKind[] | undefined {
	switch (type) {
		case 'movies':
			return [BaseItemKind.Movie];
		case 'tvshows':
			return [BaseItemKind.Series];
		case 'music':
			return [BaseItemKind.MusicAlbum];
		case 'playlists':
			return [BaseItemKind.Playlist];
		case 'boxsets':
			return [BaseItemKind.BoxSet];
		case 'books':
			return [BaseItemKind.Book];
		default:
			return undefined;
	}
}

type Sort = { label: string; by: ItemSortBy[]; order: SortOrder; for: ('movies' | 'tvshows' | 'music' | 'other')[] };
const ALL: Sort['for'] = ['movies', 'tvshows', 'music', 'other'];
const VIDEO: Sort['for'] = ['movies', 'tvshows'];

export const SORTS = {
	name: { label: 'Name', by: [ItemSortBy.SortName], order: SortOrder.Ascending, for: ALL },
	added: { label: 'Date added', by: [ItemSortBy.DateCreated, ItemSortBy.SortName], order: SortOrder.Descending, for: ALL },
	released: { label: 'Release date', by: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName], order: SortOrder.Descending, for: ALL },
	artist: { label: 'Album artist', by: [ItemSortBy.AlbumArtist, ItemSortBy.SortName], order: SortOrder.Ascending, for: ['music'] },
	rating: { label: 'Community rating', by: [ItemSortBy.CommunityRating, ItemSortBy.SortName], order: SortOrder.Descending, for: [...VIDEO, 'music'] },
	critic: { label: 'Critic rating', by: [ItemSortBy.CriticRating, ItemSortBy.SortName], order: SortOrder.Descending, for: VIDEO },
	runtime: { label: 'Runtime', by: [ItemSortBy.Runtime, ItemSortBy.SortName], order: SortOrder.Descending, for: ['movies', 'music'] },
	official: { label: 'Parental rating', by: [ItemSortBy.OfficialRating, ItemSortBy.SortName], order: SortOrder.Ascending, for: VIDEO },
	plays: { label: 'Play count', by: [ItemSortBy.PlayCount, ItemSortBy.SortName], order: SortOrder.Descending, for: ALL },
	lastPlayed: { label: 'Last played', by: [ItemSortBy.DatePlayed, ItemSortBy.SortName], order: SortOrder.Descending, for: ALL },
	random: { label: 'Random', by: [ItemSortBy.Random], order: SortOrder.Ascending, for: ALL }
} satisfies Record<string, Sort>;
export type SortKey = keyof typeof SORTS;

function family(type: CollectionType | null | undefined): Sort['for'][number] {
	return type === 'movies' || type === 'tvshows' || type === 'music' ? type : 'other';
}

export function sortsFor(type: CollectionType | null | undefined): [SortKey, string][] {
	const f = family(type);
	return (Object.entries(SORTS) as [SortKey, Sort][]).filter(([, s]) => s.for.includes(f)).map(([k, s]) => [k, s.label]);
}

/** Library filters, all optional; kept in the URL. */
export interface LibraryFilters {
	show?: 'unplayed' | 'played' | 'resumable' | 'favorite';
	genres?: string[];
	decade?: number;
	quality?: '4k' | 'hd' | 'sd';
	subs?: boolean;
	status?: 'Continuing' | 'Ended';
	score?: number;
}

/** Which filters make sense for a library tab. */
export function filtersFor(type: CollectionType | null | undefined, tab: string): (keyof LibraryFilters)[] {
	if (tab === 'artists' || tab === 'songs') return ['show', 'genres'];
	switch (type) {
		case 'movies':
			return ['show', 'genres', 'decade', 'quality', 'subs', 'score'];
		case 'tvshows':
			return ['show', 'genres', 'decade', 'status', 'score'];
		case 'music':
			return ['show', 'genres', 'decade'];
		default:
			return ['show'];
	}
}

function filterParams(f: LibraryFilters) {
	return {
		isPlayed: f.show === 'played' ? true : f.show === 'unplayed' ? false : undefined,
		isFavorite: f.show === 'favorite' ? true : undefined,
		filters: f.show === 'resumable' ? [ItemFilter.IsResumable] : undefined,
		genres: f.genres?.length ? f.genres : undefined,
		years: f.decade ? Array.from({ length: 10 }, (_, i) => f.decade! + i) : undefined,
		is4K: f.quality === '4k' ? true : undefined,
		isHd: f.quality === 'hd' ? true : f.quality === 'sd' ? false : undefined,
		hasSubtitles: f.subs ? true : undefined,
		seriesStatus: f.status ? [f.status] : undefined,
		minCommunityRating: f.score
	};
}

export async function fetchGenres(view: BaseItemDto): Promise<BaseItemDto[]> {
	const { getGenreApi } = await import('@jellyfin/sdk/lib/utils/api/genre-api');
	const { data } = await getGenreApi(api()).getGenres({ userId: session.userId, parentId: view.Id ?? undefined });
	return data.Items ?? [];
}

export async function fetchItem(id: string): Promise<BaseItemDto> {
	const { data } = await getLibraryApi(api()).getItem({ itemId: id, userId: session.userId });
	return data;
}

export async function fetchSimilar(id: string): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getSimilarItems({ itemId: id, userId: session.userId, limit: 12, fields: CARD_FIELDS });
	return data.Items ?? [];
}

export async function fetchSeasons(seriesId: string): Promise<BaseItemDto[]> {
	const { data } = await getShowApi(api()).getSeasons({ seriesId, userId: session.userId, fields: CARD_FIELDS });
	return data.Items ?? [];
}

export async function fetchEpisodes(seriesId: string, seasonId: string): Promise<BaseItemDto[]> {
	const { data } = await getShowApi(api()).getEpisodes({
		seriesId,
		seasonId,
		userId: session.userId,
		fields: [...CARD_FIELDS, ItemFields.MediaSources]
	});
	return data.Items ?? [];
}

export async function fetchSeriesNextUp(seriesId: string): Promise<BaseItemDto | null> {
	const { data } = await getShowApi(api()).getNextUp({ userId: session.userId, seriesId, limit: 1, enableResumable: true });
	return data.Items?.[0] ?? null;
}

/** Children of a container in display order: album tracks, playlist entries, collection items. */
export async function fetchChildren(parent: BaseItemDto): Promise<BaseItemDto[]> {
	const isAlbum = parent.Type === 'MusicAlbum';
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		parentId: parent.Id ?? undefined,
		sortBy: isAlbum ? [ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber, ItemSortBy.SortName] : undefined,
		fields: CARD_FIELDS,
		limit: 500
	});
	return data.Items ?? [];
}

/** A person's filmography. */
export async function fetchByPerson(personId: string): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		personIds: [personId],
		recursive: true,
		includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series],
		sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear],
		sortOrder: [SortOrder.Descending],
		fields: CARD_FIELDS,
		limit: 100
	});
	return data.Items ?? [];
}

/** All albums by an artist. */
export async function fetchArtistAlbums(artistId: string): Promise<BaseItemDto[]> {
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		albumArtistIds: [artistId],
		recursive: true,
		includeItemTypes: [BaseItemKind.MusicAlbum],
		sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
		sortOrder: [SortOrder.Descending],
		fields: CARD_FIELDS,
		limit: 200
	});
	return data.Items ?? [];
}

export type SearchFilter = { q?: string; tag?: string; genre?: string; studio?: string; year?: number };

/** Library-wide search, grouped by kind. Free text searches names; tag/genre/studio filter exactly. */
export async function searchLibrary(f: SearchFilter): Promise<{ kind: string; items: BaseItemDto[] }[]> {
	const { getArtistApi } = await import('@jellyfin/sdk/lib/utils/api/artist-api');
	const { getPersonApi } = await import('@jellyfin/sdk/lib/utils/api/person-api');
	const base = {
		userId: session.userId,
		recursive: true,
		fields: CARD_FIELDS,
		enableImageTypes: ['Primary', 'Backdrop', 'Thumb'] as ('Primary' | 'Backdrop' | 'Thumb')[],
		imageTypeLimit: 1,
		limit: 48,
		searchTerm: f.q || undefined,
		tags: f.tag ? [f.tag] : undefined,
		genres: f.genre ? [f.genre] : undefined,
		studios: f.studio ? [f.studio] : undefined,
		years: f.year ? [f.year] : undefined
	};
	const lib = getLibraryApi(api());
	const kinds: [string, BaseItemKind[]][] = [
		['Movies', [BaseItemKind.Movie]],
		['Shows', [BaseItemKind.Series]],
		['Episodes', [BaseItemKind.Episode]],
		['Albums', [BaseItemKind.MusicAlbum]],
		['Songs', [BaseItemKind.Audio]],
		['Playlists & collections', [BaseItemKind.Playlist, BaseItemKind.BoxSet]]
	];
	const results = await Promise.all([
		...kinds.map(async ([kind, types]) => ({
			kind,
			items: (await lib.getItems({ ...base, includeItemTypes: types, limit: types[0] === 'Audio' ? 20 : 48 })).data.Items ?? []
		})),
		f.q
			? getArtistApi(api())
					.getAlbumArtists({ userId: session.userId, searchTerm: f.q, limit: 24, fields: CARD_FIELDS })
					.then((r) => ({ kind: 'Artists', items: r.data.Items ?? [] }))
			: Promise.resolve({ kind: 'Artists', items: [] }),
		f.q
			? getPersonApi(api())
					.getPersons({ userId: session.userId, searchTerm: f.q, limit: 24 })
					.then((r) => ({ kind: 'People', items: r.data.Items ?? [] }))
			: Promise.resolve({ kind: 'People', items: [] })
	]);
	return results.filter((r) => r.items.length);
}

export type LibraryTab = 'items' | 'artists' | 'songs' | 'genres';

export function tabsFor(type: CollectionType | null | undefined): [LibraryTab, string][] {
	switch (type) {
		case 'music':
			return [['items', 'Albums'], ['artists', 'Album artists'], ['songs', 'Songs'], ['genres', 'Genres']];
		case 'movies':
			return [['items', 'Movies'], ['genres', 'Genres']];
		case 'tvshows':
			return [['items', 'Shows'], ['genres', 'Genres']];
		default:
			return [['items', 'All']];
	}
}

export const LIBRARY_PAGE = 100;

/** One page of a library tab, optionally limited to names starting with a letter ('#' = digits/symbols). */
export async function fetchLibraryTab(
	view: BaseItemDto,
	tab: LibraryTab,
	o: { sort: SortKey; order: 'asc' | 'desc' | null; page: number; letter: string | null; filters: LibraryFilters }
): Promise<{ items: BaseItemDto[]; total: number }> {
	const startIndex = o.page * LIBRARY_PAGE;
	const letters = o.letter === '#' ? { nameLessThan: 'A' } : o.letter ? { nameStartsWith: o.letter } : {};
	const s = SORTS[o.sort];
	const order = o.order ? (o.order === 'asc' ? SortOrder.Ascending : SortOrder.Descending) : s.order;
	const fp = filterParams(o.filters);
	if (tab === 'genres') {
		const items = await fetchGenres(view);
		return { items, total: items.length };
	}
	if (tab === 'artists') {
		const { getArtistApi } = await import('@jellyfin/sdk/lib/utils/api/artist-api');
		const { data } = await getArtistApi(api()).getAlbumArtists({
			userId: session.userId,
			parentId: view.Id ?? undefined,
			startIndex,
			limit: LIBRARY_PAGE,
			sortBy: [ItemSortBy.SortName],
			sortOrder: o.order === 'desc' ? [SortOrder.Descending] : undefined,
			fields: CARD_FIELDS,
			enableTotalRecordCount: true,
			isFavorite: fp.isFavorite,
			genres: fp.genres,
			...letters
		});
		return { items: data.Items ?? [], total: data.TotalRecordCount ?? 0 };
	}
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		parentId: view.Id ?? undefined,
		includeItemTypes: tab === 'songs' ? [BaseItemKind.Audio] : kindsFor(view.CollectionType),
		recursive: tab === 'songs' || !!kindsFor(view.CollectionType),
		sortBy: tab === 'songs' && o.sort === 'name' ? [ItemSortBy.Album, ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber] : [...s.by],
		sortOrder: [order],
		...fp,
		startIndex,
		limit: LIBRARY_PAGE,
		fields: CARD_FIELDS,
		enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
		imageTypeLimit: 1,
		enableTotalRecordCount: true,
		...letters
	});
	return { items: data.Items ?? [], total: data.TotalRecordCount ?? 0 };
}

/** Items to play for "Play all" / "Shuffle" on a whole library. */
export async function fetchLibraryPlayable(view: BaseItemDto, shuffle: boolean): Promise<BaseItemDto[]> {
	const music = view.CollectionType === 'music';
	const kinds = music ? [BaseItemKind.Audio] : view.CollectionType === 'tvshows' ? [BaseItemKind.Episode] : [BaseItemKind.Movie];
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		parentId: view.Id ?? undefined,
		includeItemTypes: kinds,
		recursive: true,
		sortBy: shuffle ? [ItemSortBy.Random] : music ? [ItemSortBy.AlbumArtist, ItemSortBy.Album, ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber] : [ItemSortBy.SortName],
		limit: music ? 300 : 100,
		fields: CARD_FIELDS
	});
	return data.Items ?? [];
}

/** One random item from a library, honouring the active filters and A–Z letter. */
export async function fetchRandomItem(view: BaseItemDto, filters: LibraryFilters, letter: string | null): Promise<BaseItemDto | null> {
	const kinds = kindsFor(view.CollectionType);
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		parentId: view.Id ?? undefined,
		includeItemTypes: kinds,
		recursive: !!kinds,
		sortBy: [ItemSortBy.Random],
		limit: 1,
		...(letter === '#' ? { nameLessThan: 'A' } : letter ? { nameStartsWith: letter } : {}),
		...filterParams(filters)
	});
	return data.Items?.[0] ?? null;
}

/** Cover art for a library tile. `Items/Latest` returns nothing for playlists, so those are listed instead. */
export async function fetchTileArt(view: BaseItemDto): Promise<BaseItemDto[]> {
	if (view.CollectionType !== 'playlists' && view.CollectionType !== 'boxsets') return fetchLatest(view.Id!, 8);
	const { data } = await getLibraryApi(api()).getItems({
		userId: session.userId,
		parentId: view.Id ?? undefined,
		sortBy: [ItemSortBy.DateCreated],
		sortOrder: [SortOrder.Descending],
		limit: 8,
		enableImageTypes: ['Primary'],
		imageTypeLimit: 1
	});
	return data.Items ?? [];
}
