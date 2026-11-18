<script lang="ts">
	import { dialogs } from '#lib/dialogs.svelte.ts';
	import DeleteDialog from './DeleteDialog.svelte';
	import EditMetadataDialog from './EditMetadataDialog.svelte';
	import MediaInfoDialog from './MediaInfoDialog.svelte';
	import PlaylistDialog from './PlaylistDialog.svelte';

	const item = $derived(dialogs.items[0]);
	const openFor = (kind: typeof dialogs.kind) => ({
		get value() {
			return dialogs.kind === kind;
		},
		set value(v: boolean) {
			if (!v) dialogs.close();
		}
	});
	const info = openFor('info');
	const edit = openFor('edit');
	const del = openFor('delete');
	const pl = openFor('playlist');
</script>

{#if item && dialogs.kind === 'info'}<MediaInfoDialog {item} bind:open={info.value} />{/if}
{#if item && dialogs.kind === 'edit'}<EditMetadataDialog {item} bind:open={edit.value} />{/if}
{#if item && dialogs.kind === 'delete'}<DeleteDialog {item} bind:open={del.value} />{/if}
{#if dialogs.kind === 'playlist'}<PlaylistDialog items={dialogs.items} bind:open={pl.value} />{/if}
