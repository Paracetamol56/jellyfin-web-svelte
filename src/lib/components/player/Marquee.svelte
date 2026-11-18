<script lang="ts">
	// Single-line text that scrolls back and forth when it's wider than its box, and just sits still when it fits.
	import type { Snippet } from 'svelte';

	let { children, class: className = '' }: { children: Snippet; class?: string } = $props();

	let box = $state<HTMLElement | null>(null);
	let text = $state<HTMLElement | null>(null);
	let overflow = $state(0);

	$effect(() => {
		if (!box || !text) return;
		const measure = () => (overflow = Math.max(0, Math.ceil((text?.offsetWidth ?? 0) - (box?.clientWidth ?? 0))));
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(box);
		ro.observe(text);
		return () => ro.disconnect();
	});

	// ~40 px/s, never faster than a readable pace.
	const duration = $derived(Math.max(4, overflow / 40 + 2.5));
</script>

<span bind:this={box} class="marquee-box block overflow-hidden whitespace-nowrap {className}" style:--shift="-{overflow}px" style:--dur="{duration}s">
	<span bind:this={text} class="inline-block {overflow > 0 ? 'marquee' : ''}">{@render children()}</span>
</span>
