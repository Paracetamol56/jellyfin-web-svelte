<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import ItemMenu, { type MenuContext } from './ItemMenu.svelte';
	import { menuContent } from './styles.ts';

	let {
		item,
		context,
		class: className = 'hover:bg-accent text-muted-foreground hover:text-foreground grid size-9 cursor-pointer place-items-center rounded-full',
		iconClass = 'size-5'
	}: { item: BaseItemDto; context?: MenuContext; class?: string; iconClass?: string } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={className} aria-label="More options for {item.Name}">
		<Ellipsis class={iconClass} aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content align="end" sideOffset={6} collisionPadding={12} class={menuContent}>
			<ItemMenu {item} {context} />
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
