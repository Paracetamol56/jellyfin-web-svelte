<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { Snippet } from 'svelte';
	import { fetchViews, keys } from '#lib/api/queries.ts';
	import { page } from '$app/state';
	import { player } from '#lib/player/player.svelte.ts';
	import MiniPlayer from './player/MiniPlayer.svelte';
	import AppHeader from './AppHeader.svelte';
	import BottomNav from './BottomNav.svelte';

	let { children }: { children: Snippet } = $props();

	player.restore();
	const immersive = $derived(page.route.id === '/now-playing' || page.route.id === '/play/[id]');
	const views = createQuery(() => ({ queryKey: keys.views(), queryFn: fetchViews }));
	// Nav lists the media libraries; folders and channels stay on Home.
	const navViews = $derived(
		(views.data ?? []).filter((v) => ['movies', 'tvshows', 'music', 'playlists', 'boxsets', 'homevideos', 'books', 'livetv'].includes(v.CollectionType ?? ''))
	);
</script>

<a href="#main" class="bg-primary text-primary-foreground sr-only z-50 rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

{#if immersive}
	<!-- Players take the whole screen; the audio element lives on outside the DOM tree. -->
	<div id="main">{@render children()}</div>
{:else}
	<div class="flex min-h-dvh flex-col">
		<AppHeader views={navViews} />
		<div id="main" class="flex-1">
			{@render children()}
		</div>
		<div class="sticky bottom-0 z-20">
			{#if player.current && player.kind === 'audio'}<MiniPlayer />{/if}
			<BottomNav views={navViews} />
		</div>
	</div>
{/if}
