<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { resolve } from '$app/paths';
	import { primaryImage } from '#lib/api/images.ts';
	import { clock } from '#lib/api/format.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import { toggleFavorite } from '#lib/player/favorite.ts';
	import { paletteFor, paletteVars } from '#lib/palette.svelte.ts';
	import Equalizer from './Equalizer.svelte';

	const item = $derived(player.current!);
	const art = $derived(primaryImage(item, 120));
	const palette = $derived(paletteFor(art));
	const vars = $derived(paletteVars(palette.value));
	const artist = $derived((item.Artists ?? []).join(', ') || item.AlbumArtist || '');
	const href = resolve('/now-playing');
	const btn = 'pointer-events-auto grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-(--np-text) hover:bg-white/10 disabled:opacity-40';
	const playBtn = 'pointer-events-auto grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-(--np-accent) text-(--np-ink)';
</script>

<!-- Desktop: full-width bar -->
<div role="region" aria-label="Now playing" style={vars} class="relative z-10 border-t border-white/15 bg-[linear-gradient(90deg,var(--np-tint)_0%,var(--np-bg)_45%,#0E0C10_100%)] text-(--np-text) shadow-[0_-16px_50px_#000000B3] transition-[background] duration-700 max-md:hidden">
	<a {href} aria-label="Open player: {item.Name}, {artist}" class="absolute inset-0 z-0"></a>
	<div aria-hidden="true" class="absolute inset-x-0 -top-0.5 z-[1] h-1 bg-white/15">
		<span class="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--np-glow1),var(--np-accent))] shadow-[0_0_16px_var(--np-accent)]" style="width: {player.progress}%"></span>
		<span class="absolute -top-1 -ml-1.5 size-3 rounded-full bg-(--np-accent) shadow-[0_0_14px_var(--np-accent)]" style="left: {player.progress}%"></span>
	</div>
	<div class="pointer-events-none relative z-[1] flex flex-wrap items-center gap-x-7 gap-y-3 px-10 py-3">
		<div class="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
			<span class="size-14 shrink-0 overflow-hidden rounded-xl bg-black/40 shadow-[0_0_0_1px_#FFFFFF26,0_8px_24px_-6px_var(--np-glow1)]">
				{#if art}<img src={art} alt="" class="size-full object-cover" />{/if}
			</span>
			<span class="flex min-w-0 flex-col">
				<span class="font-display truncate text-[17px] font-bold tracking-[-0.01em]">{item.Name}</span>
				<span class="truncate text-[13px] text-(--np-muted)">{[artist, item.Album].filter(Boolean).join(' · ')}</span>
			</span>
		</div>
		<div class="flex flex-none items-center gap-1.5">
			<button type="button" class={btn} aria-label="Previous track" onclick={() => player.previous()}><SkipBack class="size-5 fill-current" /></button>
			<button type="button" class="{playBtn} shadow-[0_8px_24px_-6px_var(--np-accent)]" aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
				{#if player.buffering && !player.playing}<LoaderCircle class="size-5 animate-spin" />{:else if player.playing}<Pause class="size-5 fill-current" />{:else}<Play class="size-5 fill-current" />{/if}
			</button>
			<button type="button" class={btn} aria-label="Next track" disabled={player.index >= player.queue.length - 1 && player.repeat !== 'all'} onclick={() => player.next()}><SkipForward class="size-5 fill-current" /></button>
		</div>
		<div class="flex flex-[1_1_260px] items-center justify-end gap-1.5">
			<span class="mr-2 text-[13px] text-(--np-muted) tabular-nums">{clock(player.time)} / {clock(player.duration)}</span>
			<button type="button" class={btn} aria-label={item.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!item.UserData?.IsFavorite} onclick={() => toggleFavorite(item)}>
				<Heart class="size-5 {item.UserData?.IsFavorite ? 'fill-(--np-accent) text-(--np-accent)' : ''}" />
			</button>
			<a {href} class={btn} aria-label="Open queue"><ListMusic class="size-5" /></a>
			<span class="grid size-11 place-items-center text-(--np-accent)"><Equalizer playing={player.playing} /></span>
		</div>
	</div>
	{#if player.error}<p role="alert" class="relative z-[1] px-10 pb-2 text-sm text-(--np-accent)">{player.error}</p>{/if}
</div>

<!-- Mobile: floating card above the tab bar -->
<div role="region" aria-label="Now playing" style={vars} class="relative mx-2.5 mb-2 overflow-hidden rounded-[20px] border border-white/15 bg-[linear-gradient(90deg,var(--np-tint)_0%,var(--np-bg)_55%,#14111A_100%)] text-(--np-text) shadow-[0_14px_40px_-8px_#000000CC,0_0_40px_-12px_var(--np-glow1)] md:hidden">
	<a {href} aria-label="Open player: {item.Name}, {artist}" class="absolute inset-0 z-0"></a>
	<div class="pointer-events-none relative z-[1] flex items-center gap-3 py-2 pr-1.5 pb-[11px] pl-2">
		<span class="size-12 shrink-0 overflow-hidden rounded-xl bg-black/40 shadow-[0_0_0_1px_#FFFFFF26]">
			{#if art}<img src={art} alt="" class="size-full object-cover" />{/if}
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-[15px] font-bold">{item.Name}</span>
			<span class="block truncate text-[13px] text-(--np-muted)">{artist}</span>
		</span>
		<button type="button" class={playBtn} aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
			{#if player.playing}<Pause class="size-5 fill-current" />{:else}<Play class="size-5 fill-current" />{/if}
		</button>
		<button type="button" class={btn} aria-label="Next track" onclick={() => player.next()}><SkipForward class="size-5 fill-current" /></button>
	</div>
	<div aria-hidden="true" class="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
		<span class="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--np-glow1),var(--np-accent))] shadow-[0_0_10px_var(--np-accent)]" style="width: {player.progress}%"></span>
	</div>
</div>
