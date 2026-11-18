<script lang="ts">
	import { confirmState } from '#lib/confirm.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Dialog } from '#lib/components/ui/dialog/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';

	const r = $derived(confirmState.request);
	let value = $state('');
	$effect(() => {
		if (r) value = '';
	});
	const open = {
		get value() {
			return !!confirmState.request;
		},
		set value(v: boolean) {
			if (!v) confirmState.settle(false);
		}
	};
	function ok(e?: SubmitEvent) {
		e?.preventDefault();
		confirmState.settle(r?.input ? value : true);
	}
	const field = 'border-input bg-card placeholder:text-muted-foreground w-full rounded-xl border px-3.5 text-[15px] outline-none focus-visible:border-ring';
</script>

{#if r}
	<Dialog bind:open={open.value} title={r.title} description={r.body}>
		{#if r.input}
			<form id="confirm-form" onsubmit={ok} class="flex flex-col gap-1.5">
				<Label for="confirm-input">{r.input.label}</Label>
				{#if r.input.multiline}
					<!-- svelte-ignore a11y_autofocus -->
					<textarea id="confirm-input" autofocus required bind:value placeholder={r.input.placeholder} class="{field} min-h-24 py-2.5"></textarea>
				{:else}
					<!-- svelte-ignore a11y_autofocus -->
					<input id="confirm-input" autofocus required bind:value placeholder={r.input.placeholder} class="{field} h-11" />
				{/if}
			</form>
		{/if}
		{#snippet footer()}
			<Button variant="ghost" onclick={() => confirmState.settle(false)}>Cancel</Button>
			<Button
				type={r.input ? 'submit' : 'button'}
				form={r.input ? 'confirm-form' : undefined}
				onclick={r.input ? undefined : () => ok()}
				disabled={!!r.input && !value.trim()}
				class={r.destructive ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}
			>{r.confirmLabel ?? 'Confirm'}</Button>
		{/snippet}
	</Dialog>
{/if}
