<script lang="ts">
	// Right-click (or long-press) menu around any item UI.
	import { ContextMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import ItemMenu, { type MenuContext } from './ItemMenu.svelte';
	import { menuContent } from './styles.ts';

	let { item, context, class: className = '', children }: { item: BaseItemDto; context?: MenuContext; class?: string; children: Snippet } = $props();
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger class={className}>
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content collisionPadding={12} class={menuContent}>
			<ItemMenu {item} {context} />
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
