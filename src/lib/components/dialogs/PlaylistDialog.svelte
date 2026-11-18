<script lang="ts">
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { createPlaylist } from '#lib/item-actions.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';

	let { items, open = $bindable() }: { items: BaseItemDto[]; open: boolean } = $props();
	let name = $state('');
	let busy = $state(false);
	const what = $derived(items.length === 1 ? `“${items[0].Name}”` : `${items.length} items`);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		try {
			await createPlaylist(name.trim(), items);
			open = false;
		} catch {
			toasts.error("Couldn't create the playlist.");
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title="New playlist" description={items.length ? `Starts with ${what}.` : undefined}>
	<form id="new-playlist" onsubmit={submit} class="flex flex-col gap-1.5">
		<Label for="pl-name">Name</Label>
		<!-- svelte-ignore a11y_autofocus -->
		<Input id="pl-name" required autofocus bind:value={name} />
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button type="submit" form="new-playlist" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</Button>
	{/snippet}
</Dialog>
