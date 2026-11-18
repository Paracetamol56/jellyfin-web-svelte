<script lang="ts">
	import ArtistLinks, { artistsOf } from '#lib/components/ArtistLinks.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Heart from '@lucide/svelte/icons/heart';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import MicVocal from '@lucide/svelte/icons/mic-vocal';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Repeat1 from '@lucide/svelte/icons/repeat-1';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import StackedArrows from '#lib/components/player/StackedArrows.svelte';
	import Marquee from '#lib/components/player/Marquee.svelte';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import RepeatOff from '@lucide/svelte/icons/repeat-off';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Disc3 from '@lucide/svelte/icons/disc-3';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { DropdownMenu } from 'bits-ui';
	import Volume1 from '@lucide/svelte/icons/volume-1';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { primaryImage } from '#lib/api/images.ts';
	import { clock, ticksToSeconds } from '#lib/api/format.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import { toggleFavorite } from '#lib/player/favorite.ts';
	import { paletteFor, paletteVars } from '#lib/palette.svelte.ts';
	import { layout } from '#lib/layout.svelte.ts';
	import Equalizer from '#lib/components/player/Equalizer.svelte';
	import Lyrics from '#lib/components/player/Lyrics.svelte';
	import SeekBar from '#lib/components/player/SeekBar.svelte';
	import ArtPlaceholder from '#lib/components/ArtPlaceholder.svelte';
	import QueueList from '#lib/components/player/QueueList.svelte';
	import VolumeBar from '#lib/components/player/VolumeBar.svelte';
	import ListX from '@lucide/svelte/icons/list-x';
	import Save from '@lucide/svelte/icons/save';
	import { dialogs } from '#lib/dialogs.svelte.ts';

	const item = $derived(player.current);
	const art = $derived(item ? primaryImage(item, 900) : null);
	const palette = $derived(paletteFor(art));
	let artFailed = $state(false);
	$effect(() => {
		art;
		artFailed = false;
	});
	const vars = $derived(
		paletteVars(palette.value) +
			'--seek-accent:var(--np-accent);--seek-line:var(--np-line);--seek-ring:var(--np-bg);--seek-muted:var(--np-muted);'
	);
	const artist = $derived(item ? (item.Artists ?? []).join(', ') || item.AlbumArtist || '' : '');
	const queueTotal = $derived.by(() => {
		const s = player.queue.reduce((a, q) => a + ticksToSeconds(q.RunTimeTicks), 0);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
	});
	const upNext = $derived(player.queue.slice(player.index + 1, player.index + 6).map((q, k) => ({ q, i: player.index + 1 + k })));
	const ghost = $derived(item?.Name ?? '');
	const ghostSize = $derived(Math.round(Math.max(150, Math.min(560, 1500 / (Math.max(3, ghost.length) * 0.62)))));

	let tab = $state<'player' | 'lyrics' | 'queue'>('player');

	// Desktop panels can be hidden; the choice is remembered on this device.
	const readFlag = (k: string) => {
		try {
			return localStorage.getItem(k) !== '0';
		} catch {
			return true;
		}
	};
	let showLyrics = $state(readFlag('jf.np.lyrics'));
	let showQueue = $state(readFlag('jf.np.queue'));
	const bothHidden = $derived(!showLyrics && !showQueue);
	$effect(() => {
		try {
			localStorage.setItem('jf.np.lyrics', showLyrics ? '1' : '0');
			localStorage.setItem('jf.np.queue', showQueue ? '1' : '0');
		} catch {
			/* remembering is a nicety */
		}
	});

	function back() {
		if (history.length > 1) history.back();
		else goto(resolve('/'));
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('input, select, textarea')) return;
		if (e.key === ' ' && !t.closest('button, a')) {
			e.preventDefault();
			player.toggle();
		} else if (e.key === 'ArrowLeft' && !t.closest('button, a')) player.skip(-10);
		else if (e.key === 'ArrowRight' && !t.closest('button, a')) player.skip(30);
		else if (e.key === 'Escape' || (layout.tv && e.key === 'Backspace')) back();
	}

	const ctl = 'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-(--np-text) hover:bg-(--np-panel) disabled:opacity-40';
	const chip = 'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-(--np-line) bg-(--np-panel) text-(--np-text) hover:bg-white/10 disabled:cursor-default disabled:opacity-40';
	const panel = 'rounded-[28px] border border-(--np-line) bg-(--np-panel) backdrop-blur-sm';
	const menuItem = 'flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-highlighted:bg-(--np-panel)';
	// Lyrics and queue fill the viewport below the header and scroll inside.
	const tall = 'md:h-[calc(100dvh-132px)] md:min-h-[480px]';
</script>

<svelte:head><title>{item ? `${item.Name} · ${artist}` : 'Now playing'} · Jellyfin</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div
	class="relative isolate min-h-dvh overflow-hidden bg-(--np-bg) text-(--np-text) transition-colors duration-700"
	style={vars}
>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		<span class="absolute -top-[28%] -left-[12%] h-full w-3/4 animate-[drift1_18s_ease-in-out_infinite_alternate] rounded-full bg-[radial-gradient(closest-side,var(--np-glow1),transparent)] opacity-50 will-change-transform motion-reduce:animate-none"></span>
		<span class="absolute -right-[18%] -bottom-[36%] h-full w-3/4 animate-[drift2_23s_ease-in-out_infinite_alternate] rounded-full bg-[radial-gradient(closest-side,var(--np-glow2),transparent)] opacity-30 will-change-transform motion-reduce:animate-none"></span>
		{#if layout.tv}
			<span class="font-display absolute -right-[2%] -bottom-[8%] leading-[0.8] font-extrabold tracking-[-0.05em] whitespace-nowrap text-(--np-accent) opacity-[0.06]" style="font-size: {ghostSize}px">{ghost}</span>
		{/if}
	</div>

	{#if !item}
		<main class="grid min-h-dvh place-items-center px-4 text-center">
			<div class="flex flex-col items-center gap-4">
				<h1 class="text-4xl font-extrabold">Nothing playing</h1>
				<p class="text-(--np-muted)">Pick an album, playlist or artist to start listening.</p>
				<a href={resolve('/')} class="rounded-full bg-(--np-accent) px-6 py-3 font-bold text-(--np-ink)">Go home</a>
			</div>
		</main>
	{:else if layout.tv}
		<!-- 10-foot UI: cover + transport on the left, lyrics and up next on the right -->
		<div class="grid h-dvh grid-cols-[minmax(0,min(640px,38vw))_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-[72px] px-[96px] py-[64px]">
			<section aria-label="Now playing" class="flex min-h-0 flex-col justify-center gap-8">
				<div class="relative aspect-square max-h-[48vh] w-full max-w-[48vh] overflow-hidden rounded-[36px] shadow-[0_60px_120px_-30px_var(--np-glow1),0_0_0_1px_var(--np-line)]">
					{#if art && !artFailed}<img src={art} alt="Album cover: {item.Album ?? item.Name}" class="size-full object-cover" onerror={() => (artFailed = true)} />{:else}<ArtPlaceholder name={item.Album ?? item.Name} size="lg" />{/if}
				</div>
				<div>
					<h1 class="text-[64px] leading-none font-extrabold tracking-[-0.03em]">{item.Name}</h1>
					<p class="mt-3 text-[28px] text-(--np-muted)"><ArtistLinks artists={artistsOf(item)} class="font-semibold text-(--np-text) hover:underline" />{item.Album ? ` · ${item.Album}` : ''}</p>
				</div>
				<SeekBar time={player.time} duration={player.duration} onseek={(t) => player.seek(t)} size="lg" remaining class="text-xl [&_.tabular-nums]:text-xl" />
				<div class="flex items-center gap-6">
					<button type="button" class="{ctl} size-16 {player.shuffled ? 'text-(--np-accent)' : ''}" aria-label="Shuffle" title={player.shuffled ? 'Shuffle: on' : 'Shuffle: off (in order)'} aria-pressed={player.shuffled} onclick={() => player.toggleShuffle()}>{#if player.shuffled}<Shuffle class="size-8" />{:else}<StackedArrows class="size-8" />{/if}</button>
					<button type="button" class="{ctl} size-16" aria-label="Previous track" onclick={() => player.previous()}><SkipBack class="size-9 fill-current" /></button>
					<button type="button" class="grid size-28 cursor-pointer place-items-center rounded-full bg-(--np-accent) text-(--np-ink) shadow-[0_20px_60px_-12px_var(--np-accent)]" aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
						{#if player.playing}<Pause class="size-12 fill-current" />{:else}<Play class="size-12 fill-current" />{/if}
					</button>
					<button type="button" class="{ctl} size-16" aria-label="Next track" onclick={() => player.next()}><SkipForward class="size-9 fill-current" /></button>
					<button type="button" class="{ctl} size-16 {player.repeat !== 'off' ? 'text-(--np-accent)' : ''}" aria-label="Repeat: {player.repeat}" title={player.repeat === 'one' ? 'Repeat: this track' : player.repeat === 'all' ? 'Repeat: whole queue' : 'Repeat: off (stop at the end)'} aria-pressed={player.repeat !== 'off'} onclick={() => player.cycleRepeat()}>
						{#if player.repeat === 'one'}<Repeat1 class="size-8" />{:else if player.repeat === 'all'}<Repeat class="size-8" />{:else}<RepeatOff class="size-8" />{/if}
					</button>
				</div>
			</section>
			<div class="flex min-h-0 flex-col gap-8">
				<section aria-label="Lyrics" class="{panel} flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-10">
					<div class="flex items-center gap-3 text-2xl font-bold"><MicVocal class="size-7 text-(--np-accent)" aria-hidden="true" />Lyrics</div>
					<Lyrics {item} size="tv" window={[-1, 3]} />
				</section>
				<section aria-label="Up next" class="{panel} p-8">
					<div class="mb-4 flex items-baseline justify-between"><h2 class="text-[32px] font-bold">Up next</h2><span class="text-lg text-(--np-muted)">{player.queue.length} tracks in queue</span></div>
					<ul class="flex flex-col gap-1">
						{#each upNext as { q, i } (`${q.Id}-${i}`)}
							{@const thumb = primaryImage(q, 120)}
							<li>
								<button type="button" class="flex min-h-[72px] w-full cursor-pointer items-center gap-5 rounded-2xl px-3 text-left hover:bg-(--np-panel) focus-visible:bg-(--np-panel)" aria-label="Play {q.Name}" onclick={() => player.jump(i)}>
									<span class="size-14 shrink-0 overflow-hidden rounded-xl bg-black/30">{#if thumb}<img src={thumb} alt="" class="size-full object-cover" />{/if}</span>
									<span class="flex-1 truncate text-2xl font-semibold">{q.Name}</span>
									<span class="text-xl text-(--np-muted) tabular-nums">{clock(ticksToSeconds(q.RunTimeTicks))}</span>
								</button>
							</li>
						{/each}
					</ul>
				</section>
				<div class="flex flex-wrap gap-8 text-lg text-(--np-muted)" aria-hidden="true">
					<span>◀ ▶ Seek</span><span>▲ ▼ Lyrics · Queue</span>
					<span><kbd class="rounded-md border border-(--np-line) px-2 py-0.5 font-sans">OK</kbd> Play / Pause</span>
					<span><kbd class="rounded-md border border-(--np-line) px-2 py-0.5 font-sans">Back</kbd> Minimize</span>
				</div>
			</div>
		</div>
	{:else}
		<header class="mx-auto flex max-w-[1360px] items-center gap-4 px-4 py-4 md:px-10 md:py-5">
			<button type="button" class={chip} aria-label="Minimize player" onclick={back}><ChevronDown class="size-5" /></button>
			<div class="min-w-0 flex-1 text-center">
				<div class="text-xs font-bold tracking-[0.12em] text-(--np-muted) uppercase">{item.Album ? 'Playing from album' : 'Now playing'}</div>
				{#if item.AlbumId}
					<a href={resolve('/item/[id]', { id: item.AlbumId })} class="font-display block truncate text-lg font-bold tracking-[-0.01em] hover:underline">{item.Album}</a>
				{/if}
			</div>
			{#if !showLyrics}
				<button type="button" class="{chip} max-md:hidden" aria-label="Show lyrics" title="Show lyrics" onclick={() => (showLyrics = true)}><MicVocal class="size-5" /></button>
			{/if}
			{#if !showQueue}
				<button type="button" class="{chip} max-md:hidden" aria-label="Show queue" title="Show queue" onclick={() => (showQueue = true)}><ListMusic class="size-5" /></button>
			{/if}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={chip} aria-label="More options"><Ellipsis class="size-5" /></DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						align="end"
						sideOffset={8}
						class="z-50 min-w-56 rounded-2xl border border-(--np-line) bg-(--np-bg) p-1.5 text-(--np-text) shadow-2xl"
						style={vars}
					>
						{#if item.AlbumId}
							<DropdownMenu.Item class={menuItem} onSelect={() => goto(resolve('/item/[id]', { id: item.AlbumId! }))}><Disc3 class="size-4" />Go to album</DropdownMenu.Item>
						{/if}
						{@const linked = artistsOf(item).filter((a) => a.Id)}
						{#each linked as a (a.Id)}
							<DropdownMenu.Item class={menuItem} onSelect={() => goto(resolve('/item/[id]', { id: a.Id! }))}><UserRound class="size-4" />{linked.length > 1 ? `Go to ${a.Name}` : 'Go to artist'}</DropdownMenu.Item>
						{/each}
						<DropdownMenu.Separator class="my-1 h-px bg-(--np-line)" />
						<DropdownMenu.Item class={menuItem} onSelect={() => { player.stop(); back(); }}><Trash2 class="size-4" />Clear queue</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</header>

		<main class="mx-auto flex max-w-[1360px] flex-wrap items-start gap-x-10 gap-y-8 px-4 pt-2 pb-36 md:px-10 md:pb-14 {showLyrics ? '' : 'md:justify-center'}">
			<section aria-label="Now playing" class="flex min-w-0 flex-[0_1_440px] flex-col gap-[22px] md:min-w-[300px] {bothHidden ? 'md:mx-auto md:grid md:max-w-[1100px] md:flex-[1_1_100%] md:grid-cols-2 md:items-center md:gap-x-14' : ''} {tab === 'player' ? '' : 'max-md:hidden'}">
				<div class="relative aspect-square w-full overflow-hidden rounded-[28px] shadow-[0_50px_100px_-30px_var(--np-glow1),0_0_0_1px_var(--np-line)] {bothHidden ? 'md:max-w-[min(100%,calc(100dvh-170px))] md:justify-self-end' : ''}">
					{#if art && !artFailed}<img src={art} alt="Album cover: {item.Album ?? item.Name}" class="size-full object-cover" onerror={() => (artFailed = true)} />{:else}<ArtPlaceholder name={item.Album ?? item.Name} size="lg" />{/if}
				</div>
				<div class="flex min-w-0 flex-col gap-[22px]">
				<div class="flex items-start gap-3">
					<div class="min-w-0 flex-1">
						<h1 class="text-[32px] leading-[1.15] font-extrabold tracking-[-0.03em] md:text-[40px]"><Marquee>{item.Name}</Marquee></h1>
						<p class="mt-1.5 text-lg text-(--np-muted)">
							<ArtistLinks artists={artistsOf(item)} class="font-semibold text-(--np-text) hover:underline" />
							{#if item.Album && item.AlbumId}<span class="max-md:hidden"> · <a href={resolve('/item/[id]', { id: item.AlbumId })} class="hover:underline">{item.Album}</a></span>{/if}
						</p>
					</div>
					<button type="button" class={chip} aria-label={item.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!item.UserData?.IsFavorite} onclick={() => toggleFavorite(item)}>
						<Heart class="size-5 {item.UserData?.IsFavorite ? 'fill-(--np-accent) text-(--np-accent)' : ''}" />
					</button>
				</div>
				<SeekBar time={player.time} duration={player.duration} onseek={(t) => player.seek(t)} />
				<div class="flex items-center justify-between">
					<button type="button" class="{ctl} {player.shuffled ? 'text-(--np-accent)' : ''}" aria-label="Shuffle" title={player.shuffled ? 'Shuffle: on' : 'Shuffle: off (in order)'} aria-pressed={player.shuffled} onclick={() => player.toggleShuffle()}>{#if player.shuffled}<Shuffle class="size-5" />{:else}<StackedArrows class="size-5" />{/if}</button>
					<button type="button" class={ctl} aria-label="Previous track" onclick={() => player.previous()}><SkipBack class="size-6 fill-current" /></button>
					<button type="button" class="{ctl} relative max-md:hidden" aria-label="Back 10 seconds" onclick={() => player.skip(-10)}><RotateCcw class="size-6" /><span aria-hidden="true" class="absolute mt-0.5 text-[8px] font-extrabold">10</span></button>
					<button type="button" class="grid size-[72px] shrink-0 cursor-pointer place-items-center rounded-full bg-(--np-accent) text-(--np-ink) shadow-[0_14px_40px_-10px_var(--np-accent)]" aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
						{#if player.buffering && !player.playing}<LoaderCircle class="size-8 animate-spin" />{:else if player.playing}<Pause class="size-8 fill-current" />{:else}<Play class="size-8 fill-current" />{/if}
					</button>
					<button type="button" class="{ctl} relative max-md:hidden" aria-label="Forward 30 seconds" onclick={() => player.skip(30)}><RotateCw class="size-6" /><span aria-hidden="true" class="absolute mt-0.5 text-[8px] font-extrabold">30</span></button>
					<button type="button" class={ctl} aria-label="Next track" disabled={player.index >= player.queue.length - 1 && player.repeat !== 'all'} onclick={() => player.next()}><SkipForward class="size-6 fill-current" /></button>
					<button type="button" class="{ctl} {player.repeat !== 'off' ? 'text-(--np-accent)' : ''}" aria-label="Repeat: {player.repeat}" title={player.repeat === 'one' ? 'Repeat: this track' : player.repeat === 'all' ? 'Repeat: whole queue' : 'Repeat: off (stop at the end)'} aria-pressed={player.repeat !== 'off'} onclick={() => player.cycleRepeat()}>
						{#if player.repeat === 'one'}<Repeat1 class="size-5" />{:else if player.repeat === 'all'}<Repeat class="size-5" />{:else}<RepeatOff class="size-5" />{/if}
					</button>
				</div>
				<div class="flex items-center gap-3 text-(--np-muted) max-md:hidden">
					<button type="button" class="{ctl} text-(--np-muted)" aria-label={player.muted ? 'Unmute' : 'Mute'} onclick={() => player.toggleMute()}>
						{#if player.muted || player.volume === 0}<VolumeX class="size-5" />{:else if player.volume < 0.5}<Volume1 class="size-5" />{:else}<Volume2 class="size-5" />{/if}
					</button>
					<VolumeBar id="np-vol" class="flex-1" />
					<span class="w-7 text-right text-[13px] tabular-nums">{Math.round(player.volume * 100)}</span>
				</div>
				{#if player.error}<p role="alert" class="text-sm text-[#FFB4A2]">{player.error}</p>{/if}
				</div>
			</section>

			<section aria-label="Lyrics" class="{panel} {tall} {showLyrics ? '' : 'md:hidden'} flex min-w-0 flex-[1_1_380px] flex-col gap-[18px] overflow-hidden px-8 py-7 md:sticky md:top-5 md:min-w-[300px] {tab === 'lyrics' ? 'max-md:h-[calc(100dvh-260px)] max-md:border-0 max-md:bg-transparent max-md:px-0' : 'max-md:hidden'}">
				<div class="flex items-center gap-3 max-md:hidden">
					<MicVocal class="size-6 text-(--np-accent)" aria-hidden="true" />
					<h2 class="flex-1 text-2xl font-bold">Lyrics</h2>
					<button type="button" class="{chip} -mt-1 -mr-3" aria-label="Hide lyrics" title="Hide lyrics" onclick={() => (showLyrics = false)}><EyeOff class="size-[18px]" /></button>
				</div>
				{#if showLyrics || tab === 'lyrics'}<Lyrics {item} size={tab === 'lyrics' ? 'sm' : 'md'} />{/if}
			</section>

			<section aria-label="Queue" class="{panel} {tall} {showQueue ? '' : 'md:hidden'} flex min-w-0 flex-[0_1_380px] flex-col gap-3.5 overflow-hidden px-[18px] pt-6 pb-[18px] md:sticky md:top-5 md:min-w-[300px] {tab === 'queue' ? 'max-md:border-0 max-md:bg-transparent max-md:px-0' : 'max-md:hidden'}">
				<div class="flex items-start gap-2 px-2">
					<ListMusic class="mt-1 size-6 shrink-0 text-(--np-accent)" aria-hidden="true" />
					<div>
					<h2 class="text-2xl font-bold">Queue</h2>
					<p class="mt-0.5 text-[13px] text-(--np-muted)">{player.queue.length} {player.queue.length === 1 ? 'track' : 'tracks'} · {queueTotal}</p>
					</div>
					<div class="flex-1"></div>
					<button type="button" class={chip} aria-label="Save queue as playlist" onclick={() => dialogs.open('playlist', player.queue)}><Save class="size-[18px]" /></button>
					<button type="button" class={chip} aria-label="Clear upcoming tracks" disabled={player.index >= player.queue.length - 1} onclick={() => player.clearUpcoming()}><ListX class="size-[18px]" /></button>
					<button type="button" class="{chip} max-md:hidden" aria-label="Hide queue" title="Hide queue" onclick={() => (showQueue = false)}><EyeOff class="size-[18px]" /></button>
				</div>
				{#if showQueue || tab === 'queue'}<QueueList class="flex-1 max-md:max-h-[calc(100dvh-280px)]" />{/if}
			</section>
		</main>

		<!-- Mobile: compact controls when lyrics/queue fill the screen, then the tab bar -->
		<div class="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-[linear-gradient(transparent,var(--np-bg)_30%)] px-4 pt-6 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
			{#if tab !== 'player'}
				<div role="region" aria-label="Playback controls" class="{panel} flex flex-col gap-1 px-3 py-2">
					<div class="flex items-center gap-2">
						<span class="size-10 shrink-0 overflow-hidden rounded-lg">{#if art}<img src={art} alt="" class="size-full object-cover" />{/if}</span>
						<div class="min-w-0 flex-1"><div class="truncate text-sm font-bold">{item.Name}</div><div class="text-xs text-(--np-muted) tabular-nums">{clock(player.time)} / {clock(player.duration)}</div></div>
						<button type="button" class={ctl} aria-label="Previous track" onclick={() => player.previous()}><SkipBack class="size-5 fill-current" /></button>
						<button type="button" class="grid size-11 cursor-pointer place-items-center rounded-full bg-(--np-accent) text-(--np-ink)" aria-label={player.playing ? 'Pause' : 'Play'} onclick={() => player.toggle()}>
							{#if player.playing}<Pause class="size-5 fill-current" />{:else}<Play class="size-5 fill-current" />{/if}
						</button>
						<button type="button" class={ctl} aria-label="Next track" onclick={() => player.next()}><SkipForward class="size-5 fill-current" /></button>
					</div>
					<SeekBar time={player.time} duration={player.duration} onseek={(t) => player.seek(t)} size="sm" showTimes={false} />
				</div>
			{/if}
			<div role="tablist" aria-label="Player sections" class="flex gap-1 rounded-full border border-(--np-line) bg-(--np-panel) p-1 backdrop-blur">
				{#each [['player', 'Player'], ['lyrics', 'Lyrics'], ['queue', 'Queue']] as [key, label] (key)}
					<button
						type="button"
						role="tab"
						aria-selected={tab === key}
						onclick={() => (tab = key as typeof tab)}
						class="h-11 flex-1 cursor-pointer rounded-full text-sm font-semibold text-(--np-muted) aria-selected:bg-(--np-accent) aria-selected:text-(--np-ink)"
					>{label}</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
