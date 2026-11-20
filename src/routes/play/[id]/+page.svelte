<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Captions from '@lucide/svelte/icons/captions';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import { DropdownMenu } from 'bits-ui';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { episodeCode } from '#lib/api/format.ts';
	import { fetchItem } from '#lib/api/queries.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import SeekBar from '#lib/components/player/SeekBar.svelte';
	import SubtitleSettings from '#lib/components/player/SubtitleSettings.svelte';
	import { subtitleStyle } from '#lib/player/subtitle-style.svelte.ts';
	import VolumeBar from '#lib/components/player/VolumeBar.svelte';

	const id = $derived(page.params.id!);
	let video = $state<HTMLVideoElement | null>(null);
	let shell = $state<HTMLDivElement | null>(null);
	let idle = $state(false);
	let subSettingsOpen = $state(false);
	let fullscreen = $state(false);
	let idleTimer: ReturnType<typeof setTimeout>;

	const item = $derived(player.current);
	const title = $derived(item?.Type === 'Episode' ? (item.SeriesName ?? '') : (item?.Name ?? ''));
	const subtitle = $derived(item?.Type === 'Episode' ? `${episodeCode(item)} · ${item.Name}` : (item?.ProductionYear?.toString() ?? ''));
	const streams = $derived(player.source?.MediaStreams ?? []);
	const audioTracks = $derived(streams.filter((s) => s.Type === 'Audio'));
	const subTracks = $derived(streams.filter((s) => s.Type === 'Subtitle'));
	const hasNext = $derived(player.index < player.queue.length - 1);
	const nextItem = $derived(hasNext ? player.queue[player.index + 1] : null);
	// Offer "next episode" for the last stretch of an episode.
	const showUpNext = $derived(!!nextItem && player.duration > 0 && player.duration - player.time < 40);

	onMount(() => {
		(async () => {
			// Deep link or reload: nothing queued for this id yet.
			if (player.current?.Id !== id) {
				const it = await fetchItem(id).catch(() => null);
				if (!it) return goto(resolve('/'), { replace: true });
				await player.play([it], 0);
			}
			if (video) player.attachVideo(video);
		})();
		const onFs = () => (fullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onFs);
		poke();
		return () => {
			document.removeEventListener('fullscreenchange', onFs);
			clearTimeout(idleTimer);
			if (video) player.detachVideo(video);
		};
	});

	// Keep the URL in step when the queue moves to the next episode.
	$effect(() => {
		const cur = player.current?.Id;
		if (cur && cur !== id && player.kind === 'video') goto(resolve('/play/[id]', { id: cur }), { replace: true });
	});

	function poke() {
		idle = false;
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => (idle = player.playing), 3000);
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else shell?.requestFullscreen().catch(() => {});
	}

	function close() {
		if (video) player.detachVideo(video);
		if (history.length > 1) history.back();
		else goto(resolve('/'));
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement).closest('input, select, [role="menu"], [role="dialog"]')) return;
		poke();
		switch (e.key) {
			case ' ':
			case 'k':
				e.preventDefault();
				player.toggle();
				break;
			case 'ArrowLeft':
			case 'j':
				player.skip(-10);
				break;
			case 'ArrowRight':
			case 'l':
				player.skip(30);
				break;
			case 'f':
				toggleFullscreen();
				break;
			case 'm':
				player.toggleMute();
				break;
			case 'Escape':
				if (!document.fullscreenElement) close();
				break;
		}
	}

	const ctl = 'grid size-12 shrink-0 cursor-pointer place-items-center rounded-full text-white hover:bg-white/15';
	const menuItem = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-highlighted:bg-white/10 aria-checked:font-semibold aria-checked:text-[#33B7E6]';
</script>

<svelte:head><title>{item?.Name ?? 'Playing'} · Jellyfin</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div
	bind:this={shell}
	role="application"
	aria-label="Video player"
	class="fixed inset-0 z-50 bg-black text-white {idle ? 'cursor-none' : ''}"
	style="--seek-accent:#33B7E6;--seek-line:#FFFFFF40;--seek-ring:#0B0B10;--seek-muted:#D0CEDA"
	onpointermove={poke}
	onpointerdown={poke}
>
	<!-- svelte-ignore a11y_media_has_caption (tracks are added by the player from the server) -->
	<video bind:this={video} class="size-full object-contain" style={subtitleStyle.vars} playsinline onclick={() => player.toggle()} ondblclick={toggleFullscreen}></video>

	<SubtitleSettings bind:open={subSettingsOpen} />

	{#if player.buffering && !player.error}
		<div class="pointer-events-none absolute inset-0 grid place-items-center" aria-live="polite">
			<LoaderCircle class="size-14 animate-spin text-white/80" aria-label="Loading" />
		</div>
	{/if}
	{#if player.error}
		<div class="absolute inset-0 grid place-items-center p-6" role="alert">
			<div class="max-w-md rounded-3xl bg-[#1A1A21] p-8 text-center">
				<h2 class="text-2xl font-bold">Can't play this</h2>
				<p class="mt-2 text-[#A6A4B0]">{player.error}</p>
				<button type="button" class="mt-6 h-11 cursor-pointer rounded-full bg-[#33B7E6] px-6 font-bold text-[#0B0B10]" onclick={close}>Go back</button>
			</div>
		</div>
	{/if}

	<div class="transition-opacity duration-300 {idle ? 'pointer-events-none opacity-0' : 'opacity-100'}">
		<div class="absolute inset-x-0 top-0 flex items-center gap-4 bg-[linear-gradient(#000000B3,transparent)] px-4 pt-4 pb-16 md:px-8">
			<button type="button" class={ctl} aria-label="Close player" onclick={close}><ArrowLeft class="size-6" /></button>
			<div class="min-w-0">
				<h1 class="truncate text-xl font-bold md:text-2xl">{title}</h1>
				{#if subtitle}<p class="truncate text-sm text-[#D0CEDA]">{subtitle}</p>{/if}
			</div>
		</div>

		{#if showUpNext && nextItem}
			<button
				type="button"
				onclick={() => player.next()}
				class="absolute right-6 bottom-36 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/20 bg-[#0B0B10CC] py-3 pr-5 pl-3 text-left backdrop-blur hover:bg-[#0B0B10]"
			>
				<SkipForward class="size-6 fill-current" aria-hidden="true" />
				<span><span class="block text-xs font-bold tracking-[0.1em] text-[#A6A4B0] uppercase">Up next</span><span class="block font-semibold">{nextItem.Name}</span></span>
			</button>
		{/if}

		<div class="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-[linear-gradient(transparent,#000000CC)] px-4 pt-20 pb-4 md:px-8 md:pb-6">
			<SeekBar time={player.time} duration={player.duration} onseek={(t) => player.seek(t)} remaining />
			<div class="flex items-center gap-1 md:gap-2">
				<button type="button" class="grid size-14 cursor-pointer place-items-center rounded-full bg-white text-[#0B0B10]" aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
					{#if player.playing}<Pause class="size-6 fill-current" />{:else}<Play class="size-6 fill-current" />{/if}
				</button>
				<button type="button" class="{ctl} relative" aria-label="Back 10 seconds" onclick={() => player.skip(-10)}><RotateCcw class="size-6" /><span aria-hidden="true" class="absolute mt-0.5 text-[8px] font-extrabold">10</span></button>
				<button type="button" class="{ctl} relative" aria-label="Forward 30 seconds" onclick={() => player.skip(30)}><RotateCw class="size-6" /><span aria-hidden="true" class="absolute mt-0.5 text-[8px] font-extrabold">30</span></button>
				{#if hasNext}<button type="button" class={ctl} aria-label="Next: {nextItem?.Name}" onclick={() => player.next()}><SkipForward class="size-6 fill-current" /></button>{/if}
				<button type="button" class="{ctl} max-sm:hidden" aria-label={player.muted ? 'Unmute' : 'Mute'} onclick={() => player.toggleMute()}>
					{#if player.muted}<VolumeX class="size-6" />{:else}<Volume2 class="size-6" />{/if}
				</button>
				<VolumeBar id="vp-vol" class="w-24 max-sm:hidden" />
				<div class="flex-1"></div>
				<span class="mr-2 rounded-md border border-white/25 px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] max-md:hidden" title="How this file reaches your browser">
					{player.playMethod === 'Transcode' ? 'TRANSCODING' : 'DIRECT PLAY'}
				</span>
				{#if audioTracks.length > 1}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger class={ctl} aria-label="Audio track"><AudioLines class="size-6" /></DropdownMenu.Trigger>
						<DropdownMenu.Content side="top" align="end" sideOffset={8} class="z-[60] max-h-80 min-w-64 overflow-y-auto rounded-2xl border border-white/15 bg-[#1A1A21] p-1.5 text-white shadow-2xl">
							<DropdownMenu.RadioGroup value={String(player.audioIndex)} onValueChange={(v) => player.setTracks({ audioIndex: +v })}>
								{#each audioTracks as a (a.Index)}
									<DropdownMenu.RadioItem value={String(a.Index)} class={menuItem}>{a.DisplayTitle}</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
				{#if subTracks.length}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger class={ctl} aria-label="Subtitles"><Captions class="size-6" /></DropdownMenu.Trigger>
						<DropdownMenu.Content side="top" align="end" sideOffset={8} onCloseAutoFocus={(e) => subSettingsOpen && e.preventDefault()} class="z-[60] max-h-80 min-w-64 overflow-y-auto rounded-2xl border border-white/15 bg-[#1A1A21] p-1.5 text-white shadow-2xl">
							<DropdownMenu.RadioGroup value={String(player.subtitleIndex)} onValueChange={(v) => player.setTracks({ subtitleIndex: +v })}>
								<DropdownMenu.RadioItem value="-1" class={menuItem}>Off</DropdownMenu.RadioItem>
								{#each subTracks as s (s.Index)}
									<DropdownMenu.RadioItem value={String(s.Index)} class={menuItem}>{s.DisplayTitle}</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
							<DropdownMenu.Separator class="my-1 h-px bg-white/15" />
							<DropdownMenu.Item class={menuItem} onSelect={() => (subSettingsOpen = true)}><Settings2 class="size-4" aria-hidden="true" />Subtitle settings…</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
				<button type="button" class={ctl} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onclick={toggleFullscreen}>
					{#if fullscreen}<Minimize class="size-6" />{:else}<Maximize class="size-6" />{/if}
				</button>
			</div>
		</div>
	</div>
</div>
