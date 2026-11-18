<script lang="ts">
	// Browse folders on the server's disk and pick one.
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Folder from '@lucide/svelte/icons/folder';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import { listDirectory, parentPath } from '#lib/admin/api.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { input } from './styles.ts';

	let { open = $bindable(false), onpick, title = 'Choose a folder' }: { open?: boolean; onpick: (path: string) => void; title?: string } = $props();

	let path = $state('');
	let typed = $state('');
	$effect(() => {
		typed = path;
	});
	const entries = createQuery(() => ({ queryKey: ['admin', 'fs', path], queryFn: () => listDirectory(path), enabled: open }));

	async function up() {
		if (!path) return;
		const parent = await parentPath(path).catch(() => null);
		path = parent ?? '';
	}
	function choose(p: string) {
		onpick(p);
		open = false;
	}
</script>

<Dialog bind:open {title} description="Folders on the server, not on this device." wide>
	<form class="flex gap-2" onsubmit={(e) => (e.preventDefault(), (path = typed.trim()))}>
		<label for="fp-path" class="sr-only">Path</label>
		<input id="fp-path" class="{input} font-mono text-sm" bind:value={typed} placeholder="/media" />
		<Button type="submit" variant="outline">Go</Button>
	</form>
	<div class="border-border mt-3 rounded-xl border">
		<div class="border-border flex items-center gap-2 border-b px-2 py-1.5">
			<Button variant="ghost" size="icon" aria-label="Parent folder" disabled={!path} onclick={up}><ArrowUp /></Button>
			<span class="truncate font-mono text-sm">{path || 'Drives'}</span>
		</div>
		<ul class="max-h-80 overflow-y-auto p-1">
			{#if entries.isPending}<li class="text-muted-foreground px-3 py-2 text-sm">Loading…</li>{/if}
			{#if entries.isError}<li class="text-destructive px-3 py-2 text-sm" role="alert">Can't open this folder.</li>{/if}
			{#each entries.data ?? [] as e (e.Path)}
				<li>
					<button type="button" class="hover:bg-accent flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm" onclick={() => (path = e.Path ?? '')}>
						{#if path}<Folder class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />{:else}<HardDrive class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />{/if}
						<span class="truncate">{e.Name}</span>
					</button>
				</li>
			{:else}
				{#if entries.data}<li class="text-muted-foreground px-3 py-2 text-sm">No sub-folders.</li>{/if}
			{/each}
		</ul>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		<Button disabled={!path} onclick={() => choose(path)}>Use this folder</Button>
	{/snippet}
</Dialog>
