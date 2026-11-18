<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Archive from '@lucide/svelte/icons/archive';
	import type { BrandingOptionsDto, NetworkConfiguration, ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models';
	import { adminKeys, createBackup, getConfig, getLocalization, getNamed, listBackups, restoreBackup, saveConfig, saveNamed } from '#lib/admin/api.ts';
	import { Draft } from '#lib/admin/draft.svelte.ts';
	import { ago } from '#lib/api/format.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { input, select } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const configQ = createQuery(() => ({ queryKey: adminKeys.config, queryFn: getConfig }));
	const networkQ = createQuery(() => ({ queryKey: adminKeys.named('network'), queryFn: () => getNamed('network') }));
	const brandingQ = createQuery(() => ({ queryKey: adminKeys.named('branding'), queryFn: () => getNamed('branding') }));
	const loc = createQuery(() => ({ queryKey: adminKeys.localization, queryFn: getLocalization, staleTime: Infinity }));
	const backups = createQuery(() => ({ queryKey: adminKeys.backups, queryFn: listBackups, retry: false }));

	const cfg = new Draft<ServerConfiguration>();
	const net = new Draft<NetworkConfiguration>();
	const brand = new Draft<BrandingOptionsDto>();
	$effect(() => { if (configQ.data && !cfg.value) cfg.load(configQ.data); });
	$effect(() => { if (networkQ.data && !net.value) net.load(networkQ.data); });
	$effect(() => { if (brandingQ.data && !brand.value) brand.load(brandingQ.data); });
	const c = $derived(cfg.value);
	const n = $derived(net.value);
	const b = $derived(brand.value);

	const lines = (v: string[] | null | undefined) => (v ?? []).join(', ');
	const split = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

	async function save() {
		await Promise.all([
			cfg.dirty && cfg.commit((v) => saveConfig(v)),
			net.dirty && net.commit((v) => saveNamed('network', v)),
			brand.dirty && brand.commit((v) => saveNamed('branding', v))
		]);
		queryClient.invalidateQueries({ queryKey: adminKeys.system });
	}

	let backingUp = $state(false);
	let bo = $state({ Database: true, Metadata: true, Subtitles: true, Trickplay: false });
	let busy = $state(false);
	async function backup(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		try {
			await createBackup(bo);
			toasts.show('Backup created');
			backingUp = false;
			queryClient.invalidateQueries({ queryKey: adminKeys.backups });
		} catch {
			toasts.error("Couldn't create the backup.");
		} finally {
			busy = false;
		}
	}
	async function restore(path: string) {
		if (!(await confirm({ title: 'Restore this backup?', body: 'The server restarts and everything changed since the backup is lost: users, watch history, settings and metadata.', confirmLabel: 'Restore and restart', destructive: true }))) return;
		await restoreBackup(path);
		toasts.show('Restoring… the server restarts when done.');
	}
	const list = 'divide-border flex flex-col divide-y';
	const grid = 'grid gap-4 sm:grid-cols-2';
	const textarea = 'border-input bg-background w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none focus-visible:border-ring';
</script>

<header>
	<h1 class="text-4xl font-extrabold">Server settings</h1>
	<p class="text-muted-foreground mt-1 text-sm">Identity, networking, housekeeping and backups.</p>
</header>

{#if !c || !n || !b}
	<Skeleton class="h-80" />
{:else}
	<Section title="General">
		<div class={grid}>
			<Field label="Server name" hint="Shown to apps and on the sign-in screen.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} class={input} bind:value={c.ServerName} />{/snippet}
			</Field>
			<Field label="Server language" hint="Used for server-generated text such as notifications.">
				{#snippet children(id, hint)}
					<select {id} aria-describedby={hint} class={select} bind:value={c.UICulture}>
						{#each loc.data?.ui ?? [] as o, i (i)}<option value={o.Value}>{o.Name}</option>{/each}
					</select>
				{/snippet}
			</Field>
		</div>
		<Toggle bind:checked={c.QuickConnectAvailable} label="Quick Connect" description="Sign in on a TV by entering a short code from a device that's already signed in." />
	</Section>

	<Section title="Metadata defaults" description="Libraries use these unless they override them.">
		<div class={grid}>
			<Field label="Preferred language">
				{#snippet children(id)}
					<select {id} class={select} bind:value={c.PreferredMetadataLanguage}>
						{#each loc.data?.cultures ?? [] as x, i (i)}<option value={x.TwoLetterISOLanguageName}>{x.DisplayName}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Country">
				{#snippet children(id)}
					<select {id} class={select} bind:value={c.MetadataCountryCode}>
						{#each loc.data?.countries ?? [] as x, i (i)}<option value={x.TwoLetterISORegionName}>{x.DisplayName}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Metadata folder" hint="Empty for the default location.">{#snippet children(id, hint)}<input {id} aria-describedby={hint} class="{input} font-mono text-sm" bind:value={c.MetadataPath} />{/snippet}</Field>
			<Field label="Cache folder" hint="Empty for the default location.">{#snippet children(id, hint)}<input {id} aria-describedby={hint} class="{input} font-mono text-sm" bind:value={c.CachePath} />{/snippet}</Field>
		</div>
	</Section>

	<Section title="Networking" description="Changes here take effect after a restart.">
		<div class={grid}>
			<Field label="Base URL" hint="For reverse proxies serving Jellyfin under a path, e.g. /jellyfin.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} class="{input} font-mono text-sm" bind:value={n.BaseUrl} />{/snippet}
			</Field>
			<Field label="HTTP port">{#snippet children(id)}<input {id} type="number" class={input} bind:value={n.InternalHttpPort} />{/snippet}</Field>
			<Field label="Local networks" hint="Comma-separated subnets treated as “inside”, e.g. 192.168.1.0/24.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} class="{input} font-mono text-sm" value={lines(n.LocalNetworkSubnets)} oninput={(ev) => (n.LocalNetworkSubnets = split(ev.currentTarget.value))} />{/snippet}
			</Field>
			<Field label="Known proxies" hint="Reverse proxy addresses, so client IPs are reported correctly.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} class="{input} font-mono text-sm" value={lines(n.KnownProxies)} oninput={(ev) => (n.KnownProxies = split(ev.currentTarget.value))} />{/snippet}
			</Field>
		</div>
		<div class={list}>
			<Toggle bind:checked={n.EnableRemoteAccess} label="Allow remote connections" description="Off means only devices on your local networks can connect." />
			<Toggle bind:checked={n.EnableHttps} label="Serve HTTPS" description="Usually handled by a reverse proxy instead." />
			{#if n.EnableHttps}
				<Toggle bind:checked={n.RequireHttps} label="Require HTTPS for remote connections" />
			{/if}
			<Toggle bind:checked={n.EnableIPv6} label="IPv6" />
			<Toggle bind:checked={n.AutoDiscovery} label="Let apps discover this server on the local network" />
		</div>
		{#if n.EnableHttps}
			<div class={grid}>
				<Field label="HTTPS port">{#snippet children(id)}<input {id} type="number" class={input} bind:value={n.InternalHttpsPort} />{/snippet}</Field>
				<Field label="Certificate (.pfx) path">{#snippet children(id)}<input {id} class="{input} font-mono text-sm" bind:value={n.CertificatePath} />{/snippet}</Field>
			</div>
		{/if}
	</Section>

	<Section title="Housekeeping">
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<Field label="Keep log files (days)">{#snippet children(id)}<input {id} type="number" min="1" class={input} bind:value={c.LogFileRetentionDays} />{/snippet}</Field>
			<Field label="Keep activity history (days)">{#snippet children(id)}<input {id} type="number" min="0" class={input} bind:value={c.ActivityLogRetentionDays} />{/snippet}</Field>
			<Field label="Wait before scanning changes (s)" hint="Gives copies time to finish.">{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" class={input} bind:value={c.LibraryMonitorDelay} />{/snippet}</Field>
			<Field label="Parallel library scans" hint="0 means automatic.">{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" class={input} bind:value={c.LibraryScanFanoutConcurrency} />{/snippet}</Field>
			<Field label="Parallel image encoding" hint="0 means automatic.">{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" class={input} bind:value={c.ParallelImageEncodingLimit} />{/snippet}</Field>
		</div>
	</Section>

	<Section title="Branding" description="What people see when signing in.">
		<Field label="Sign-in message" hint="Shown under the sign-in form. Plain text.">
			{#snippet children(id, hint)}<textarea {id} aria-describedby={hint} class="{textarea} min-h-20" bind:value={b.LoginDisclaimer}></textarea>{/snippet}
		</Field>
		<Field label="Custom CSS" hint="Applied by clients that support it (including the stock web client).">
			{#snippet children(id, hint)}<textarea {id} aria-describedby={hint} spellcheck="false" class="{textarea} min-h-32 font-mono text-[13px]" bind:value={b.CustomCss}></textarea>{/snippet}
		</Field>
		<Toggle bind:checked={b.SplashscreenEnabled} label="Show a splash screen on TVs" />
	</Section>

	<SaveBar drafts={[cfg, net, brand] as never} onsave={save} note={net.dirty ? 'Restart the server for networking changes.' : undefined} />
{/if}

<Section title="Backups" description="Database, settings and metadata. Media files aren't included.">
	{#snippet actions()}<Button size="sm" onclick={() => (backingUp = true)}><Archive aria-hidden="true" />Back up now</Button>{/snippet}
	{#if backups.isError}
		<p class="text-muted-foreground text-sm">This server version doesn't support backups from the dashboard.</p>
	{:else if backups.data && !backups.data.length}
		<p class="text-muted-foreground text-sm">No backups yet.</p>
	{:else}
		<ul class="divide-border flex flex-col divide-y">
			{#each backups.data ?? [] as bk (bk.Path)}
				<li class="flex flex-wrap items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<p class="font-medium">{bk.DateCreated ? new Date(bk.DateCreated).toLocaleString() : 'Backup'} <span class="text-muted-foreground font-normal">· {ago(bk.DateCreated)}</span></p>
						<p class="text-muted-foreground truncate font-mono text-xs">{bk.Path} · Jellyfin {bk.ServerVersion}</p>
					</div>
					<Button variant="ghost" size="sm" onclick={() => restore(bk.Path!)}>Restore…</Button>
				</li>
			{/each}
		</ul>
	{/if}
</Section>

<Dialog bind:open={backingUp} title="Back up now" description="Saved in the server's backup folder.">
	<form id="backup" onsubmit={backup} class="divide-border flex flex-col divide-y">
		<Toggle checked={true} disabled label="Database and settings" description="Always included." />
		<Toggle bind:checked={bo.Metadata} label="Metadata and artwork" />
		<Toggle bind:checked={bo.Subtitles} label="Downloaded subtitles" />
		<Toggle bind:checked={bo.Trickplay} label="Seek-bar previews" description="Can be large." />
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (backingUp = false)}>Cancel</Button>
		<Button type="submit" form="backup" disabled={busy}>{busy ? 'Backing up…' : 'Create backup'}</Button>
	{/snippet}
</Dialog>
