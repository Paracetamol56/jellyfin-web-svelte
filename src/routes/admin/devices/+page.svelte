<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { adminKeys, createKey, deleteDevice, getDevices, getKeys, revokeKey } from '#lib/admin/api.ts';
	import { ago } from '#lib/api/format.ts';
	import { jellyfin } from '#lib/api/session.svelte.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Section from '#lib/components/admin/Section.svelte';
	import { pill, table, td, th } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const devices = createQuery(() => ({ queryKey: adminKeys.devices, queryFn: getDevices }));
	const keys = createQuery(() => ({ queryKey: adminKeys.keys, queryFn: getKeys }));
	const sorted = $derived([...(devices.data ?? [])].sort((a, b) => (b.DateLastActivity ?? '').localeCompare(a.DateLastActivity ?? '')));

	async function signOut(id: string, name: string) {
		if (!(await confirm({ title: `Sign out “${name}”?`, body: 'The device has to sign in again to use the server.', confirmLabel: 'Sign out device', destructive: true }))) return;
		await deleteDevice(id);
		queryClient.invalidateQueries({ queryKey: adminKeys.devices });
		toasts.show(`Signed out ${name}`);
	}

	async function newKey() {
		const app = await confirm({ title: 'New API key', body: 'For scripts and apps such as Sonarr or Home Assistant. Anyone with the key has full admin access.', input: { label: 'App name', placeholder: 'e.g. Home Assistant' }, confirmLabel: 'Create key' });
		if (typeof app !== 'string') return;
		await createKey(app.trim());
		queryClient.invalidateQueries({ queryKey: adminKeys.keys });
		toasts.show(`Created a key for ${app.trim()}`);
	}
	async function revoke(token: string, app: string) {
		if (!(await confirm({ title: `Revoke the key for “${app}”?`, body: 'Anything using it stops working immediately.', confirmLabel: 'Revoke', destructive: true }))) return;
		await revokeKey(token);
		queryClient.invalidateQueries({ queryKey: adminKeys.keys });
		toasts.show('Key revoked');
	}
	async function copy(token: string) {
		await navigator.clipboard.writeText(token).then(() => toasts.show('Key copied'), () => toasts.error("Couldn't copy."));
	}
	const mask = (k: string) => `${k.slice(0, 6)}••••••••${k.slice(-4)}`;
</script>

<header>
	<h1 class="text-4xl font-extrabold">Devices & API keys</h1>
	<p class="text-muted-foreground mt-1 text-sm">Everything that can sign in to your server.</p>
</header>

<Section title="Devices" description={devices.data ? `${devices.data.length} devices, most recently active first.` : undefined}>
	<div class="-mx-5 overflow-x-auto md:-mx-6">
		<table class={table}>
			<thead class="border-border border-y"><tr><th class="{th} pl-5 md:pl-6">Device</th><th class={th}>App</th><th class="{th} max-sm:hidden">User</th><th class={th}>Last active</th><th class="{th} pr-5 md:pr-6"><span class="sr-only">Actions</span></th></tr></thead>
			<tbody class="divide-border divide-y">
				{#if devices.isPending}<tr><td colspan="5" class={td}><Skeleton class="h-10" /></td></tr>{/if}
				{#each sorted as d (d.Id)}
					{@const mine = d.Id === jellyfin.deviceInfo.id}
					<tr>
						<td class="{td} pl-5 font-medium md:pl-6">{d.CustomName || d.Name}{#if mine}<span class="{pill} bg-primary/15 text-primary ml-2">This device</span>{/if}</td>
						<td class="{td} text-muted-foreground">{d.AppName} {d.AppVersion}</td>
						<td class="{td} text-muted-foreground max-sm:hidden">{d.LastUserName}</td>
						<td class="{td} text-muted-foreground whitespace-nowrap">{ago(d.DateLastActivity)}</td>
						<td class="{td} pr-5 text-right md:pr-6">{#if !mine}<Button variant="ghost" size="sm" onclick={() => signOut(d.Id!, d.CustomName || d.Name || 'device')}>Sign out</Button>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Section>

<Section title="API keys" description="Keys give full administrator access. Revoke any you don't recognise.">
	{#snippet actions()}<Button size="sm" onclick={newKey}><KeyRound aria-hidden="true" />New key</Button>{/snippet}
	{#if keys.data && !keys.data.length}
		<p class="text-muted-foreground text-sm">No API keys yet.</p>
	{:else}
		<ul class="divide-border flex flex-col divide-y">
			{#each keys.data ?? [] as k (k.AccessToken)}
				<li class="flex flex-wrap items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<p class="font-medium">{k.AppName}</p>
						<p class="text-muted-foreground text-xs">Created {ago(k.DateCreated)}{k.DateLastActivity ? ` · last used ${ago(k.DateLastActivity)}` : ''}</p>
					</div>
					<code class="bg-muted rounded-lg px-2.5 py-1 font-mono text-xs">{mask(k.AccessToken ?? '')}</code>
					<Button variant="ghost" size="icon" aria-label="Copy the key for {k.AppName}" onclick={() => copy(k.AccessToken!)}><Copy /></Button>
					<Button variant="ghost" size="sm" onclick={() => revoke(k.AccessToken!, k.AppName ?? 'app')}>Revoke</Button>
				</li>
			{/each}
		</ul>
	{/if}
</Section>
