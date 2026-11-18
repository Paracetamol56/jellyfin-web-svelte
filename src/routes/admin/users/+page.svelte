<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { adminKeys, createUser, getUsers } from '#lib/admin/api.ts';
	import { ago } from '#lib/api/format.ts';
	import { userImage } from '#lib/api/images.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { pill, table, td, th } from '#lib/components/admin/styles.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import { input } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const users = createQuery(() => ({ queryKey: adminKeys.users, queryFn: getUsers }));
	const sorted = $derived([...(users.data ?? [])].sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? '')));

	let adding = $state(false);
	let name = $state('');
	let password = $state('');
	let busy = $state(false);
	async function add(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		try {
			const u = await createUser(name.trim(), password);
			queryClient.invalidateQueries({ queryKey: adminKeys.users });
			toasts.show(`Created ${u.Name}. Choose what they can access.`);
			adding = false;
			goto(resolve('/admin/users/[id]', { id: u.Id! }) + '?tab=access');
		} catch {
			toasts.error("Couldn't create the user. The name may already be taken.");
		} finally {
			busy = false;
		}
	}
</script>

<header class="flex flex-wrap items-end gap-4">
	<div class="flex-1">
		<h1 class="text-4xl font-extrabold">Users</h1>
		<p class="text-muted-foreground mt-1 text-sm">{users.data ? `${users.data.length} accounts` : ' '}</p>
	</div>
	<Button onclick={() => ((name = ''), (password = ''), (adding = true))}><UserPlus aria-hidden="true" />Add user</Button>
</header>

<div class="bg-card border-border overflow-x-auto rounded-[20px] border">
	<table class={table}>
		<thead class="border-border border-b">
			<tr><th class={th}>User</th><th class="{th} max-md:hidden">Role</th><th class={th}>Last active</th><th class="{th} max-md:hidden">Libraries</th></tr>
		</thead>
		<tbody class="divide-border divide-y">
			{#if users.isPending}
				{#each { length: 4 } as _, i (i)}<tr><td colspan="4" class={td}><Skeleton class="h-10" /></td></tr>{/each}
			{/if}
			{#each sorted as u (u.Id)}
				{@const img = userImage(u.Id!, u.PrimaryImageTag, 80)}
				<tr class="hover:bg-accent/50">
					<td class={td}>
						<a href={resolve('/admin/users/[id]', { id: u.Id! })} class="group flex items-center gap-3 font-semibold">
							<span class="font-display text-ink grid size-10 shrink-0 place-items-center overflow-hidden rounded-full font-extrabold [background:var(--brand-grad)]">
								{#if img}<img src={img} alt="" class="size-full object-cover" />{:else}{u.Name?.slice(0, 1).toUpperCase()}{/if}
							</span>
							<span class="group-hover:underline">{u.Name}{#if u.Id === session.userId}<span class="text-muted-foreground font-normal"> (you)</span>{/if}</span>
						</a>
					</td>
					<td class="{td} max-md:hidden">
						<span class="flex flex-wrap gap-1.5">
							{#if u.Policy?.IsAdministrator}<span class="{pill} bg-primary/15 text-primary">Administrator</span>{/if}
							{#if u.Policy?.IsDisabled}<span class="{pill} bg-destructive/15 text-destructive">Disabled</span>{/if}
							{#if u.Policy?.IsHidden}<span class="{pill} bg-secondary text-muted-foreground">Hidden from login</span>{/if}
							{#if !u.HasPassword}<span class="{pill} bg-[#E8A23A]/15 text-[#B5701A] dark:text-[#E8A23A]">No password</span>{/if}
							{#if !u.Policy?.IsAdministrator && !u.Policy?.IsDisabled}<span class="text-muted-foreground">User</span>{/if}
						</span>
					</td>
					<td class="{td} text-muted-foreground">{u.LastActivityDate ? ago(u.LastActivityDate) : 'Never'}</td>
					<td class="{td} text-muted-foreground max-md:hidden">{u.Policy?.EnableAllFolders ? 'All' : `${u.Policy?.EnabledFolders?.length ?? 0} selected`}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<Dialog bind:open={adding} title="Add user" description="You'll choose their libraries and permissions next.">
	<form id="add-user" onsubmit={add} class="flex flex-col gap-4">
		<Field label="Name">{#snippet children(id)}<input {id} class={input} required bind:value={name} autocomplete="off" />{/snippet}</Field>
		<Field label="Password" hint="Optional. They can sign in without one until it's set.">
			{#snippet children(id, hint)}<input {id} type="password" class={input} bind:value={password} autocomplete="new-password" aria-describedby={hint} />{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (adding = false)}>Cancel</Button>
		<Button type="submit" form="add-user" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create user'}</Button>
	{/snippet}
</Dialog>
