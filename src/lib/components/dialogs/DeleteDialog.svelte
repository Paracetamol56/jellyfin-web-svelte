<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { session } from '#lib/api/session.svelte.ts';
	import { fetchItem } from '#lib/api/queries.ts';
	import { deleteItem } from '#lib/item-actions.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';

	let { item, open = $bindable() }: { item: BaseItemDto; open: boolean } = $props();

	const full = createQuery(() => ({ queryKey: ['item', session.userId, item.Id], queryFn: () => fetchItem(item.Id!), staleTime: 0 }));
	const paths = $derived((full.data?.MediaSources ?? []).map((s) => s.Path).filter(Boolean) as string[]);
	const container = $derived(['Series', 'Season', 'MusicAlbum', 'MusicArtist', 'BoxSet', 'Folder'].includes(item.Type ?? ''));
	const allowed = $derived(full.data ? full.data.CanDelete !== false : true);
	let busy = $state(false);

	async function confirm() {
		busy = true;
		try {
			const parent = full.data?.SeriesId ?? full.data?.AlbumId ?? full.data?.ParentId;
			await deleteItem(item);
			open = false;
			if (page.params.id === item.Id) goto(parent ? resolve('/item/[id]', { id: parent }) : resolve('/'), { replace: true });
		} catch {
			toasts.error("Couldn't delete this item. Check the server's permissions on its files.");
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title="Delete “{item.Name}”?" description="This permanently removes the files from the server's disk. It can't be undone.">
	{#if full.data && !allowed}
		<p role="alert" class="text-destructive text-sm">The server doesn't allow deleting this item.</p>
	{:else}
		{#if container}
			<p class="text-sm">Everything inside it (episodes, tracks…) is deleted too.</p>
		{/if}
		{#if paths.length}
			<ul class="bg-muted mt-3 flex flex-col gap-1 rounded-xl p-3 font-mono text-xs break-all">
				{#each paths as p (p)}<li>{p}</li>{/each}
			</ul>
		{/if}
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button class="bg-destructive hover:bg-destructive/90 text-white" disabled={busy || !allowed} onclick={confirm}>{busy ? 'Deleting…' : 'Delete'}</Button>
	{/snippet}
</Dialog>
