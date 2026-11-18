<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
	import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
	import { isAxiosError } from 'axios';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { mode, setMode, userPrefersMode } from 'mode-watcher';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api, session } from '#lib/api/session.svelte.ts';
	import { userImage } from '#lib/api/images.ts';
	import { layout } from '#lib/layout.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';

	const info = createQuery(() => ({
		queryKey: ['systemInfo', session.serverUrl],
		queryFn: async () => (await getSystemApi(api()).getPublicSystemInfo()).data
	}));

	// Quick Connect: approve a code shown on another device's sign-in screen.
	const quickConnect = createQuery(() => ({
		queryKey: ['quickConnectEnabled', session.serverUrl],
		queryFn: async () => (await getAuthenticationApi(api()).getQuickConnectEnabled()).data
	}));
	let qcCode = $state('');
	let qcError = $state<string | null>(null);
	let qcBusy = $state(false);
	async function authorize(e: SubmitEvent) {
		e.preventDefault();
		const code = qcCode.replace(/\s+/g, '');
		qcError = null;
		qcBusy = true;
		try {
			await getAuthenticationApi(api()).authorizeQuickConnect({ code, userId: session.userId });
			qcCode = '';
			toasts.show('Device approved. It will sign in in a few seconds.');
		} catch (err) {
			qcError = isAxiosError(err) && err.response?.status === 404 ? "That code doesn't exist or has expired." : "Couldn't approve that code.";
		} finally {
			qcBusy = false;
		}
	}

	let noReport = $state(localStorage.getItem('jf.disablePlaybackReporting') === '1');
	$effect(() => {
		if (noReport) localStorage.setItem('jf.disablePlaybackReporting', '1');
		else localStorage.removeItem('jf.disablePlaybackReporting');
	});

	const avatar = $derived(userImage(session.userId, session.user?.PrimaryImageTag, 160));

	async function signOut() {
		await session.logout();
		goto(resolve('/login'));
	}

	const card = 'bg-card border-border flex flex-col gap-5 rounded-[20px] border p-6';
	const h2 = 'text-muted-foreground font-sans text-xs font-bold tracking-[0.1em] uppercase';
	const seg = 'flex flex-wrap gap-1 rounded-full border border-border p-1 w-fit';
	const segBtn = 'h-10 cursor-pointer rounded-full px-4 text-sm text-muted-foreground aria-pressed:bg-secondary aria-pressed:font-semibold aria-pressed:text-foreground';
</script>

<svelte:head><title>Settings · Jellyfin</title></svelte:head>

<main class="mx-auto flex max-w-[860px] flex-col gap-6 px-4 pt-7 pb-18 md:px-10">
	<h1 class="text-4xl font-extrabold md:text-5xl">Settings</h1>

	<section class={card} aria-labelledby="s-account">
		<h2 id="s-account" class={h2}>Account</h2>
		<div class="flex flex-wrap items-center gap-4">
			<span class="font-display text-ink grid size-16 place-items-center overflow-hidden rounded-full text-2xl font-extrabold [background:var(--brand-grad)]">
				{#if avatar}<img src={avatar} alt="" class="size-full object-cover" />{:else}{session.user?.Name?.slice(0, 1)}{/if}
			</span>
			<div class="min-w-0 flex-1">
				<div class="text-lg font-semibold">{session.user?.Name}</div>
				<div class="text-muted-foreground text-sm break-all">
					{info.data?.ServerName ?? 'Jellyfin'}{info.data?.Version ? ` · ${info.data.Version}` : ''} · {session.serverUrl}
				</div>
			</div>
			<Button variant="outline" onclick={signOut}><LogOut aria-hidden="true" />Sign out</Button>
		</div>
	</section>

	<section class={card} aria-labelledby="s-display">
		<h2 id="s-display" class={h2}>Display</h2>
		<div class="flex flex-col gap-2">
			<span id="l-theme" class="font-semibold">Theme</span>
			<div role="group" aria-labelledby="l-theme" class={seg}>
				{#each [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']] as [value, label] (value)}
					<button type="button" class={segBtn} aria-pressed={userPrefersMode.current === value} onclick={() => setMode(value as 'system' | 'dark' | 'light')}>{label}</button>
				{/each}
			</div>
			<p class="text-muted-foreground text-sm">Currently {mode.current}.</p>
		</div>
		<div class="flex flex-col gap-2">
			<span id="l-layout" class="font-semibold">Layout</span>
			<div role="group" aria-labelledby="l-layout" class={seg}>
				{#each [['auto', 'Automatic'], ['desktop', 'Desktop & mobile'], ['tv', 'TV (10-foot)']] as [value, label] (value)}
					<button type="button" class={segBtn} aria-pressed={layout.pref === value} onclick={() => layout.set(value as 'auto' | 'tv' | 'desktop')}>{label}</button>
				{/each}
			</div>
			<p class="text-muted-foreground text-sm">TV layout uses larger type and remote-friendly controls in the player. Automatic picks it on large screens without a mouse. Saved on this device only.</p>
		</div>
	</section>

	<section class={card} aria-labelledby="s-playback">
		<h2 id="s-playback" class={h2}>Playback</h2>
		<label class="flex cursor-pointer items-start gap-3">
			<input type="checkbox" bind:checked={noReport} class="accent-primary mt-1 size-5" />
			<span>
				<span class="block font-semibold">Don't report playback to the server</span>
				<span class="text-muted-foreground block text-sm">Nothing you play on this device is added to your watch history or resume points. Saved on this device only.</span>
			</span>
		</label>
	</section>

	{#if quickConnect.data}
		<section class={card} aria-labelledby="s-qc">
			<h2 id="s-qc" class={h2}>Quick Connect</h2>
			<form class="flex flex-col gap-2" onsubmit={authorize}>
				<Label for="qc-code" class="font-semibold">Sign in another device</Label>
				<p id="qc-help" class="text-muted-foreground text-sm">On the other device, choose <span class="text-foreground font-semibold">Use Quick Connect</span> on the sign-in screen, then enter the code it shows. It will be signed in as you.</p>
				<div class="flex flex-wrap gap-2">
					<Input
						id="qc-code"
						bind:value={qcCode}
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength={8}
						required
						placeholder="123456"
						class="w-40 font-mono text-lg tracking-[0.2em]"
						aria-describedby={qcError ? 'qc-help qc-error' : 'qc-help'}
						aria-invalid={!!qcError}
					/>
					<Button type="submit" disabled={qcBusy || !qcCode.trim()}>{qcBusy ? 'Approving…' : 'Approve'}</Button>
				</div>
				{#if qcError}<p id="qc-error" role="alert" class="text-destructive text-sm font-medium">{qcError}</p>{/if}
			</form>
		</section>
	{/if}
</main>
