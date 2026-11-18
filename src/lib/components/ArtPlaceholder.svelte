<script lang="ts">
	import { fallbackColors } from './fallback-art.ts';

	// Shown only when an item has no artwork (not while an image is loading).
	let { name, size = 'md' }: { type?: string | null; name?: string | null; size?: 'md' | 'lg' } = $props();
	const colors = $derived(fallbackColors(name ?? ''));
</script>

<div class="flex size-full flex-col justify-end {size === 'lg' ? 'p-6' : 'p-4'}" style="background: {colors.bg}" aria-hidden="true">
	<span class="mb-3 block h-[3px] w-[34px]" style="background: {colors.fg}"></span>
	<span class="font-display line-clamp-4 leading-none font-extrabold tracking-tight {size === 'lg' ? 'text-3xl' : 'text-[22px]'}" style="color: {colors.fg}">{name}</span>
</div>
