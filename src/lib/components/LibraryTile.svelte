<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { primaryImage } from '#lib/api/images.ts';
	import { fetchTileArt, keys } from '#lib/api/queries.ts';
	import { viewBlurb, viewIcon } from './view-icons.ts';

	let { view }: { view: BaseItemDto } = $props();
	const Icon = $derived(viewIcon(view.CollectionType));
	const square = $derived(view.CollectionType === 'music' || view.CollectionType === 'playlists');

	// Shares the Home shelves' cache for normal libraries (same key as their "latest" query).
	const latest = createQuery(() => ({
		queryKey: view.CollectionType === 'playlists' || view.CollectionType === 'boxsets' ? ['tileArt', view.Id] : keys.latest(view.Id!),
		queryFn: () => fetchTileArt(view)
	}));
	const art = $derived(
		(latest.data ?? [])
			.map((i) => primaryImage(i, 240))
			.filter((s): s is string => !!s)
			.slice(0, 4)
	);

	// Fanned-out poster positions from the design (left %, top %, rotation).
	const POSTER = [
		[20, -14, 8],
		[42, -6, -5],
		[62, -16, 10],
		[80, 6, -8]
	];
	const SQUARE = [
		[22, -10, -6],
		[54, -16, 7],
		[34, 34, 5],
		[66, 28, -7]
	];
</script>

<a
	href={resolve('/library/[id]', { id: view.Id! })}
	class="group border-border relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-[20px] border bg-[#1A1A21] p-6 text-[#F1F0F4]"
>
	<span aria-hidden="true" class="absolute inset-0">
		{#each art as src, i (src)}
			{@const [l, t, r] = (square ? SQUARE : POSTER)[i]}
			<img
				{src}
				alt=""
				loading="lazy"
				class="absolute rounded-[10px] object-cover shadow-[0_10px_24px_#00000066] transition-transform duration-500 group-hover:scale-105 {square ? 'aspect-square w-[48%]' : 'aspect-[2/3] w-[36%]'}"
				style="left: {l}%; top: {t}%; rotate: {r}deg"
			/>
		{/each}
	</span>
	<span aria-hidden="true" class="absolute inset-0 bg-[linear-gradient(0deg,#0B0B10F2_0%,#0B0B10A6_42%,#0B0B1014_100%)]"></span>
	<Icon class="relative size-7" aria-hidden="true" />
	<span class="relative">
		<span class="font-display block text-2xl font-bold">{view.Name}</span>
		<span class="text-[13px] text-[#D0CEDA]">{viewBlurb(view.CollectionType)}</span>
	</span>
</a>
