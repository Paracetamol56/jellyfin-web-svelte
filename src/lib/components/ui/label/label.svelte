<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.ts';

	let { ref = $bindable(null), class: className, ...rest }: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root bind:ref class={cn('text-sm font-semibold select-none', className)} {...rest} />
