<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.ts';

	let { class: className, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div aria-hidden="true" class={cn('bg-muted animate-pulse rounded-xl', className)} {...rest}></div>
