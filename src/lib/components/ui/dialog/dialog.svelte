<script lang="ts">
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		description,
		wide = false,
		children,
		footer
	}: { open?: boolean; title: string; description?: string; wide?: boolean; children: Snippet; footer?: Snippet } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
		<Dialog.Content
			class="bg-popover text-popover-foreground border-border fixed top-1/2 left-1/2 z-[61] flex max-h-[min(88dvh,900px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border shadow-2xl {wide ? 'max-w-3xl' : 'max-w-lg'}"
		>
			<div class="flex items-start gap-4 px-6 pt-6 pb-4">
				<div class="min-w-0 flex-1">
					<Dialog.Title class="font-display text-2xl font-bold">{title}</Dialog.Title>
					{#if description}<Dialog.Description class="text-muted-foreground mt-1 text-sm">{description}</Dialog.Description>{/if}
				</div>
				<Dialog.Close class="hover:bg-accent -mt-1 -mr-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full" aria-label="Close"><X class="size-5" /></Dialog.Close>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{@render children()}</div>
			{#if footer}<div class="border-border flex flex-wrap justify-end gap-2 border-t px-6 py-4">{@render footer()}</div>{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
