<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Settings from '@lucide/svelte/icons/settings';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '#lib/api/session.svelte.ts';
	import { userImage } from '#lib/api/images.ts';

	let { class: className = '' }: { class?: string } = $props();

	const name = $derived(session.user?.Name ?? '');
	const avatar = $derived(userImage(session.userId, session.user?.PrimaryImageTag));

	async function signOut() {
		await session.logout();
		goto(resolve('/login'));
	}

	const item =
		'flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none data-highlighted:bg-accent';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		aria-label="Account: {name}"
		class="font-display text-ink grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full text-[17px] font-extrabold [background:var(--brand-grad)] {className}"
	>
		{#if avatar}
			<img src={avatar} alt="" class="size-full object-cover" />
		{:else}
			{name.slice(0, 1).toUpperCase()}
		{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={8}
			class="bg-popover text-popover-foreground border-border z-50 min-w-56 rounded-2xl border p-1.5 shadow-2xl"
		>
			<div class="px-3 pt-2 pb-2.5">
				<div class="font-semibold">{name}</div>
				<div class="text-muted-foreground text-xs">{session.isAdmin ? 'Administrator' : 'User'}</div>
			</div>
			<DropdownMenu.Separator class="bg-border my-1 h-px" />
			{#if session.isAdmin}
				<DropdownMenu.Item class={item} onSelect={() => goto(resolve('/admin'))}>
					<LayoutDashboard class="size-4" /> Dashboard
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Item class={item} onSelect={() => goto(resolve('/settings'))}>
				<Settings class="size-4" /> Settings
			</DropdownMenu.Item>
			<DropdownMenu.Item class={item} onSelect={signOut}>
				<LogOut class="size-4" /> Sign out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
