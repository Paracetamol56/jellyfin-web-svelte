// Deterministic fake library for the mocked Jellyfin API.
const T = 10_000_000; // ticks per second
const img = { Primary: 'p1' };

export const user = {
	Id: 'u1',
	Name: 'Alex',
	ServerId: 's1',
	HasPassword: true,
	Policy: { IsAdministrator: false },
	Configuration: {}
};

export const views = [
	{ Id: 'v-movies', Name: 'Movies', Type: 'CollectionFolder', CollectionType: 'movies', ImageTags: img },
	{ Id: 'v-shows', Name: 'Shows', Type: 'CollectionFolder', CollectionType: 'tvshows', ImageTags: img },
	{ Id: 'v-music', Name: 'Music', Type: 'CollectionFolder', CollectionType: 'music', ImageTags: img },
	{ Id: 'v-playlists', Name: 'Playlists', Type: 'CollectionFolder', CollectionType: 'playlists', ImageTags: img }
];

const stream = (container: string, extra: object[] = []) => ({
	Id: 'ms1',
	Name: 'Default',
	Container: container,
	Size: 3_270_000_000,
	Protocol: 'File',
	SupportsDirectPlay: true,
	SupportsDirectStream: true,
	DefaultAudioStreamIndex: 1,
	MediaStreams: [
		{ Index: 0, Type: 'Video', Codec: 'h264', Height: 1080, Width: 1920, VideoRange: 'SDR', VideoRangeType: 'SDR' },
		{ Index: 1, Type: 'Audio', Codec: 'aac', Language: 'jpn', DisplayTitle: 'Japanese · AAC 5.1 (default)' },
		{ Index: 2, Type: 'Audio', Codec: 'aac', Language: 'eng', DisplayTitle: 'English · AAC Stereo' },
		{ Index: 3, Type: 'Subtitle', Codec: 'subrip', Language: 'eng', DisplayTitle: 'English (SRT)' },
		...extra
	]
});

const movie = (id: string, name: string, year: number, mins: number, extra: object = {}) => ({
	Id: id,
	Name: name,
	Type: 'Movie',
	MediaType: 'Video',
	ProductionYear: year,
	RunTimeTicks: mins * 60 * T,
	Height: 1080,
	Width: 1920,
	ImageTags: img,
	BackdropImageTags: ['b1'],
	UserData: { Played: false, PlaybackPositionTicks: 0, IsFavorite: false },
	...extra
});

export const movies = [
	movie('m1', '5 Centimeters per Second', 2007, 63, {
		OriginalTitle: '秒速5センチメートル',
		OfficialRating: 'PG',
		CommunityRating: 7.3,
		Taglines: ['At what speed must I live to see you again?'],
		Overview: 'Three moments in Takaki’s life: his relationship with Akari and their forced separation; his friendship with Kanae; the disappointments of adulthood.',
		Tags: ['anime', 'coming of age', 'train'],
		Genres: ['Animation', 'Drama', 'Romance'],
		GenreItems: [{ Name: 'Animation', Id: 'g1' }, { Name: 'Drama', Id: 'g2' }, { Name: 'Romance', Id: 'g3' }],
		Studios: [{ Name: 'CoMix Wave Films', Id: 'st1' }],
		ExternalUrls: [{ Name: 'IMDb', Url: 'https://www.imdb.com/title/tt0983213/' }],
		People: [
			{ Id: 'p1', Name: 'Kenji Mizuhashi', Role: 'Takaki Tohno (voice)', Type: 'Actor' },
			{ Id: 'p2', Name: 'Yoshimi Kondou', Role: 'Akari (voice)', Type: 'Actor' },
			{ Id: 'p3', Name: 'Makoto Shinkai', Type: 'Director' }
		],
		Chapters: [0, 340, 776, 1148].map((s, i) => ({ Name: `Chapter ${i + 1}`, StartPositionTicks: s * T })),
		UserData: { Played: false, PlaybackPositionTicks: 41 * 60 * T, PlayedPercentage: 65, IsFavorite: false },
		MediaSources: [stream('mp4', [{ Index: 4, Type: 'Subtitle', Codec: 'subrip', Language: 'jpn', DisplayTitle: 'Japanese (SRT)' }])]
	}),
	movie('m2', 'Wolf Children', 2012, 117),
	movie('m3', 'A Scene at the Sea', 1991, 101, { ImageTags: {} }),
	movie('m4', 'Kikujiro', 1999, 121, { UserData: { Played: true, PlaybackPositionTicks: 0, IsFavorite: false } }),
	movie('m5', 'Blue Spring', 2001, 83)
];

export const series = {
	Id: 'sr1',
	Name: 'Cyberpunk: Edgerunners',
	Type: 'Series',
	ProductionYear: 2022,
	ChildCount: 1,
	ImageTags: img,
	BackdropImageTags: ['b1'],
	Overview: 'A street kid tries to survive in a technology and body modification-obsessed city of the future.',
	UserData: { Played: false, UnplayedItemCount: 2 }
};
export const seasons = [{ Id: 'se1', Name: 'Season 1', Type: 'Season', SeriesId: 'sr1', IndexNumber: 1, ImageTags: img, UserData: { Played: false } }];
export const episodes = [1, 2, 3].map((n) => ({
	Id: `e${n}`,
	Name: ['Let You Down', 'Like A Boy', 'Smooth Criminal'][n - 1],
	Type: 'Episode',
	MediaType: 'Video',
	SeriesId: 'sr1',
	SeriesName: 'Cyberpunk: Edgerunners',
	SeasonId: 'se1',
	ParentIndexNumber: 1,
	IndexNumber: n,
	RunTimeTicks: 24 * 60 * T,
	ImageTags: img,
	ParentBackdropItemId: 'sr1',
	ParentBackdropImageTags: ['b1'],
	UserData: { Played: n === 1, PlaybackPositionTicks: 0 },
	MediaSources: [stream('mkv')]
}));

export const album = {
	Id: 'al1',
	Name: 'Paramore',
	Type: 'MusicAlbum',
	AlbumArtist: 'Paramore',
	Artists: ['Paramore'],
	ProductionYear: 2013,
	ChildCount: 3,
	ImageTags: img,
	UserData: { IsFavorite: false }
};
export const tracks = ['Now', 'Grow Up', 'Daydreaming'].map((name, i) => ({
	Id: `t${i + 1}`,
	Name: name,
	Type: 'Audio',
	MediaType: 'Audio',
	AlbumId: 'al1',
	Album: 'Paramore',
	AlbumPrimaryImageTag: 'p1',
	AlbumArtist: 'Paramore',
	Artists: ['Paramore'],
	ArtistItems: [{ Id: 'ar1', Name: 'Paramore' }],
	IndexNumber: i + 1,
	ParentIndexNumber: 1,
	RunTimeTicks: 30 * T,
	HasLyrics: i !== 1,
	UserData: { IsFavorite: false }
}));

// Timed lyrics without Metadata.IsSynced, as real servers return them.
export const longAlbum = {
	Id: 'al2',
	Name: 'Singles',
	Type: 'MusicAlbum',
	AlbumArtist: 'Various',
	Artists: ['Various'],
	ChildCount: 1,
	ImageTags: img,
	UserData: { IsFavorite: false }
};
export const longTrack = {
	Id: 't9',
	Name: 'A Very Long Track Title That Goes On And On And Definitely Does Not Fit Next To The Like Button',
	Type: 'Audio',
	MediaType: 'Audio',
	AlbumId: 'al2',
	Album: 'Singles',
	AlbumPrimaryImageTag: 'p1',
	AlbumArtist: 'Various',
	Artists: ['Various'],
	ArtistItems: [{ Id: 'ar1', Name: 'Various' }],
	IndexNumber: 1,
	ParentIndexNumber: 1,
	RunTimeTicks: 30 * T,
	HasLyrics: false,
	UserData: { IsFavorite: false }
};

export const playlist = {
	Id: 'pl1',
	Name: 'Road trip',
	Type: 'Playlist',
	MediaType: 'Audio',
	ChildCount: 3,
	RunTimeTicks: 95 * T,
	DateCreated: '2026-11-12T00:18:33.0000000Z',
	Genres: ['rock', 'indie'],
	ImageTags: img,
	UserData: { IsFavorite: false }
};

export const lyrics = {
	Metadata: {},
	Lyrics: ['First line', 'Second line', 'Third line', 'Fourth line'].map((Text, i) => ({ Text, Start: i * 2 * T }))
};
export const plainLyrics = {
	Metadata: {},
	Lyrics: ['Plain one', 'Plain two', 'Plain three'].map((Text) => ({ Text }))
};

// A track credited to two artists, for one-link-per-artist.
export const duetAlbum = {
	Id: 'al3',
	Name: 'Duets',
	Type: 'MusicAlbum',
	AlbumArtist: 'Ada Lark',
	Artists: ['Ada Lark', 'Ben Moss'],
	ChildCount: 1,
	ImageTags: img,
	UserData: { IsFavorite: false }
};
export const duetTracks = [
	{
		Id: 'd1',
		Name: 'Two Voices',
		Type: 'Audio',
		MediaType: 'Audio',
		AlbumId: 'al3',
		Album: 'Duets',
		AlbumPrimaryImageTag: 'p1',
		AlbumArtist: 'Ada Lark',
		Artists: ['Ada Lark', 'Ben Moss'],
		ArtistItems: [
			{ Id: 'ar2', Name: 'Ada Lark' },
			{ Id: 'ar3', Name: 'Ben Moss' }
		],
		IndexNumber: 1,
		ParentIndexNumber: 1,
		RunTimeTicks: 30 * T,
		HasLyrics: false,
		UserData: { IsFavorite: false }
	}
];

export const all: Record<string, object> = Object.fromEntries(
	[...views, ...movies, series, ...seasons, ...episodes, album, longAlbum, longTrack, playlist, ...tracks, duetAlbum, ...duetTracks].map((i) => [(i as { Id: string }).Id, i])
);
