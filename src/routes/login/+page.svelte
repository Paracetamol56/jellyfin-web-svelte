<script lang="ts">
	import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
	import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
	import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { isAxiosError } from 'axios';
	import { defaultServerUrl, jellyfin, session } from '#lib/api/session.svelte.ts';
	import Logo from '#lib/components/Logo.svelte';
	import QuickConnect from '#lib/components/QuickConnect.svelte';
	import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';

	let server = $state(localStorage.getItem('jf.lastServer') ?? defaultServerUrl());
	let editingServer = $state(false);
	let serverName = $state<string | null>(null);
	let serverError = $state<string | null>(null);
	let publicUsers = $state<UserDto[]>([]);
	let quickConnectEnabled = $state(false);
	let quickConnect = $state(false);

	let username = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let slow = $state(false);
	let passwordEl = $state<HTMLInputElement | null>(null);

	async function probe(url: string) {
		serverName = null;
		serverError = null;
		publicUsers = [];
		quickConnectEnabled = false;
		quickConnect = false;
		try {
			const api = jellyfin.createApi(url.replace(/\/+$/, ''));
			const { data } = await getSystemApi(api).getPublicSystemInfo();
			serverName = data.ServerName ?? 'Jellyfin';
			const users = await getUserApi(api).getPublicUsers().catch(() => null);
			publicUsers = users?.data ?? [];
			const qc = await getAuthenticationApi(api).getQuickConnectEnabled().catch(() => null);
			quickConnectEnabled = qc?.data === true;
		} catch {
			serverError = "Can't reach a Jellyfin server at this address.";
			editingServer = true;
		}
	}

	$effect(() => {
		probe(server);
	});

	function pick(u: UserDto) {
		username = u.Name ?? '';
		password = '';
		passwordEl?.focus();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		busy = true;
		const timer = setTimeout(() => (slow = true), 6000);
		try {
			await session.login(server, username.trim(), password);
			localStorage.setItem('jf.lastServer', server);
		} catch (err) {
			error =
				isAxiosError(err) && err.response?.status === 401
					? 'Wrong username or password.'
					: isAxiosError(err) && !err.response
						? "Can't reach the server. Check the address and try again."
						: 'Sign-in failed. Please try again.';
		} finally {
			clearTimeout(timer);
			busy = false;
			slow = false;
		}
	}
</script>

<svelte:head><title>Sign in · Jellyfin</title></svelte:head>

<main class="grid min-h-dvh place-items-center px-4 py-10">
	<div class="flex w-full max-w-[420px] flex-col gap-8">
		<div class="flex flex-col items-center gap-4 text-center">
			<Logo size={64} />
			<h1 class="text-4xl font-extrabold">Sign in</h1>
			<p class="text-muted-foreground">
				{#if serverName}to <span class="text-foreground font-semibold">{serverName}</span>{:else}to your Jellyfin server{/if}
			</p>
		</div>

		{#if quickConnect}
			<QuickConnect {server} oncancel={() => (quickConnect = false)} />
		{:else}
		{#if publicUsers.length}
			<ul class="flex flex-wrap justify-center gap-2" aria-label="Users on this server">
				{#each publicUsers as u (u.Id)}
					<li>
						<button
							type="button"
							onclick={() => pick(u)}
							aria-pressed={username === u.Name}
							class="border-border hover:bg-accent aria-pressed:bg-secondary aria-pressed:border-ring flex h-11 cursor-pointer items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-semibold"
						>
							<span class="font-display text-ink grid size-8 place-items-center rounded-full text-sm font-extrabold [background:var(--brand-grad)]">
								{u.Name?.slice(0, 1).toUpperCase()}
							</span>
							{u.Name}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<form onsubmit={submit} class="bg-card border-border flex flex-col gap-5 rounded-3xl border p-6 md:p-8">
			{#if editingServer}
				<div class="flex flex-col gap-2">
					<Label for="server">Server address</Label>
					<Input
						id="server"
						type="url"
						required
						placeholder="http://192.168.1.10:8096"
						value={server}
						onchange={(e) => (server = e.currentTarget.value.trim())}
						aria-invalid={!!serverError}
						aria-describedby={serverError ? 'server-error' : undefined}
					/>
					{#if serverError}<p id="server-error" class="text-destructive text-sm">{serverError}</p>{/if}
				</div>
			{/if}
			<div class="flex flex-col gap-2">
				<Label for="username">Username</Label>
				<Input id="username" autocomplete="username" required bind:value={username} />
			</div>
			<div class="flex flex-col gap-2">
				<Label for="password">Password</Label>
				<Input id="password" type="password" autocomplete="current-password" bind:value={password} bind:ref={passwordEl} />
			</div>
			{#if slow}<p class="text-muted-foreground text-sm" role="status">Still waiting for the server. Some servers take up to a minute to sign in.</p>{/if}
			{#if error}<p role="alert" class="text-destructive text-sm font-medium">{error}</p>{/if}
			<Button type="submit" size="lg" disabled={busy || !!serverError} class="mt-1 w-full">
				{busy ? 'Signing in…' : 'Sign in'}
			</Button>
		</form>
		{#if quickConnectEnabled}
			<Button type="button" variant="outline" size="lg" class="-mt-4 w-full" onclick={() => (quickConnect = true)}>Use Quick Connect</Button>
		{/if}
		{/if}

		<p class="text-muted-foreground text-center text-sm">
			<span class="break-all">{server}</span>
			{#if !editingServer}
				· <button type="button" class="text-primary cursor-pointer font-semibold hover:underline" onclick={() => (editingServer = true)}>Change server</button>
			{/if}
		</p>
	</div>
</main>
