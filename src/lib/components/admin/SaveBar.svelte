<script lang="ts">
	// Sticky "unsaved changes" bar; also warns before leaving the page with edits.
	import { beforeNavigate } from '$app/navigation';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { Draft } from '#lib/admin/draft.svelte.ts';
	import { toasts } from '#lib/toast.svelte.ts';

	let { drafts, onsave, note }: { drafts: Draft<object>[]; onsave: () => Promise<void>; note?: string } = $props();
	const dirty = $derived(drafts.some((d) => d.dirty));
	const saving = $derived(drafts.some((d) => d.saving));

	beforeNavigate(({ cancel, type }) => {
		if (dirty && type !== 'leave' && !window.confirm('You have unsaved changes. Leave without saving?')) cancel();
	});

	async function save() {
		try {
			await onsave();
			toasts.show(note ? `Saved. ${note}` : 'Settings saved');
		} catch {
			toasts.error("Couldn't save. Check the values and try again.");
		}
	}
</script>

<svelte:window onbeforeunload={(e) => dirty && e.preventDefault()} />

{#if dirty}
	<div role="region" aria-label="Unsaved changes" class="bg-popover border-border sticky bottom-4 z-20 mx-auto mt-2 flex w-full max-w-xl items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl">
		<span class="flex-1 text-sm font-medium">You have unsaved changes</span>
		<Button variant="ghost" size="sm" disabled={saving} onclick={() => drafts.forEach((d) => d.reset())}>Discard</Button>
		<Button size="sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
	</div>
{/if}
