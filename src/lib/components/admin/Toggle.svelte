<script lang="ts">
	// A labelled on/off row (settings switch).
	import { Switch } from 'bits-ui';
	// No fallback on `checked`: servers may omit a setting, and binding undefined to a fallback prop throws.
	let { checked = $bindable(), label, description, disabled = false }: { checked?: boolean | null; label: string; description?: string; disabled?: boolean } = $props();
	const id = $props.id();
</script>

<div class="flex items-start gap-4 py-1">
	<div class="min-w-0 flex-1">
		<label for={id} class="block cursor-pointer font-medium">{label}</label>
		{#if description}<p id="{id}-d" class="text-muted-foreground mt-0.5 text-sm">{description}</p>{/if}
	</div>
	<Switch.Root
		{id}
		checked={!!checked}
		onCheckedChange={(v) => (checked = v)}
		{disabled}
		aria-describedby={description ? `${id}-d` : undefined}
		class="data-[state=checked]:bg-primary bg-input mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:opacity-50"
	>
		<Switch.Thumb class="bg-background block size-6 rounded-full shadow transition-transform data-[state=checked]:translate-x-5" />
	</Switch.Root>
</div>
