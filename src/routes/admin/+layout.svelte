<script lang="ts">
	import Activity from '@lucide/svelte/icons/activity';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Library from '@lucide/svelte/icons/library';
	import MonitorPlay from '@lucide/svelte/icons/monitor-play';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Server from '@lucide/svelte/icons/server';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { session } from '#lib/api/session.svelte.ts';
	import { createQuery } from '@tanstack/svelte-query';
	import { adminKeys, getActiveSessions, getConfigPages } from '#lib/admin/api.ts';
	import { live } from '#lib/admin/live.svelte.ts';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import { hashParams } from '#lib/hash-params.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Grouped by what you're trying to do, not by server subsystem.
	const groups = [
		{
			label: null,
			items: [
				{ href: resolve('/admin'), id: '/admin', label: 'Overview', icon: LayoutDashboard },
				{ href: resolve('/admin/statistics'), id: '/admin/statistics', label: 'Statistics', icon: ChartColumn }
			]
		},
		{
			label: 'People',
			items: [
				{ href: resolve('/admin/users'), id: '/admin/users', label: 'Users', icon: Users },
				{ href: resolve('/admin/devices'), id: '/admin/devices', label: 'Devices & API keys', icon: Smartphone }
			]
		},
		{
			label: 'Content',
			items: [
				{ href: resolve('/admin/libraries'), id: '/admin/libraries', label: 'Libraries', icon: Library },
				{ href: resolve('/admin/playback'), id: '/admin/playback', label: 'Playback & transcoding', icon: MonitorPlay }
			]
		},
		{
			label: 'System',
			items: [
				{ href: resolve('/admin/server'), id: '/admin/server', label: 'Server settings', icon: Server },
				{ href: resolve('/admin/plugins'), id: '/admin/plugins', label: 'Plugins', icon: Puzzle },
				{ href: resolve('/admin/tasks'), id: '/admin/tasks', label: 'Scheduled tasks', icon: CalendarClock },
				{ href: resolve('/admin/activity'), id: '/admin/activity', label: 'Activity & logs', icon: Activity }
			]
		}
	];
	// Sample running streams every few seconds while any dashboard page is open (feeds the live chart).
	const sessions = createQuery(() => ({ queryKey: adminKeys.sessions, queryFn: getActiveSessions, refetchInterval: 5_000, enabled: session.isAdmin }));
	$effect(() => {
		const at = sessions.dataUpdatedAt;
		if (sessions.data && at) live.record(sessions.data, at);
	});

	// Plugins can ask for a dashboard menu entry (EnableInMainMenu), as in the stock client.
	const configPages = createQuery(() => ({ queryKey: ['admin', 'configPages'], queryFn: getConfigPages, staleTime: 300_000, enabled: session.isAdmin }));
	const pluginMenu = $derived(
		(configPages.data ?? [])
			.filter((p) => p.EnableInMainMenu && p.Name && !/\.(js|css)$/i.test(p.Name))
			.sort((a, b) => (a.DisplayName ?? a.Name ?? '').localeCompare(b.DisplayName ?? b.Name ?? ''))
	);
	const pageName = $derived(page.route.id === '/admin/plugins/page' ? hashParams().get('name') : null);
	const current = (id: string) =>
		id === '/admin' ? page.route.id === '/admin' : id === '/admin/plugins' ? page.route.id === '/admin/plugins' : page.route.id?.startsWith(id);
	const link =
		'flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:font-semibold aria-[current=page]:text-foreground';
</script>

<svelte:head><title>Dashboard · Jellyfin</title></svelte:head>

{#if !session.isAdmin}
	<main class="mx-auto max-w-[860px] px-4 py-16 md:px-10">
		<h1 class="text-3xl font-extrabold">Administrators only</h1>
		<p class="text-muted-foreground mt-2">Your account can't manage this server.</p>
	</main>
{:else}
	<div class="mx-auto flex max-w-[1440px] gap-8 px-4 pt-6 pb-18 md:px-10">
		<nav aria-label="Dashboard" class="sticky top-6 hidden w-60 shrink-0 self-start lg:block">
			<p class="font-display mb-4 px-3 text-2xl font-extrabold">Dashboard</p>
			{#each groups as g, i (i)}
				{#if g.label}<p class="text-muted-foreground mt-5 mb-1.5 px-3 text-[11px] font-bold tracking-[0.12em] uppercase">{g.label}</p>{/if}
				<ul class="flex flex-col gap-0.5">
					{#each g.items as it (it.id)}
						<li>
							<a href={it.href} class={link} aria-current={current(it.id) ? 'page' : undefined}><it.icon class="size-[18px]" aria-hidden="true" />{it.label}</a>
						</li>
					{/each}
				</ul>
			{/each}
			{#if pluginMenu.length}
				<p class="text-muted-foreground mt-5 mb-1.5 px-3 text-[11px] font-bold tracking-[0.12em] uppercase">Plugin pages</p>
				<ul class="flex flex-col gap-0.5">
					{#each pluginMenu as pg (pg.Name)}
						<li>
							<a href={resolve('/admin/plugins/page') + `?name=${encodeURIComponent(pg.Name!)}`} class="{link} pl-4" aria-current={pageName === pg.Name ? 'page' : undefined}>
								<Puzzle class="size-4 opacity-70" aria-hidden="true" /><span class="truncate">{pg.DisplayName || pg.Name}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</nav>
		<div class="flex min-w-0 flex-1 flex-col gap-6">
			<nav aria-label="Dashboard sections" class="-mx-4 overflow-x-auto px-4 lg:hidden">
				<ul class="flex gap-2">
					{#each groups.flatMap((g) => g.items) as it (it.id)}
						<li>
							<a href={it.href} aria-current={current(it.id) ? 'page' : undefined} class="border-border aria-[current=page]:bg-secondary flex h-10 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap aria-[current=page]:border-transparent aria-[current=page]:font-semibold">
								<it.icon class="size-4" aria-hidden="true" />{it.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
			{@render children()}
		</div>
	</div>
{/if}
