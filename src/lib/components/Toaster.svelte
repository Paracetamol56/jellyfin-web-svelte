<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { toasts } from '#lib/toast.svelte.ts';
</script>

<div aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-28">
	{#each toasts.list as t (t.id)}
		<div
			role={t.tone === 'error' ? 'alert' : 'status'}
			class="bg-popover text-popover-foreground border-border pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl border py-2 pr-2 pl-4 text-sm shadow-2xl {t.tone === 'error' ? 'border-destructive/60' : ''}"
		>
			<span class="flex-1">{t.message}</span>
			{#if t.action}
				<button type="button" class="text-primary h-9 cursor-pointer rounded-full px-3 font-semibold hover:bg-accent" onclick={() => { t.action!.run(); toasts.dismiss(t.id); }}>{t.action.label}</button>
			{/if}
			<button type="button" class="hover:bg-accent grid size-9 cursor-pointer place-items-center rounded-full" aria-label="Dismiss" onclick={() => toasts.dismiss(t.id)}><X class="size-4" /></button>
		</div>
	{/each}
</div>
