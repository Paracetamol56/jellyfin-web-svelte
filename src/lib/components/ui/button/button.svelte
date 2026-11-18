<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				player: 'bg-player text-player-foreground hover:bg-player/90 shadow-[0_8px_24px_-6px_var(--player)]',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				outline: 'border border-border bg-transparent hover:bg-accent',
				ghost: 'bg-transparent hover:bg-accent',
				overlay: 'border border-white/25 bg-ink/40 text-white hover:bg-ink/60',
				link: 'h-auto px-0 text-primary hover:underline'
			},
			size: {
				default: 'h-11 px-5 text-sm',
				sm: 'h-9 px-4 text-sm',
				lg: 'h-13 px-6 text-base',
				icon: 'size-11',
				'icon-lg': 'size-12',
				'icon-xl': 'size-16'
			}
		},
		defaultVariants: { variant: 'default', size: 'default' }
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.ts';

	type Props = WithElementRef<HTMLButtonAttributes & HTMLAnchorAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	};

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button bind:this={ref} class={cn(buttonVariants({ variant, size }), className)} {type} {disabled} {...rest}>
		{@render children?.()}
	</button>
{/if}
