<script lang="ts" module>
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

	export interface ArtistRef {
		Id?: string | null;
		Name?: string | null;
	}

	/** Every credited artist of a track (or album artist of an album), with ids where the server has them. */
	export function artistsOf(item: BaseItemDto): ArtistRef[] {
		const refs: ArtistRef[] =
			item.Type === 'MusicAlbum'
				? (item.AlbumArtists?.length ? item.AlbumArtists : item.ArtistItems) ?? []
				: (item.ArtistItems?.length ? item.ArtistItems : item.AlbumArtists) ?? [];
		if (refs.length) return refs.filter((r) => r.Name);
		const names = item.Artists?.length ? item.Artists : item.AlbumArtist ? [item.AlbumArtist] : [];
		return names.map((Name) => ({ Name }));
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';

	let { artists, class: cls = '' }: { artists: ArtistRef[]; class?: string } = $props();
</script>

<!-- One link per artist, comma-separated; artists the server has no item for stay plain text. -->
{#each artists as a, i (a.Id ?? a.Name ?? i)}{#if i > 0}<span>, </span>{/if}{#if a.Id}<a href={resolve('/item/[id]', { id: a.Id })} class={cls}>{a.Name}</a>{:else}<span class={cls.replace(/\S*hover:\S+/g, '')}>{a.Name}</span>{/if}{/each}
