import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import { session } from './session.svelte';

type Kind = 'Primary' | 'Backdrop' | 'Logo' | 'Thumb';

function url(itemId: string, type: Kind, tag: string, width: number, index = 0): string {
	const p = new URLSearchParams({ tag, maxWidth: String(width), quality: '90' });
	const path = type === 'Backdrop' ? `Backdrop/${index}` : type;
	return `${session.serverUrl}/Items/${itemId}/Images/${path}?${p}`;
}

/** Poster/cover art, falling back to the album or series art. */
export function primaryImage(item: BaseItemDto, width = 400): string | null {
	if (item.Id && item.ImageTags?.Primary) return url(item.Id, 'Primary', item.ImageTags.Primary, width);
	if (item.AlbumId && item.AlbumPrimaryImageTag) return url(item.AlbumId, 'Primary', item.AlbumPrimaryImageTag, width);
	if (item.SeriesId && item.SeriesPrimaryImageTag) return url(item.SeriesId, 'Primary', item.SeriesPrimaryImageTag, width);
	return null;
}

/** Wide art for heroes and episode cards: backdrop, then thumb, then the parent's backdrop. */
export function backdropImage(item: BaseItemDto, width = 1600): string | null {
	if (item.Id && item.BackdropImageTags?.length) return url(item.Id, 'Backdrop', item.BackdropImageTags[0], width);
	if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length)
		return url(item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], width);
	if (item.Id && item.ImageTags?.Thumb) return url(item.Id, 'Thumb', item.ImageTags.Thumb, width);
	if (item.ParentThumbItemId && item.ParentThumbImageTag) return url(item.ParentThumbItemId, 'Thumb', item.ParentThumbImageTag, width);
	return null;
}

export function logoImage(item: BaseItemDto, width = 600): string | null {
	if (item.Id && item.ImageTags?.Logo) return url(item.Id, 'Logo', item.ImageTags.Logo, width);
	if (item.ParentLogoItemId && item.ParentLogoImageTag) return url(item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, width);
	return null;
}

export function userImage(userId: string, tag: string | null | undefined, size = 96): string | null {
	if (!tag) return null;
	return `${session.serverUrl}/Users/${userId}/Images/Primary?tag=${tag}&maxWidth=${size}&quality=90`;
}

export function personImage(personId: string | null | undefined, tag: string | null | undefined, width = 120): string | null {
	if (!personId || !tag) return null;
	return url(personId, 'Primary', tag, width);
}

export function chapterImage(itemId: string, index: number, tag: string | null | undefined, width = 400): string | null {
	if (!tag) return null;
	return `${session.serverUrl}/Items/${itemId}/Images/Chapter/${index}?tag=${tag}&maxWidth=${width}&quality=85`;
}
