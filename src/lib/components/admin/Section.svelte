<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, actions, children, id }: { title: string; description?: string; actions?: Snippet; children: Snippet; id?: string } = $props();
	const uid = $props.id();
</script>

<section {id} aria-labelledby="{uid}-h" class="bg-card border-border flex flex-col gap-5 rounded-[20px] border p-5 md:p-6">
	<div class="flex flex-wrap items-start gap-3">
		<div class="min-w-0 flex-1">
			<h2 id="{uid}-h" class="text-xl font-bold">{title}</h2>
			{#if description}<p class="text-muted-foreground mt-1 text-sm">{description}</p>{/if}
		</div>
		{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{@render children()}
</section>
