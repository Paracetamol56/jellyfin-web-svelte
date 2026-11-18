<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { backdropImage, primaryImage } from '#lib/api/images.ts';
	import { itemSubtitle, progress, qualityLabel } from '#lib/api/format.ts';
	import Check from '@lucide/svelte/icons/check';
	import ArtPlaceholder from './ArtPlaceholder.svelte';
	import ItemContextMenu from './menu/ItemContextMenu.svelte';
	import ItemMenuButton from './menu/ItemMenuButton.svelte';
	import type { MenuContext } from './menu/ItemMenu.svelte';

	type Shape = 'poster' | 'square' | 'wide';
	let { item, shape = 'poster', subtitle, menu = {} }: { item: BaseItemDto; shape?: Shape; subtitle?: string; menu?: MenuContext | false } = $props();

	const src = $derived(shape === 'wide' ? (backdropImage(item, 640) ?? primaryImage(item, 640)) : primaryImage(item, shape === 'square' ? 360 : 320));
	const quality = $derived(shape === 'poster' ? qualityLabel(item.Height, item.Width) : null);
	const pct = $derived(progress(item));
	const unplayed = $derived(item.UserData?.UnplayedItemCount ?? 0);
	const sub = $derived(subtitle ?? itemSubtitle(item));
	const title = $derived(item.Type === 'Episode' && shape === 'wide' ? (item.SeriesName ?? item.Name) : item.Name);
	let failed = $state(false);
</script>

{#snippet card()}
<a href={resolve('/item/[id]', { id: item.Id! })} class="group/card flex min-w-0 flex-col gap-1">
	<div
		class="bg-muted relative mb-1.5 overflow-hidden rounded-[14px] {shape === 'poster' ? 'aspect-[2/3]' : shape === 'square' ? 'aspect-square' : 'aspect-video'}"
	>
		{#if src && !failed}
			<img
				{src}
				alt=""
				loading="lazy"
				decoding="async"
				onerror={() => (failed = true)}
				class="size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
			/>
		{:else}
			<ArtPlaceholder type={item.Type} name={item.Name} />
		{/if}
		{#if quality}
			<span class="bg-ink/80 absolute top-3 left-3 rounded-md px-[7px] py-1 text-[10px] font-bold tracking-[0.06em] text-[#F1F0F4]">{quality}</span>
		{/if}
		{#if unplayed > 0}
			<span class="bg-primary text-primary-foreground absolute top-3 right-3 grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold">{unplayed}</span>
		{:else if item.UserData?.Played}
			<span class="bg-primary text-primary-foreground absolute top-3 right-3 grid size-6 place-items-center rounded-full shadow-[0_2px_8px_#0006]">
				<Check class="size-4" strokeWidth={3} aria-hidden="true" /><span class="sr-only">Watched</span>
			</span>
		{/if}
		{#if pct > 0 && pct < 100}
			<span class="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/25" aria-label="{Math.round(pct)}% watched" role="img">
				<span class="bg-primary block h-full" style="width: {pct}%"></span>
			</span>
		{/if}
	</div>
	<span class="truncate pr-8 text-sm leading-tight font-semibold group-hover/card:text-primary">{title}</span>
	{#if sub}<span class="text-muted-foreground truncate pr-8 text-xs">{shape === 'wide' && item.Type === 'Episode' ? `${sub.split(' · ').slice(1).join(' · ')} · ${item.Name}` : sub}</span>{/if}
</a>
{/snippet}

{#if menu === false}
	{@render card()}
{:else}
	<ItemContextMenu {item} context={menu} class="group relative min-w-0">
		{@render card()}
		<div class="absolute -right-1.5 bottom-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
			<ItemMenuButton {item} context={menu} />
		</div>
	</ItemContextMenu>
{/if}
