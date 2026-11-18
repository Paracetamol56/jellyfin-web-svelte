import BookOpen from '@lucide/svelte/icons/book-open';
import Camera from '@lucide/svelte/icons/camera';
import Clapperboard from '@lucide/svelte/icons/clapperboard';
import Folder from '@lucide/svelte/icons/folder';
import Library from '@lucide/svelte/icons/library';
import ListMusic from '@lucide/svelte/icons/list-music';
import Music from '@lucide/svelte/icons/music';
import Radio from '@lucide/svelte/icons/radio';
import Tv from '@lucide/svelte/icons/tv';
import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models';

export function viewIcon(type: CollectionType | null | undefined) {
	switch (type) {
		case 'movies':
			return Clapperboard;
		case 'tvshows':
			return Tv;
		case 'music':
			return Music;
		case 'playlists':
			return ListMusic;
		case 'boxsets':
			return Library;
		case 'livetv':
			return Radio;
		case 'homevideos':
		case 'photos':
			return Camera;
		case 'books':
			return BookOpen;
		default:
			return Folder;
	}
}

export function viewBlurb(type: CollectionType | null | undefined): string {
	switch (type) {
		case 'movies':
			return 'Films';
		case 'tvshows':
			return 'Series & anime';
		case 'music':
			return 'Albums & artists';
		case 'playlists':
			return 'Your mixes';
		case 'boxsets':
			return 'Collections';
		case 'livetv':
			return 'Channels & guide';
		case 'homevideos':
			return 'Home videos & photos';
		case 'books':
			return 'Books';
		default:
			return 'Library';
	}
}
