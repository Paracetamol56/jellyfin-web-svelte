<script lang="ts">
	// Label + control + hint. Put any control in the default snippet; it receives the id to use.
	import type { Snippet } from 'svelte';
	let { label, hint, children, class: className = '' }: { label: string; hint?: string; children: Snippet<[string, string | undefined]>; class?: string } = $props();
	const id = $props.id();
</script>

<div class="flex flex-col gap-1.5 {className}">
	<label for={id} class="text-sm font-semibold">{label}</label>
	{@render children(id, hint ? `${id}-h` : undefined)}
	{#if hint}<p id="{id}-h" class="text-muted-foreground text-[13px]">{hint}</p>{/if}
</div>
