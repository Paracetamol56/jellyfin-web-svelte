<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { Tabs } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { UserDto, UserPolicy } from '@jellyfin/sdk/lib/generated-client/models';
	import {
		adminKeys,
		deleteUser,
		getDevices,
		getLibraries,
		getParentalRatings,
		getUser,
		resetPassword,
		setPassword,
		updatePolicy,
		updateUser
	} from '#lib/admin/api.ts';
	import { Draft } from '#lib/admin/draft.svelte.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { ago } from '#lib/api/format.ts';
	import { hashParams } from '#lib/hash-params.svelte.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { input, select } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const id = $derived(page.params.id!);
	const isSelf = $derived(id === session.userId);
	const user = createQuery(() => ({ queryKey: adminKeys.user(id), queryFn: () => getUser(id) }));
	const libraries = createQuery(() => ({ queryKey: adminKeys.libraries, queryFn: getLibraries }));
	const devices = createQuery(() => ({ queryKey: adminKeys.devices, queryFn: getDevices }));
	const ratings = createQuery(() => ({ queryKey: ['admin', 'ratings'], queryFn: getParentalRatings, staleTime: Infinity }));

	const profile = new Draft<UserDto>();
	const policy = new Draft<UserPolicy>();
	$effect(() => {
		id;
		profile.value = null;
		policy.value = null;
	});
	$effect(() => {
		const u = user.data;
		if (!u || profile.value) return;
		profile.load(u);
		policy.load(u.Policy ?? ({} as UserPolicy));
	});

	let tab = $state(hashParams().get('tab') ?? 'profile');
	const p = $derived(policy.value);
	const uniqueRatings = $derived.by(() => {
		const seen = new Map<number, string[]>();
		for (const r of ratings.data ?? []) {
			const v = r.Value ?? r.RatingScore?.score;
			if (v == null) continue;
			seen.set(v, [...(seen.get(v) ?? []), r.Name ?? '']);
		}
		return [...seen.entries()].sort((a, b) => a[0] - b[0]);
	});

	async function save() {
		const saves: Promise<unknown>[] = [];
		if (profile.dirty) saves.push(profile.commit((u) => updateUser(u)));
		if (policy.dirty) saves.push(policy.commit((pol) => updatePolicy(id, pol)));
		await Promise.all(saves);
		queryClient.invalidateQueries({ queryKey: adminKeys.users });
		queryClient.invalidateQueries({ queryKey: adminKeys.user(id) });
	}

	function toggleFolder(folderId: string, on: boolean) {
		if (!p) return;
		const set = new Set(p.EnabledFolders ?? []);
		if (on) set.add(folderId);
		else set.delete(folderId);
		p.EnabledFolders = [...set];
	}
	function toggleDevice(deviceId: string, on: boolean) {
		if (!p) return;
		const set = new Set(p.EnabledDevices ?? []);
		if (on) set.add(deviceId);
		else set.delete(deviceId);
		p.EnabledDevices = [...set];
	}

	let pw = $state('');
	let pw2 = $state('');
	async function changePassword(e: SubmitEvent) {
		e.preventDefault();
		if (pw !== pw2) return toasts.error("The passwords don't match.");
		try {
			await setPassword(id, pw);
			pw = pw2 = '';
			toasts.show('Password updated');
			queryClient.invalidateQueries({ queryKey: adminKeys.user(id) });
		} catch {
			toasts.error("Couldn't change the password.");
		}
	}
	async function removePassword() {
		if (!(await confirm({ title: 'Remove the password?', body: 'They will be able to sign in without a password.', confirmLabel: 'Remove password', destructive: true }))) return;
		await resetPassword(id);
		toasts.show('Password removed');
		queryClient.invalidateQueries({ queryKey: adminKeys.user(id) });
	}
	async function remove() {
		if (!(await confirm({ title: `Delete ${user.data?.Name}?`, body: "Their watch history, favorites and playlists are deleted too. This can't be undone.", confirmLabel: 'Delete user', destructive: true }))) return;
		await deleteUser(id);
		queryClient.invalidateQueries({ queryKey: adminKeys.users });
		toasts.show(`Deleted ${user.data?.Name}`);
		goto(resolve('/admin/users'), { replace: true });
	}

	const tabsList = 'border-border -mx-1 flex gap-1 overflow-x-auto border-b px-1';
	const trigger = 'text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary -mb-px shrink-0 cursor-pointer border-b-2 border-transparent px-3 py-3 text-[15px] data-[state=active]:font-semibold';
	const list = 'divide-border flex flex-col divide-y';
	const row = 'flex items-center gap-3 py-2.5';
</script>

<a href={resolve('/admin/users')} class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"><ArrowLeft class="size-4" aria-hidden="true" />All users</a>

{#if !profile.value || !p}
	<Skeleton class="h-12 w-64" /><Skeleton class="h-96" />
{:else}
	<header class="flex flex-wrap items-end gap-4">
		<div class="flex-1">
			<h1 class="text-4xl font-extrabold">{user.data?.Name}</h1>
			<p class="text-muted-foreground mt-1 text-sm">
				{user.data?.LastActivityDate ? `Active ${ago(user.data.LastActivityDate)}` : 'Never signed in'}{user.data?.LastLoginDate ? ` · last sign-in ${ago(user.data.LastLoginDate)}` : ''}
			</p>
		</div>
	</header>

	<Tabs.Root bind:value={tab} class="flex flex-col gap-6">
		<Tabs.List class={tabsList}>
			<Tabs.Trigger value="profile" class={trigger}>Profile</Tabs.Trigger>
			<Tabs.Trigger value="access" class={trigger}>Libraries & devices</Tabs.Trigger>
			<Tabs.Trigger value="permissions" class={trigger}>Permissions</Tabs.Trigger>
			<Tabs.Trigger value="parental" class={trigger}>Parental controls</Tabs.Trigger>
			<Tabs.Trigger value="password" class={trigger}>Password</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="profile" class="flex flex-col gap-6">
			<Section title="Account">
				<Field label="Name">{#snippet children(fid)}<input id={fid} class={input} bind:value={profile.value!.Name} />{/snippet}</Field>
				<div class={list}>
					<Toggle bind:checked={p.IsAdministrator} disabled={isSelf} label="Administrator" description={isSelf ? "You can't remove your own administrator role." : 'Full control of the server, including this dashboard.'} />
					<Toggle bind:checked={p.IsDisabled} disabled={isSelf} label="Disable this account" description="They can't sign in or play anything until re-enabled." />
					<Toggle bind:checked={p.IsHidden} label="Hide from the login screen" description="They sign in by typing their name." />
				</div>
			</Section>
			{#if !isSelf}
				<Section title="Delete user" description="Removes the account, its watch history, favorites and playlists.">
					<div><Button class="bg-destructive hover:bg-destructive/90 text-white" onclick={remove}>Delete {user.data?.Name}</Button></div>
				</Section>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="access" class="flex flex-col gap-6">
			<Section title="Libraries" description="What this user can browse and play.">
				<Toggle bind:checked={p.EnableAllFolders} label="All libraries" description="Includes libraries added later." />
				{#if !p.EnableAllFolders}
					<ul class={list} aria-label="Libraries">
						{#each libraries.data ?? [] as lib (lib.ItemId)}
							<li class={row}>
								<input id="lib-{lib.ItemId}" type="checkbox" class="accent-primary size-5" checked={p.EnabledFolders?.includes(lib.ItemId!)} onchange={(e) => toggleFolder(lib.ItemId!, e.currentTarget.checked)} />
								<label for="lib-{lib.ItemId}" class="flex-1 cursor-pointer">{lib.Name}</label>
								<span class="text-muted-foreground text-sm">{lib.CollectionType ?? 'mixed'}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Section>
			<Section title="Devices" description="Limit which devices this account can be used on.">
				<Toggle bind:checked={p.EnableAllDevices} label="Any device" />
				{#if !p.EnableAllDevices}
					<ul class={list} aria-label="Devices">
						{#each (devices.data ?? []).filter((d) => d.LastUserId === id) as d (d.Id)}
							<li class={row}>
								<input id="dev-{d.Id}" type="checkbox" class="accent-primary size-5" checked={p.EnabledDevices?.includes(d.Id!)} onchange={(e) => toggleDevice(d.Id!, e.currentTarget.checked)} />
								<label for="dev-{d.Id}" class="flex-1 cursor-pointer">{d.CustomName || d.Name} <span class="text-muted-foreground">· {d.AppName}</span></label>
								<span class="text-muted-foreground text-sm">{ago(d.DateLastActivity)}</span>
							</li>
						{:else}
							<li class="text-muted-foreground py-2 text-sm">This user hasn't signed in on any device yet.</li>
						{/each}
					</ul>
				{/if}
			</Section>
		</Tabs.Content>

		<Tabs.Content value="permissions" class="flex flex-col gap-6">
			<Section title="Playback">
				<div class={list}>
					<Toggle bind:checked={p.EnableMediaPlayback} label="Allow playback" />
					<Toggle bind:checked={p.EnableAudioPlaybackTranscoding} label="Allow audio transcoding" description="Convert audio the device can't play. Uses server CPU." />
					<Toggle bind:checked={p.EnableVideoPlaybackTranscoding} label="Allow video transcoding" description="Convert video the device can't play. The most CPU/GPU-intensive option." />
					<Toggle bind:checked={p.EnablePlaybackRemuxing} label="Allow remuxing" description="Repackage files without re-encoding. Cheap for the server." />
					<Toggle bind:checked={p.ForceRemoteSourceTranscoding} label="Always transcode remote sources" />
				</div>
				<Field label="Bitrate limit outside your network (Mbps)" hint="Empty for no limit.">
					{#snippet children(fid, hint)}
						<input id={fid} aria-describedby={hint} inputmode="decimal" class="{input} max-w-48" value={p.RemoteClientBitrateLimit ? p.RemoteClientBitrateLimit / 1e6 : ''} oninput={(e) => (p.RemoteClientBitrateLimit = e.currentTarget.value ? Math.round(+e.currentTarget.value * 1e6) : 0)} />
					{/snippet}
				</Field>
			</Section>
			<Section title="Content">
				<div class={list}>
					<Toggle bind:checked={p.EnableContentDownloading} label="Allow downloads" />
					<Toggle bind:checked={p.EnableContentDeletion} label="Allow deleting media" description="Deleting removes files from disk." />
					<Toggle bind:checked={p.EnableCollectionManagement} label="Manage collections" />
					<Toggle bind:checked={p.EnableSubtitleManagement} label="Manage subtitles" />
					<Toggle bind:checked={p.EnableLyricManagement} label="Manage lyrics" />
					<Toggle bind:checked={p.EnablePublicSharing} label="Allow public sharing" />
				</div>
			</Section>
			<Section title="Live TV">
				<div class={list}>
					<Toggle bind:checked={p.EnableLiveTvAccess} label="Watch live TV" />
					<Toggle bind:checked={p.EnableLiveTvManagement} label="Manage recordings" />
				</div>
			</Section>
			<Section title="Remote access & sessions">
				<div class={list}>
					<Toggle bind:checked={p.EnableRemoteAccess} label="Allow access from outside your network" />
					<Toggle bind:checked={p.EnableRemoteControlOfOtherUsers} label="Control other users' playback" />
					<Toggle bind:checked={p.EnableSharedDeviceControl} label="Control shared devices" />
					<Toggle bind:checked={p.EnableUserPreferenceAccess} label="Change their own preferences" />
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<Field label="Simultaneous streams" hint="0 means no limit.">
						{#snippet children(fid, hint)}<input id={fid} aria-describedby={hint} type="number" min="0" class={input} bind:value={p.MaxActiveSessions} />{/snippet}
					</Field>
					<Field label="Failed sign-ins before lock-out" hint="-1 never locks, 0 uses the default.">
						{#snippet children(fid, hint)}<input id={fid} aria-describedby={hint} type="number" min="-1" class={input} bind:value={p.LoginAttemptsBeforeLockout} />{/snippet}
					</Field>
					<Field label="SyncPlay (watch together)">
						{#snippet children(fid)}
							<select id={fid} class={select} bind:value={p.SyncPlayAccess}>
								<option value="CreateAndJoinGroups">Create and join groups</option>
								<option value="JoinGroups">Join groups only</option>
								<option value="None">Not allowed</option>
							</select>
						{/snippet}
					</Field>
				</div>
			</Section>
		</Tabs.Content>

		<Tabs.Content value="parental" class="flex flex-col gap-6">
			<Section title="Ratings" description="Hide content rated above a limit.">
				<Field label="Maximum allowed rating">
					{#snippet children(fid)}
						<select id={fid} class="{select} max-w-md" value={p.MaxParentalRating ?? ''} onchange={(e) => (p.MaxParentalRating = e.currentTarget.value === '' ? null : +e.currentTarget.value)}>
							<option value="">No limit</option>
							{#each uniqueRatings as [v, names] (v)}<option value={v}>{names.slice(0, 4).join(', ')}{names.length > 4 ? '…' : ''}</option>{/each}
						</select>
					{/snippet}
				</Field>
			</Section>
			<Section title="Tags" description="Comma-separated. Items with a blocked tag are hidden; if allowed tags are set, only those items show.">
				<div class="grid gap-4 sm:grid-cols-2">
					<Field label="Blocked tags">
						{#snippet children(fid)}<input id={fid} class={input} value={(p.BlockedTags ?? []).join(', ')} oninput={(e) => (p.BlockedTags = e.currentTarget.value.split(',').map((t) => t.trim()).filter(Boolean))} />{/snippet}
					</Field>
					<Field label="Allowed tags">
						{#snippet children(fid)}<input id={fid} class={input} value={(p.AllowedTags ?? []).join(', ')} oninput={(e) => (p.AllowedTags = e.currentTarget.value.split(',').map((t) => t.trim()).filter(Boolean))} />{/snippet}
					</Field>
				</div>
			</Section>
		</Tabs.Content>

		<Tabs.Content value="password" class="flex flex-col gap-6">
			<Section title="Set a new password" description={user.data?.HasPassword ? 'Replaces their current password.' : 'This account currently has no password.'}>
				<form onsubmit={changePassword} class="grid max-w-xl gap-4 sm:grid-cols-2">
					<Field label="New password">{#snippet children(fid)}<input id={fid} type="password" required autocomplete="new-password" class={input} bind:value={pw} />{/snippet}</Field>
					<Field label="Confirm password">{#snippet children(fid)}<input id={fid} type="password" required autocomplete="new-password" class={input} bind:value={pw2} />{/snippet}</Field>
					<div class="flex gap-2 sm:col-span-2">
						<Button type="submit" disabled={!pw}>Set password</Button>
						{#if user.data?.HasPassword}<Button variant="ghost" onclick={removePassword}>Remove password</Button>{/if}
					</div>
				</form>
			</Section>
		</Tabs.Content>
	</Tabs.Root>

	<SaveBar drafts={[profile, policy] as never} onsave={save} />
{/if}
