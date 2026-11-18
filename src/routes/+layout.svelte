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
	import Logo from '#lib/components/Logo.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();


	session.restore();

	const onLogin = $derived(page.route.id === '/login');

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
		<div class="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Loading">
			<div class="animate-pulse"><Logo size={56} /></div>
		</div>
	{:else if onLogin || !session.user}
		{@render children()}
	{:else}
		<AppShell>{@render children()}</AppShell>
		<Dialogs />
		<ConfirmHost />
	{/if}
	<Toaster />
</QueryClientProvider>
