<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.ts';

	let {
		title,
		href,
		cardWidth = 'w-[160px] md:w-[180px]',
		children
	}: { title: string; href?: string; cardWidth?: string; children: Snippet<[string]> } = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	const id = $props.id();

	function page(dir: number) {
		if (!scroller) return;
		scroller.scrollBy({ left: dir * scroller.clientWidth * 0.85, behavior: 'smooth' });
	}
</script>

<section aria-labelledby={id} class="flex flex-col gap-5">
	<div class="flex flex-wrap items-center gap-4">
		<h2 {id} class="text-2xl font-bold md:text-[30px]">{title}</h2>
		{#if href}
			<a {href} class="text-primary inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
				See all<ChevronRight class="size-4" aria-hidden="true" />
			</a>
		{/if}
		<div class="flex-1"></div>
		<Button variant="outline" size="icon" aria-label="Scroll {title} back" onclick={() => page(-1)} class="max-md:hidden">
			<ChevronLeft />
		</Button>
		<Button variant="outline" size="icon" aria-label="Scroll {title} forward" onclick={() => page(1)} class="max-md:hidden">
			<ChevronRight />
		</Button>
	</div>
	<div
		bind:this={scroller}
		class="-mx-4 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-10 md:scroll-px-10 md:px-10"
	>
		{@render children(`${cardWidth} shrink-0 snap-start`)}
	</div>
</section>
