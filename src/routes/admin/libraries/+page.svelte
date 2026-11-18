<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Folder from '@lucide/svelte/icons/folder';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import type { CollectionTypeOptions } from '@jellyfin/sdk/lib/generated-client/models';
	import { addLibrary, adminKeys, getLibraries, getLocalization, scanAll } from '#lib/admin/api.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import FolderPicker from '#lib/components/admin/FolderPicker.svelte';
	import LibraryCard from '#lib/components/admin/LibraryCard.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { input, select } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const libraries = createQuery(() => ({
		queryKey: adminKeys.libraries,
		queryFn: getLibraries,
		// Poll while a scan runs so progress bars move.
		refetchInterval: (q) => ((q.state.data ?? []).some((l) => l.RefreshStatus === 'Running') ? 2000 : 15_000)
	}));
	const loc = createQuery(() => ({ queryKey: adminKeys.localization, queryFn: getLocalization, staleTime: Infinity }));

	async function scanEverything() {
		await scanAll();
		toasts.show('Scanning all libraries');
		setTimeout(() => queryClient.invalidateQueries({ queryKey: adminKeys.libraries }), 1500);
	}

	let adding = $state(false);
	let picking = $state(false);
	let name = $state('');
	let type = $state<CollectionTypeOptions>('movies');
	let paths = $state<string[]>([]);
	let realtime = $state(true);
	let busy = $state(false);
	function startAdd() {
		name = '';
		type = 'movies';
		paths = [];
		realtime = true;
		adding = true;
	}
	async function add(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		try {
			await addLibrary(name.trim(), type, paths, { EnableRealtimeMonitor: realtime, EnableInternetProviders: true, Enabled: true });
			toasts.show(`Added ${name.trim()}. The first scan has started.`);
			adding = false;
			queryClient.invalidateQueries({ queryKey: adminKeys.libraries });
		} catch {
			toasts.error("Couldn't add the library. Check the name isn't already used.");
		} finally {
			busy = false;
		}
	}
	const TYPE_OPTIONS: [CollectionTypeOptions, string][] = [
		['movies', 'Movies'], ['tvshows', 'Shows'], ['music', 'Music'], ['musicvideos', 'Music videos'], ['homevideos', 'Home videos & photos'], ['books', 'Books'], ['boxsets', 'Collections'], ['mixed', 'Mixed movies & shows']
	];
</script>

<header class="flex flex-wrap items-end gap-3">
	<div class="flex-1">
		<h1 class="text-4xl font-extrabold">Libraries</h1>
		<p class="text-muted-foreground mt-1 text-sm">Where your media lives and how it's scanned.</p>
	</div>
	<Button variant="outline" onclick={scanEverything}><RefreshCw aria-hidden="true" />Scan all</Button>
	<Button onclick={startAdd}><Plus aria-hidden="true" />Add library</Button>
</header>

<div class="grid grid-cols-1 gap-5 2xl:grid-cols-2">
	{#if libraries.isPending}
		{#each { length: 3 } as _, i (i)}<Skeleton class="h-56 rounded-[20px]" />{/each}
	{/if}
	{#each libraries.data ?? [] as lib (lib.ItemId)}
		<LibraryCard {lib} cultures={loc.data?.cultures ?? []} countries={loc.data?.countries ?? []} />
	{/each}
</div>

<Dialog bind:open={adding} title="Add library" description="It's scanned as soon as you add it.">
	<form id="add-lib" onsubmit={add} class="flex flex-col gap-4">
		<Field label="Name">{#snippet children(id)}<input {id} class={input} required bind:value={name} />{/snippet}</Field>
		<Field label="Content type" hint="Decides how files are matched and which metadata is fetched.">
			{#snippet children(id, hint)}
				<select {id} aria-describedby={hint} class={select} bind:value={type}>
					{#each TYPE_OPTIONS as [v, l] (v)}<option value={v}>{l}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<div class="flex flex-col gap-1.5">
			<span class="text-sm font-semibold">Folders</span>
			<ul class="flex flex-col gap-1">
				{#each paths as p (p)}
					<li class="bg-background flex items-center gap-2 rounded-xl py-1 pr-1 pl-3">
						<Folder class="text-muted-foreground size-4" aria-hidden="true" /><span class="flex-1 truncate font-mono text-[13px]">{p}</span>
						<Button variant="ghost" size="icon" aria-label="Remove {p}" onclick={() => (paths = paths.filter((x) => x !== p))}><X class="size-4" /></Button>
					</li>
				{/each}
			</ul>
			<Button variant="outline" size="sm" class="w-fit" onclick={() => (picking = true)}><Plus aria-hidden="true" />Add folder</Button>
		</div>
		<Toggle bind:checked={realtime} label="Watch folders for changes" />
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (adding = false)}>Cancel</Button>
		<Button type="submit" form="add-lib" disabled={busy || !name.trim() || !paths.length}>{busy ? 'Adding…' : 'Add library'}</Button>
	{/snippet}
</Dialog>
<FolderPicker bind:open={picking} onpick={(p) => !paths.includes(p) && (paths = [...paths, p])} />
