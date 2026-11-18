<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { resolve } from '$app/paths';
	import { adminKeys, getConfigPages, getPlugins, getSystemInfo } from '#lib/admin/api.ts';
	import { hashParams } from '#lib/hash-params.svelte.ts';
	import PluginPageFrame from '#lib/components/admin/PluginPageFrame.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const name = $derived(hashParams().get('name') ?? '');
	const pages = createQuery(() => ({ queryKey: ['admin', 'configPages'], queryFn: getConfigPages, staleTime: 300_000 }));
	const plugins = createQuery(() => ({ queryKey: adminKeys.plugins, queryFn: getPlugins }));
	const system = createQuery(() => ({ queryKey: adminKeys.system, queryFn: getSystemInfo }));
	const info = $derived(pages.data?.find((p) => p.Name?.toLowerCase() === name.toLowerCase()));
	const plugin = $derived(plugins.data?.find((p) => p.Id === info?.PluginId));
	const title = $derived(info?.DisplayName || plugin?.Name || name);
</script>

<svelte:head><title>{title} · Dashboard · Jellyfin</title></svelte:head>

<a href={resolve('/admin/plugins')} class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"><ArrowLeft class="size-4" aria-hidden="true" />Plugins</a>

<header>
	<h1 class="text-4xl font-extrabold">{title}</h1>
	<p class="text-muted-foreground mt-1 text-sm">
		{#if plugin}Settings provided by the {plugin.Name} plugin · version {plugin.Version}{:else}&nbsp;{/if}
	</p>
</header>

<div class="bg-card border-border rounded-[20px] border p-5 md:p-6">
	{#if pages.isPending}
		<Skeleton class="h-64" />
	{:else if !name || (pages.data && !info)}
		<p role="alert" class="text-destructive">No plugin page called “{name}”. The plugin may have been removed or updated.</p>
	{:else}
		{#key name}
			<PluginPageFrame {name} {title} serverVersion={system.data?.Version ?? undefined} />
		{/key}
	{/if}
</div>
