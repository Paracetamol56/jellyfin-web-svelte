<script lang="ts">
	import { untrack } from 'svelte';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Folder from '@lucide/svelte/icons/folder';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import { DropdownMenu } from 'bits-ui';
	import type { CultureDto, CountryInfo, LibraryOptions, VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models';
	import { addLibraryPath, adminKeys, removeLibrary, removeLibraryPath, renameLibrary, scanLibrary, updateLibraryOptions } from '#lib/admin/api.ts';
	import { Draft } from '#lib/admin/draft.svelte.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { menuContent } from '#lib/components/menu/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import Field from './Field.svelte';
	import FolderPicker from './FolderPicker.svelte';
	import Meter from './Meter.svelte';
	import Toggle from './Toggle.svelte';
	import { select } from './styles.ts';

	let { lib, cultures, countries }: { lib: VirtualFolderInfo; cultures: CultureDto[]; countries: CountryInfo[] } = $props();

	const TYPES: Record<string, string> = { movies: 'Movies', tvshows: 'Shows', music: 'Music', musicvideos: 'Music videos', homevideos: 'Home videos & photos', boxsets: 'Collections', books: 'Books', mixed: 'Mixed' };
	const options = new Draft<LibraryOptions>();
	// Reload from the server only when its copy changes, and never over unsaved edits.
	let loadedFrom = '';
	$effect(() => {
		const src = JSON.stringify(lib.LibraryOptions ?? null);
		if (!lib.LibraryOptions || src === loadedFrom) return;
		if (untrack(() => options.dirty)) return;
		loadedFrom = src;
		options.load(lib.LibraryOptions);
	});
	const o = $derived(options.value);
	const scanning = $derived(lib.RefreshStatus === 'Running' || (lib.RefreshProgress ?? 0) > 0 && (lib.RefreshProgress ?? 0) < 100);
	let picking = $state(false);
	let showOptions = $state(false);
	const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.libraries });

	async function scan() {
		await scanLibrary(lib.ItemId!);
		toasts.show(`Scanning ${lib.Name}`);
		setTimeout(refresh, 1000);
	}
	async function addPath(p: string) {
		await addLibraryPath(lib.Name!, p);
		toasts.show(`Added ${p}. Scanning…`);
		refresh();
	}
	async function removePath(p: string) {
		if (!(await confirm({ title: 'Remove this folder?', body: `${p}\nItems from it disappear from ${lib.Name}. The files stay on disk.`, confirmLabel: 'Remove folder', destructive: true }))) return;
		await removeLibraryPath(lib.Name!, p);
		refresh();
	}
	async function rename() {
		const n = await confirm({ title: `Rename ${lib.Name}`, input: { label: 'New name' }, confirmLabel: 'Rename' });
		if (typeof n !== 'string' || !n.trim()) return;
		await renameLibrary(lib.Name!, n.trim());
		toasts.show(`Renamed to ${n.trim()}`);
		refresh();
	}
	async function remove() {
		if (!(await confirm({ title: `Remove the ${lib.Name} library?`, body: 'Its items, watch history and metadata are removed from Jellyfin. Your media files stay on disk.', confirmLabel: 'Remove library', destructive: true }))) return;
		await removeLibrary(lib.Name!);
		toasts.show(`Removed ${lib.Name}`);
		refresh();
	}
	async function saveOptions() {
		try {
			await options.commit((v) => updateLibraryOptions(lib.ItemId!, v));
			toasts.show(`Saved ${lib.Name} options`);
			refresh();
		} catch {
			toasts.error("Couldn't save the library options.");
		}
	}
	const video = $derived(['movies', 'tvshows', 'musicvideos', 'homevideos', 'mixed'].includes(lib.CollectionType ?? 'mixed'));
	const item = 'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-highlighted:bg-accent';
</script>

<article class="bg-card border-border flex flex-col gap-4 rounded-[20px] border p-5 md:p-6" aria-labelledby="lib-{lib.ItemId}">
	<div class="flex flex-wrap items-start gap-3">
		<div class="min-w-0 flex-1">
			<h2 id="lib-{lib.ItemId}" class="text-xl font-bold">{lib.Name}</h2>
			{#if (TYPES[lib.CollectionType ?? 'mixed'] ?? lib.CollectionType) !== lib.Name}<p class="text-muted-foreground text-sm">{TYPES[lib.CollectionType ?? 'mixed'] ?? lib.CollectionType}</p>{/if}
		</div>
		<Button variant="outline" size="sm" disabled={scanning} onclick={scan}><RefreshCw class={scanning ? 'animate-spin' : ''} aria-hidden="true" />{scanning ? 'Scanning…' : 'Scan'}</Button>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="hover:bg-accent grid size-9 cursor-pointer place-items-center rounded-full" aria-label="More for {lib.Name}"><Ellipsis class="size-5" /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content align="end" sideOffset={6} class={menuContent}>
					<DropdownMenu.Item class={item} onSelect={rename}>Rename…</DropdownMenu.Item>
					<DropdownMenu.Item class="{item} text-destructive" onSelect={remove}>Remove library…</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</div>

	{#if scanning}
		<div class="flex items-center gap-3"><Meter value={lib.RefreshProgress ?? 0} label="{lib.Name} scan progress" /><span class="text-muted-foreground text-xs tabular-nums">{Math.round(lib.RefreshProgress ?? 0)}%</span></div>
	{/if}

	<div>
		<h3 class="text-muted-foreground mb-1.5 font-sans text-xs font-bold tracking-[0.1em] uppercase">Folders</h3>
		<ul class="flex flex-col gap-1">
			{#each lib.Locations ?? [] as path (path)}
				<li class="bg-background flex items-center gap-2 rounded-xl py-1 pr-1 pl-3">
					<Folder class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
					<span class="min-w-0 flex-1 truncate font-mono text-[13px]">{path}</span>
					<Button variant="ghost" size="icon" aria-label="Remove {path} from {lib.Name}" onclick={() => removePath(path)}><X class="size-4" /></Button>
				</li>
			{/each}
		</ul>
		<Button variant="ghost" size="sm" class="mt-1 -ml-2" onclick={() => (picking = true)}><FolderPlus aria-hidden="true" />Add folder</Button>
	</div>

	{#if o}
		<button type="button" class="text-primary w-fit cursor-pointer text-sm font-semibold hover:underline" aria-expanded={showOptions} onclick={() => (showOptions = !showOptions)}>
			{showOptions ? 'Hide options' : 'Options'}
		</button>
		{#if showOptions}
			<div class="flex flex-col gap-5">
				<div class="grid gap-4 sm:grid-cols-2">
					<Field label="Metadata language">
						{#snippet children(id)}
							<select {id} class={select} bind:value={o.PreferredMetadataLanguage}>
								<option value="">Server default</option>
								{#each cultures as c, i (i)}<option value={c.TwoLetterISOLanguageName}>{c.DisplayName}</option>{/each}
							</select>
						{/snippet}
					</Field>
					<Field label="Country">
						{#snippet children(id)}
							<select {id} class={select} bind:value={o.MetadataCountryCode}>
								<option value="">Server default</option>
								{#each countries as c, i (i)}<option value={c.TwoLetterISORegionName}>{c.DisplayName}</option>{/each}
							</select>
						{/snippet}
					</Field>
					<Field label="Refresh metadata automatically">
						{#snippet children(id)}
							<select {id} class={select} bind:value={o.AutomaticRefreshIntervalDays}>
								<option value={0}>Never</option><option value={30}>Every 30 days</option><option value={60}>Every 60 days</option><option value={90}>Every 90 days</option>
							</select>
						{/snippet}
					</Field>
				</div>
				<div class="divide-border flex flex-col divide-y">
					<Toggle bind:checked={o.EnableRealtimeMonitor} label="Watch folders for changes" description="New and removed files show up right away instead of at the next scan." />
					<Toggle bind:checked={o.EnableInternetProviders} label="Download metadata from the internet" />
					<Toggle bind:checked={o.SaveLocalMetadata} label="Save artwork and NFO files next to media" description="Keeps metadata if you move servers. Needs write access to the folders." />
					{#if video}
						<Toggle bind:checked={o.EnableEmbeddedTitles} label="Prefer titles embedded in files" />
						<Toggle bind:checked={o.EnableChapterImageExtraction} label="Extract chapter images" description="Thumbnails for the chapter list. CPU-heavy on first scan." />
						<Toggle bind:checked={o.EnableTrickplayImageExtraction} label="Generate seek-bar previews (trickplay)" description="CPU-heavy and uses disk space." />
						<Toggle bind:checked={o.SaveSubtitlesWithMedia} label="Save downloaded subtitles next to media" />
					{/if}
					{#if lib.CollectionType === 'tvshows'}
						<Toggle bind:checked={o.EnableAutomaticSeriesGrouping} label="Merge series spread across folders" />
					{/if}
					{#if lib.CollectionType === 'music'}
						<Toggle bind:checked={o.SaveLyricsWithMedia} label="Save downloaded lyrics next to media" />
						<Toggle bind:checked={o.EnableLUFSScan} label="Analyse loudness (normalisation)" />
						<Toggle bind:checked={o.PreferNonstandardArtistsTag} label="Prefer the ARTISTS tag" />
					{/if}
				</div>
				{#if options.dirty}
					<div class="flex gap-2">
						<Button disabled={options.saving} onclick={saveOptions}>{options.saving ? 'Saving…' : 'Save options'}</Button>
						<Button variant="ghost" onclick={() => options.reset()}>Discard</Button>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</article>

<FolderPicker bind:open={picking} title="Add a folder to {lib.Name}" onpick={addPath} />
