<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Tabs } from 'bits-ui';
	import Settings from '@lucide/svelte/icons/settings';
	import { resolve } from '$app/paths';
	import type { PluginInfo } from '@jellyfin/sdk/lib/generated-client/models';
	import {
		adminKeys,
		disablePlugin,
		enablePlugin,
		getPackages,
		getConfigPages,
		getPlugins,
		primaryConfigPage,
		getRepositories,
		installPackage,
		pluginImageUrl,
		setRepositories,
		uninstallPlugin
	} from '#lib/admin/api.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import { input, pill } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	let tab = $state('installed');
	const plugins = createQuery(() => ({ queryKey: adminKeys.plugins, queryFn: getPlugins }));
	const packages = createQuery(() => ({ queryKey: adminKeys.packages, queryFn: getPackages, staleTime: 600_000 }));
	const configPages = createQuery(() => ({ queryKey: ['admin', 'configPages'], queryFn: getConfigPages, staleTime: 300_000 }));
	const settingsHref = (id: string | null | undefined) => {
		const pg = id ? primaryConfigPage(configPages.data ?? [], id) : null;
		return pg?.Name ? resolve('/admin/plugins/page') + `?name=${encodeURIComponent(pg.Name)}` : null;
	};
	const repos = createQuery(() => ({ queryKey: adminKeys.repos, queryFn: getRepositories, enabled: tab === 'repos' }));

	const latest = (guid: string | null | undefined) => packages.data?.find((p) => p.guid === guid)?.versions?.[0];
	const installedIds = $derived(new Set((plugins.data ?? []).map((p) => p.Id)));
	const sortedPlugins = $derived([...(plugins.data ?? [])].sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? '')));
	const updates = $derived(sortedPlugins.filter((p) => { const v = latest(p.Id); return v?.version && v.version !== p.Version; }));
	const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.plugins });

	async function toggle(p: PluginInfo) {
		await (p.Status === 'Disabled' ? enablePlugin(p.Id!, p.Version!) : disablePlugin(p.Id!, p.Version!));
		toasts.show(`${p.Name} ${p.Status === 'Disabled' ? 'enabled' : 'disabled'}. Restart the server to apply.`);
		refresh();
	}
	async function uninstall(p: PluginInfo) {
		if (!(await confirm({ title: `Uninstall ${p.Name}?`, body: 'It is removed after the next restart.', confirmLabel: 'Uninstall', destructive: true }))) return;
		await uninstallPlugin(p.Id!, p.Version!);
		toasts.show(`${p.Name} will be removed after a restart`);
		refresh();
	}
	async function install(name: string, guid: string, version: string, repositoryUrl?: string | null) {
		await installPackage(name, guid, version, repositoryUrl ?? undefined);
		toasts.show(`Installing ${name} ${version}. Restart the server when it's done.`);
		setTimeout(refresh, 3000);
	}

	// Catalog
	let search = $state('');
	let category = $state('');
	const categories = $derived([...new Set((packages.data ?? []).map((p) => p.category ?? 'Other'))].sort());
	const catalog = $derived(
		(packages.data ?? [])
			.filter((p) => (!category || (p.category ?? 'Other') === category) && (!search || `${p.name} ${p.overview}`.toLowerCase().includes(search.toLowerCase())))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
	);

	// Repositories
	let repoName = $state('');
	let repoUrl = $state('');
	async function saveRepos(next: { Name: string; Url: string; Enabled: boolean }[]) {
		await setRepositories(next);
		queryClient.invalidateQueries({ queryKey: adminKeys.repos });
		queryClient.invalidateQueries({ queryKey: adminKeys.packages });
	}
	const current = () => (repos.data ?? []).map((r) => ({ Name: r.Name ?? '', Url: r.Url ?? '', Enabled: r.Enabled !== false }));
	async function addRepo(e: SubmitEvent) {
		e.preventDefault();
		await saveRepos([...current(), { Name: repoName.trim(), Url: repoUrl.trim(), Enabled: true }]);
		repoName = repoUrl = '';
		toasts.show('Repository added');
	}

	const statusTone: Record<string, string> = { Active: 'bg-primary/15 text-primary', Disabled: 'bg-secondary text-muted-foreground', Restart: 'bg-[#E8A23A]/15 text-[#B5701A] dark:text-[#E8A23A]', Malfunctioned: 'bg-destructive/15 text-destructive', NotSupported: 'bg-destructive/15 text-destructive' };
	const statusLabel: Record<string, string> = { Restart: 'Restart needed', NotSupported: 'Not supported', Malfunctioned: 'Failed to load' };
	const tabsList = 'border-border flex gap-1 border-b';
	const trigger = 'text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary -mb-px cursor-pointer border-b-2 border-transparent px-3 py-3 text-[15px] data-[state=active]:font-semibold';
</script>

<header>
	<h1 class="text-4xl font-extrabold">Plugins</h1>
	<p class="text-muted-foreground mt-1 text-sm">Extend the server with metadata providers, authentication, notifications and more.</p>
</header>

<Tabs.Root bind:value={tab} class="flex flex-col gap-6">
	<Tabs.List class={tabsList}>
		<Tabs.Trigger value="installed" class={trigger}>Installed{plugins.data ? ` (${plugins.data.length})` : ''}</Tabs.Trigger>
		<Tabs.Trigger value="catalog" class={trigger}>Catalog</Tabs.Trigger>
		<Tabs.Trigger value="repos" class={trigger}>Repositories</Tabs.Trigger>
	</Tabs.List>

	<Tabs.Content value="installed" class="flex flex-col gap-6">
		{#if updates.length}
			<div role="status" class="border-primary/40 bg-primary/10 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4">
				<p class="flex-1"><strong>{updates.length} {updates.length === 1 ? 'update' : 'updates'} available</strong> · {updates.map((u) => u.Name).join(', ')}</p>
			</div>
		{/if}
		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			{#if plugins.isPending}{#each { length: 4 } as _, i (i)}<Skeleton class="h-32 rounded-[20px]" />{/each}{/if}
			{#each sortedPlugins as p (`${p.Id}-${p.Version}`)}
				{@const next = latest(p.Id)}
				<article class="bg-card border-border flex gap-4 rounded-[20px] border p-5">
					<span class="bg-muted text-muted-foreground grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl">
						{#if p.HasImage}<img src={pluginImageUrl(p.Id!, p.Version!)} alt="" class="size-full object-cover" />{:else}<Puzzle class="size-6" aria-hidden="true" />{/if}
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-bold">{p.Name}</h2>
							<span class="text-muted-foreground text-sm">{p.Version}</span>
							<span class="{pill} {statusTone[p.Status ?? ''] ?? 'bg-secondary'}">{statusLabel[p.Status ?? ''] ?? p.Status}</span>
						</div>
						{#if p.Description}<p class="text-muted-foreground line-clamp-2 text-sm">{p.Description}</p>{/if}
						<div class="flex flex-wrap gap-2">
							{#if settingsHref(p.Id) && p.Status === 'Active'}
								<Button size="sm" variant="secondary" href={settingsHref(p.Id)!}><Settings aria-hidden="true" />Settings</Button>
							{/if}
							{#if next?.version && next.version !== p.Version}
								<Button size="sm" onclick={() => install(p.Name!, p.Id!, next.version!, next.repositoryUrl)}>Update to {next.version}</Button>
							{/if}
							{#if p.Status === 'Active' || p.Status === 'Disabled'}
								<Button variant="outline" size="sm" onclick={() => toggle(p)}>{p.Status === 'Disabled' ? 'Enable' : 'Disable'}</Button>
							{/if}
							{#if p.CanUninstall}
								<Button variant="ghost" size="sm" onclick={() => uninstall(p)}><Trash2 aria-hidden="true" />Uninstall</Button>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	</Tabs.Content>

	<Tabs.Content value="catalog" class="flex flex-col gap-5">
		<div class="flex flex-wrap items-center gap-2">
			<label for="plugin-search" class="sr-only">Search plugins</label>
			<input id="plugin-search" type="search" class="{input} max-w-sm" bind:value={search} placeholder="Search plugins" />
			<div role="group" aria-label="Category" class="flex flex-wrap gap-1.5">
				{#each ['', ...categories] as cat (cat)}
					<button type="button" aria-pressed={category === cat} onclick={() => (category = cat)} class="border-border aria-pressed:bg-secondary h-9 cursor-pointer rounded-full border px-3.5 text-sm aria-pressed:border-transparent aria-pressed:font-semibold">{cat || 'All'}</button>
				{/each}
			</div>
		</div>
		{#if packages.isPending}<Skeleton class="h-60" />{/if}
		{#if packages.isError}<p role="alert" class="text-destructive">Couldn't load the catalog. Check the repositories.</p>{/if}
		<ul class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
			{#each catalog as pkg (pkg.guid)}
				{@const v = pkg.versions?.[0]}
				<li class="bg-card border-border flex flex-col gap-2 rounded-[20px] border p-5">
					<div class="flex items-start gap-3">
						<span class="bg-muted text-muted-foreground grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl">
							{#if pkg.imageUrl}<img src={pkg.imageUrl} alt="" loading="lazy" class="size-full object-cover" />{:else}<Puzzle class="size-5" aria-hidden="true" />{/if}
						</span>
						<div class="min-w-0 flex-1">
							<h3 class="font-bold">{pkg.name}</h3>
							<p class="text-muted-foreground text-xs">{pkg.category} · {pkg.owner}{v?.version ? ` · ${v.version}` : ''}</p>
						</div>
					</div>
					<p class="text-muted-foreground line-clamp-3 flex-1 text-sm">{pkg.overview || pkg.description}</p>
					{#if installedIds.has(pkg.guid)}
						<span class="{pill} bg-secondary text-muted-foreground w-fit">Installed</span>
					{:else if v?.version}
						<Button size="sm" variant="outline" class="w-fit" onclick={() => install(pkg.name!, pkg.guid!, v.version!, v.repositoryUrl)}>Install</Button>
					{/if}
				</li>
			{/each}
		</ul>
	</Tabs.Content>

	<Tabs.Content value="repos" class="flex flex-col gap-6">
		<Section title="Repositories" description="Where the catalog comes from. Only add repositories you trust: plugins run with full server access.">
			<ul class="divide-border flex flex-col divide-y">
				{#each repos.data ?? [] as r, i (r.Url)}
					<li class="flex flex-wrap items-center gap-3 py-3">
						<div class="min-w-0 flex-1"><p class="font-medium">{r.Name}</p><p class="text-muted-foreground truncate font-mono text-xs">{r.Url}</p></div>
						<Button variant="ghost" size="sm" onclick={async () => { if (await confirm({ title: `Remove ${r.Name}?`, confirmLabel: 'Remove', destructive: true })) saveRepos(current().filter((_, k) => k !== i)); }}>Remove</Button>
					</li>
				{/each}
			</ul>
			<form onsubmit={addRepo} class="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
				<Field label="Name">{#snippet children(id)}<input {id} class={input} required bind:value={repoName} />{/snippet}</Field>
				<Field label="Manifest URL">{#snippet children(id)}<input {id} type="url" class="{input} font-mono text-sm" required bind:value={repoUrl} placeholder="https://…/manifest.json" />{/snippet}</Field>
				<Button type="submit">Add</Button>
			</form>
		</Section>
	</Tabs.Content>
</Tabs.Root>
