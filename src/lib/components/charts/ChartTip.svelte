<script lang="ts">
	// Hover card for charts: placed by the chart, clamped inside it, never blocks the pointer.
	import type { Snippet } from 'svelte';
	let { x, y, width, children }: { x: number; y: number; width: number; children: Snippet } = $props();
	let w = $state(160);
	const left = $derived(Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w)));
</script>

<div
	bind:clientWidth={w}
	class="bg-popover text-popover-foreground border-border pointer-events-none absolute z-10 rounded-xl border px-3 py-2 text-xs whitespace-nowrap shadow-xl"
	style="left: {left}px; top: {Math.max(0, y)}px; transform: translateY(-100%)"
	role="presentation"
>
	{@render children()}
</div>
