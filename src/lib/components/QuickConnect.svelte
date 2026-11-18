<script lang="ts">
	// Quick Connect sign-in: the server hands out a short code; the user approves it from a device
	// that's already signed in (Settings → Quick Connect there), and this page then gets a session.
	import { onDestroy } from 'svelte';
	import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
	import { isAxiosError } from 'axios';
	import { jellyfin, session } from '#lib/api/session.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';

	let { server, oncancel }: { server: string; oncancel: () => void } = $props();

	const POLL_MS = 3000;
	let code = $state<string | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	const qc = () => getAuthenticationApi(jellyfin.createApi(server.replace(/\/+$/, '')));

	async function start() {
		clearTimeout(timer);
		error = null;
		code = null;
		busy = true;
		try {
			const { data } = await qc().initiateQuickConnect();
			code = data.Code ?? null;
			if (data.Secret) poll(data.Secret);
		} catch (e) {
			error = isAxiosError(e) && e.response?.status === 401 ? 'Quick Connect is turned off on this server.' : "Couldn't get a code from the server.";
		} finally {
			busy = false;
		}
	}

	function poll(secret: string) {
		timer = setTimeout(async () => {
			if (stopped) return;
			try {
				const { data } = await qc().getQuickConnectState({ secret });
				if (stopped) return;
				if (!data.Authenticated) return poll(secret);
				busy = true;
				await session.loginWithQuickConnect(server, secret);
			} catch (e) {
				if (stopped) return;
				busy = false;
				code = null;
				// The server forgets codes after a few minutes.
				error = isAxiosError(e) && e.response?.status === 404 ? 'This code has expired.' : "Signing in with Quick Connect didn't work.";
			}
		}, POLL_MS);
	}

	start();
	onDestroy(() => {
		stopped = true;
		clearTimeout(timer);
	});
</script>

<section aria-labelledby="qc-title" class="bg-card border-border flex flex-col items-center gap-5 rounded-3xl border p-6 text-center md:p-8">
	<h2 id="qc-title" class="text-xl font-bold">Quick Connect</h2>
	{#if code}
		<p class="text-muted-foreground text-sm">On a device where you're already signed in, open <span class="text-foreground font-semibold">Settings → Quick Connect</span> and enter this code:</p>
		<p class="font-display text-5xl font-extrabold tracking-[0.18em] tabular-nums" aria-label="Code {code.split('').join(' ')}">{code}</p>
		<p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
			<span class="bg-primary size-2 animate-pulse rounded-full" aria-hidden="true"></span>{busy ? 'Signing in…' : 'Waiting for approval…'}
		</p>
	{:else if error}
		<p role="alert" class="text-destructive text-sm font-medium">{error}</p>
		<Button type="button" onclick={start} disabled={busy}>Get a new code</Button>
	{:else}
		<p class="text-muted-foreground text-sm" role="status">Getting a code…</p>
	{/if}
	<Button type="button" variant="outline" onclick={oncancel}>Sign in with a password instead</Button>
</section>
