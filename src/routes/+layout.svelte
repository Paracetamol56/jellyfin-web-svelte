<script lang="ts">
	import '../app.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { queryClient } from '#lib/query-client.ts';
	import Dialogs from '#lib/components/dialogs/Dialogs.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import ConfirmHost from '#lib/components/ConfirmHost.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { session } from '#lib/api/session.svelte.ts';
	import AppShell from '#lib/components/AppShell.svelte';
	import LoadingScreen from '#lib/components/LoadingScreen.svelte';
	import { boot } from '#lib/boot.svelte.ts';
	import { fade } from 'svelte/transition';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();


	session.restore();
	boot.start();

	const onLogin = $derived(page.route.id === '/login');

	$effect(() => {
		if (session.ready) boot.sessionReady(!!session.user);
	});

	$effect(() => {
		if (!session.ready) return;
		if (!session.user && !onLogin) goto(resolve('/login'), { replace: true });
		else if (session.user && onLogin) goto(resolve('/'), { replace: true });
	});
</script>

<svelte:head>
	<title>Jellyfin</title>
</svelte:head>

<ModeWatcher defaultMode="dark" />

<QueryClientProvider client={queryClient}>
	{#if !session.ready}
		<!-- the splash below covers this -->
	{:else if onLogin || !session.user}
		{@render children()}
	{:else}
		<AppShell>{@render children()}</AppShell>
		<Dialogs />
		<ConfirmHost />
	{/if}
	<Toaster />
	{#if !boot.done}
		<div out:fade={{ duration: 250 }} class="fixed inset-0 z-100"><LoadingScreen progress={boot.progress} /></div>
	{/if}
</QueryClientProvider>
