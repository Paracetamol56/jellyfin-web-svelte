<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.ts';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...rest
	}: WithElementRef<HTMLInputAttributes> = $props();
</script>

<input
	bind:this={ref}
	bind:value
	class={cn(
		'border-input bg-card placeholder:text-muted-foreground flex h-11 w-full min-w-0 rounded-xl border px-3.5 text-[15px] transition-colors outline-none focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive',
		className
	)}
	{...rest}
/>
