<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Info from '@lucide/svelte/icons/info';
	import List from '@lucide/svelte/icons/list';
	import Play from '@lucide/svelte/icons/play';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { backdropImage, logoImage } from '#lib/api/images.ts';
	import { episodeCode, minutesLeft, progress, qualityLabel } from '#lib/api/format.ts';
	import { accentFor } from '#lib/accent.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { playItem } from '#lib/player/actions.ts';

	type Slide = { item: BaseItemDto; kind: 'Continue watching' | 'Next up' | 'Recently added' };
	let { slides }: { slides: Slide[] } = $props();

	let index = $state(0);
	const n = $derived(slides.length);
	const current = $derived(slides[Math.min(index, n - 1)]);
	const item = $derived(current.item);
	const bg = $derived(backdropImage(item, 1920));
	const logo = $derived(logoImage(item));
	const accent = $derived(accentFor(bg));
	const resumable = $derived(progress(item) > 0);

	const title = $derived(item.Type === 'Episode' ? (item.SeriesName ?? item.Name ?? '') : (item.Name ?? ''));
	const meta = $derived(
		item.Type === 'Episode' ? episodeCode(item) : [item.Type === 'Movie' ? 'Film' : item.Type, item.ProductionYear].filter(Boolean).join(' · ')
	);
	const chips = $derived([qualityLabel(item.Height, item.Width)?.toLowerCase(), item.OfficialRating].filter(Boolean) as string[]);
	const sub = $derived(
		item.Type === 'Episode'
			? `Episode ${item.IndexNumber ?? ''} — “${item.Name}”`
			: resumable
				? minutesLeft(item)
				: (item.Taglines?.[0] ?? item.Genres?.slice(0, 3).join(' · ') ?? '')
	);
	const cta = $derived(resumable ? 'Resume' : item.Type === 'Episode' ? 'Play episode' : 'Play');
	const go = (k: number) => (index = (k + n) % n);
</script>

<article
	aria-roledescription="carousel"
	aria-label="Featured"
	class="relative flex min-h-[440px] min-w-0 flex-[999_1_620px] flex-col justify-end overflow-hidden rounded-3xl bg-[#15151C] text-[#F1F0F4]"
>
	{#if bg}
		{#key bg}<img src={bg} alt="" class="absolute inset-0 size-full object-cover" />{/key}
	{/if}
	<div aria-hidden="true" class="absolute inset-0 bg-[linear-gradient(90deg,#0B0B10F5_0%,#0B0B10C0_45%,#0B0B1033_100%),linear-gradient(0deg,#0B0B10E0_0%,transparent_55%)]"></div>

	<div role="group" aria-roledescription="slide" aria-label="{index + 1} of {n}" aria-live="polite" class="relative flex max-w-[640px] flex-col gap-3.5 px-6 pt-10 pb-7 md:px-11">
		<div class="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase">
			<span style="color: {accent.value}">{current.kind}</span>
			{#if meta}<span class="mr-1.5 text-[#D5DCC8]">{meta}</span>{/if}
			{#each chips as c (c)}
				<span class="rounded-md border border-white/25 px-[7px] py-[3px]">{c}</span>
			{/each}
		</div>
		{#if logo}
			<h1 class="m-0"><img src={logo} alt={title} class="max-h-28 max-w-[min(420px,80%)] object-contain object-left" /></h1>
		{:else}
			<h1 class="text-4xl leading-none font-extrabold md:text-[52px]">{title}</h1>
		{/if}
		{#if sub}<p class="text-lg text-[#E4E2EA]">{sub}</p>{/if}
		<div class="mt-2 flex flex-wrap gap-3">
			<a
				href={resolve('/item/[id]', { id: item.Id! })}
				onclick={(e) => { e.preventDefault(); playItem(item); }}
				class="text-ink inline-flex h-13 items-center gap-2.5 rounded-full px-6.5 text-base font-bold"
				style="background: {accent.value}"
			>
				<Play class="size-5 fill-current" aria-hidden="true" />{cta}
			</a>
			{#if item.Type === 'Episode' && item.SeriesId}
				<Button variant="overlay" size="lg" href={resolve('/item/[id]', { id: item.SeriesId })} class="font-medium">
					<List aria-hidden="true" />All episodes
				</Button>
			{:else}
				<Button variant="overlay" size="lg" href={resolve('/item/[id]', { id: item.Id! })} class="font-medium">
					<Info aria-hidden="true" />Details
				</Button>
			{/if}
		</div>
	</div>

	{#if n > 1}
		<div class="relative flex items-center gap-3 px-6 pb-7 md:px-11">
			<Button variant="overlay" size="icon" aria-label="Previous slide" onclick={() => go(index - 1)}><ChevronLeft /></Button>
			<Button variant="overlay" size="icon" aria-label="Next slide" onclick={() => go(index + 1)}><ChevronRight /></Button>
			<div role="group" aria-label="Choose slide" class="ml-2 flex items-center gap-1 max-sm:hidden">
				{#each slides as _, k (k)}
					<button
						type="button"
						class="grid size-11 cursor-pointer place-items-center"
						aria-label="Go to slide {k + 1}"
						aria-current={k === index ? 'true' : undefined}
						onclick={() => go(k)}
					>
						<span
							class="block h-1.5 rounded-full transition-all"
							style="width: {k === index ? 28 : 8}px; background: {k === index ? accent.value : '#FFFFFF59'}"
						></span>
					</button>
				{/each}
			</div>
			<span class="ml-auto text-[13px] text-[#D5DCC8] tabular-nums">{index + 1} / {n}</span>
		</div>
	{/if}
</article>
