<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import User from '@lucide/svelte/icons/user';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { viewIcon } from './view-icons.ts';

	let { views }: { views: BaseItemDto[] } = $props();

	// Room for Home + three libraries + Profile on a phone.
	const shown = $derived(views.slice(0, 3));
	const link =
		'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px] text-[11px] text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-primary';
</script>

<nav aria-label="Primary" class="border-border bg-background flex border-t px-1 pt-1.5 pb-[max(18px,env(safe-area-inset-bottom))] md:hidden">
	<a href={resolve('/')} class={link} aria-current={page.route.id === '/' ? 'page' : undefined}>
		<House class="size-[22px]" aria-hidden="true" />Home
	</a>
	{#each shown as v (v.Id)}
		{@const Icon = viewIcon(v.CollectionType)}
		<a href={resolve('/library/[id]', { id: v.Id! })} class={link} aria-current={page.params.id === v.Id ? 'page' : undefined}>
			<Icon class="size-[22px]" aria-hidden="true" /><span class="max-w-full truncate px-1">{v.Name}</span>
		</a>
	{/each}
	<a href={resolve('/settings')} class={link} aria-current={page.route.id === '/settings' ? 'page' : undefined}>
		<User class="size-[22px]" aria-hidden="true" />Profile
	</a>
</nav>
