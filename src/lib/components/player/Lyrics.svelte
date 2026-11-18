<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { getLyricApi } from '@jellyfin/sdk/lib/utils/api/lyric-api';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { api, session } from '#lib/api/session.svelte.ts';
	import { ticksToSeconds } from '#lib/api/format.ts';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import { player } from '#lib/player/player.svelte.ts';

	type Size = 'md' | 'sm' | 'tv';
	let { item, size = 'md', window: win }: { item: BaseItemDto; size?: Size; window?: [number, number] } = $props();

	const lyrics = createQuery(() => ({
		queryKey: ['lyrics', session.userId, item.Id],
		queryFn: async () => (await getLyricApi(api()).getLyrics({ itemId: item.Id! })).data,
		enabled: !!item.HasLyrics,
		staleTime: Infinity,
		retry: false
	}));

	const lines = $derived((lyrics.data?.Lyrics ?? []).map((l) => ({ text: l.Text?.trim() || '♪', start: l.Start != null ? ticksToSeconds(l.Start) : null })));
	// Timed if the lines carry real timestamps; servers don't always set Metadata.IsSynced.
	const synced = $derived(lines.filter((l) => l.start != null).length > 1 && lines.some((l) => (l.start ?? 0) > 0));
	const active = $derived.by(() => {
		if (!synced) return -1;
		let i = -1;
		for (let k = 0; k < lines.length; k++) if ((lines[k].start ?? Infinity) <= player.time + 0.25) i = k;
		return i;
	});
	// Show a window of lines around the active one when asked (TV), otherwise all with scrolling.
	const shown = $derived(
		win && synced ? lines.map((l, i) => ({ ...l, i })).slice(Math.max(0, active + win[0]), Math.max(0, active + win[1] + 1)) : lines.map((l, i) => ({ ...l, i }))
	);

	let box = $state<HTMLDivElement | null>(null);
	let boxHeight = $state(0);
	// Follow the current line until the listener scrolls on their own.
	let follow = $state(true);

	const READING_LINE = 0.3; // timed lyrics: the current line sits 30% down the panel

	/** Timed lyrics: bring the current line to the reading position. */
	function snap(smooth = true) {
		if (!box || !synced) return;
		const el = box.querySelector<HTMLElement>(`[data-line="${Math.max(0, active)}"]`);
		if (!el) return;
		box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight * READING_LINE), behavior: smooth ? 'smooth' : 'instant' });
	}
	$effect(() => {
		active;
		if (follow && synced && !win) snap();
	});

	// Untimed lyrics: no line is "current"; scroll slowly and continuously in step with the song.
	$effect(() => {
		if (synced || !follow || !box || !player.playing) return;
		const el = box;
		let frame = 0;
		let base = player.time;
		let at = performance.now();
		const tickFrame = (now: number) => {
			// Interpolate between the media element's ~4 Hz time updates for a smooth glide.
			if (Math.abs(player.time - base) > 0.01) {
				base = player.time;
				at = now;
			}
			const t = base + (now - at) / 1000;
			const ratio = player.duration ? Math.min(1, t / player.duration) : 0;
			el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
			frame = requestAnimationFrame(tickFrame);
		};
		frame = requestAnimationFrame(tickFrame);
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		item.Id;
		follow = true;
		box?.scrollTo({ top: 0, behavior: 'instant' });
	});
	const stopFollowing = () => (follow = false);

	// One size and weight for every line, so lines never reflow as the song moves; only colour and opacity mark the current one.
	const fs = { md: 'text-[32px]', sm: 'text-[24px]', tv: 'text-[56px]' } as const;
	function opacity(i: number): number {
		if (!synced) return 1; // untimed: just text, no fake "current" line
		if (active < 0) return Math.max(0.16, 0.5 - i * 0.1); // before the first line: preview what's coming
		const d = i - active;
		if (d === 0) return 1;
		if (d > 0) return Math.max(0.16, 0.42 - (d - 1) * 0.1); // upcoming: fade fast
		return Math.max(0.14, 0.3 - (-d - 1) * 0.06); // already sung
	}
</script>

{#if !item.HasLyrics}
	<p class="text-(--np-muted)">No lyrics for this track.</p>
{:else if lyrics.isPending}
	<p class="text-(--np-muted)">Loading lyrics…</p>
{:else if lyrics.isError || !lines.length}
	<p class="text-(--np-muted)">Lyrics couldn't be loaded.</p>
{:else}
	<div class="relative flex min-h-0 flex-1 flex-col">
	<!-- Scrollable regions must be keyboard-focusable (WCAG 2.1.1); keys/wheel only pause auto-follow. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={box}
		role="region"
		aria-label="Lyrics text"
		tabindex="0"
		onwheel={stopFollowing}
		ontouchmove={stopFollowing}
		onkeydown={(e) => ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) && stopFollowing()}
		bind:clientHeight={boxHeight}
		class="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [mask-image:linear-gradient(transparent,#000_8%,#000_92%,transparent)] [scrollbar-width:none] {win && synced ? 'justify-center overflow-hidden [mask-image:none]' : ''}">
		{#if synced && !win}<div aria-hidden="true" class="shrink-0" style="height: {Math.round(boxHeight * READING_LINE)}px"></div>{/if}
		{#each shown as l (l.i)}
			{@const isActive = l.i === active}
			{#if synced && l.start != null && size !== 'tv'}
				<button
					type="button"
					data-line={l.i}
					aria-current={isActive ? 'true' : undefined}
					onclick={() => player.seek(l.start!)}
					class="font-display block w-full cursor-pointer py-2 text-left leading-[1.12] tracking-[-0.02em] transition-[opacity,color] duration-300 {fs[size]} font-bold {isActive ? 'text-(--np-accent)' : 'text-(--np-text) hover:!opacity-100 focus-visible:!opacity-100'}"
					style="opacity: {opacity(l.i)}"
				>{l.text}</button>
			{:else}
				<p
					data-line={l.i}
					class="font-display py-2.5 leading-[1.12] tracking-[-0.02em] transition-opacity duration-300 {fs[size]} font-bold {isActive ? 'text-(--np-accent)' : 'text-(--np-text)'}"
					style="opacity: {opacity(l.i)}"
				>{l.text}</p>
			{/if}
		{/each}
		{#if synced && !win}<div aria-hidden="true" class="shrink-0" style="height: {Math.round(boxHeight * (1 - READING_LINE))}px"></div>{/if}
	</div>
	{#if !(win && synced)}
		<button
			type="button"
			aria-pressed={follow}
			onclick={() => {
				follow = true;
				snap();
				// untimed lyrics resume gliding from the song's position on their own
			}}
			class="absolute right-0 bottom-0 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-(--np-line) bg-(--np-bg)/80 px-4 text-sm font-semibold text-(--np-text) backdrop-blur transition-opacity aria-pressed:pointer-events-none aria-pressed:opacity-0"
		>
			<LocateFixed class="size-4" aria-hidden="true" />Auto-scroll
		</button>
	{/if}
	</div>
{/if}
