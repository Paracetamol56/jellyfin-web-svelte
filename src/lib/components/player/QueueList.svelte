<script lang="ts">
	// The play queue: click to jump, drag the handle (or ↑/↓ on it) to reorder, ⋯ / right-click for more.
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { tick } from 'svelte';
	import { primaryImage } from '#lib/api/images.ts';
	import { clock, ticksToSeconds } from '#lib/api/format.ts';
	import { player } from '#lib/player/player.svelte.ts';
	import ItemContextMenu from '#lib/components/menu/ItemContextMenu.svelte';
	import ItemMenuButton from '#lib/components/menu/ItemMenuButton.svelte';
	import Equalizer from './Equalizer.svelte';

	let { class: className = '' }: { class?: string } = $props();

	let dragFrom = $state<number | null>(null);
	let dropAt = $state<number | null>(null);
	let announce = $state('');
	let list = $state<HTMLOListElement | null>(null);

	function drop(to: number) {
		if (dragFrom != null && dragFrom !== to) {
			const name = player.queue[dragFrom]?.Name;
			player.move(dragFrom, to);
			announce = `${name} moved to position ${to + 1}`;
		}
		dragFrom = dropAt = null;
	}

	async function onHandleKey(e: KeyboardEvent, i: number) {
		const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
		if (to == null || to < 0 || to >= player.queue.length) return;
		e.preventDefault();
		const entry = player.queue[i];
		player.move(i, to);
		announce = `${entry.Name} moved to position ${to + 1} of ${player.queue.length}`;
		await tick();
		list?.querySelectorAll<HTMLButtonElement>('[data-handle]')[to]?.focus();
	}

	const btn = 'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-(--np-muted) hover:bg-(--np-panel) hover:text-(--np-text)';
</script>

<p class="sr-only" aria-live="polite">{announce}</p>
<ol bind:this={list} class="flex min-h-0 flex-col gap-0.5 overflow-y-auto {className}">
	{#each player.queue as q, i (q)}
		{@const cur = i === player.index}
		{@const thumb = primaryImage(q, 96)}
		<li
			draggable="true"
			ondragstart={(e) => {
				dragFrom = i;
				e.dataTransfer?.setData('text/plain', String(i));
				if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
			}}
			ondragover={(e) => {
				if (dragFrom == null) return;
				e.preventDefault();
				dropAt = i;
			}}
			ondrop={(e) => {
				e.preventDefault();
				drop(i);
			}}
			ondragend={() => (dragFrom = dropAt = null)}
			class="rounded-2xl {dragFrom === i ? 'opacity-40' : ''} {dropAt === i && dragFrom != null && dragFrom !== i
				? dragFrom < i
					? 'shadow-[inset_0_-2px_0_var(--np-accent)]'
					: 'shadow-[inset_0_2px_0_var(--np-accent)]'
				: ''}"
		>
			<ItemContextMenu item={q} context={{ queueIndex: i }} class="group/q flex items-center gap-1 rounded-2xl py-1 pr-0.5 pl-0 {cur ? 'bg-(--np-panel) shadow-[inset_0_0_0_1px_var(--np-accent)]' : ''}">
				<button
					type="button"
					data-handle
					class="{btn} cursor-grab active:cursor-grabbing"
					aria-label="Reorder {q.Name}, position {i + 1} of {player.queue.length}. Use up and down arrows."
					onkeydown={(e) => onHandleKey(e, i)}
				>
					<GripVertical class="size-4" aria-hidden="true" />
				</button>
				<button type="button" aria-label="Play {q.Name}" aria-current={cur ? 'true' : undefined} onclick={() => player.jump(i)} class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1 text-left">
					<span class="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-black/30 shadow-[0_0_0_1px_var(--np-line)]">
						{#if thumb}<img src={thumb} alt="" loading="lazy" draggable="false" class="size-full object-cover" />{/if}
						{#if cur}<span class="absolute inset-0 grid place-items-center bg-black/65 text-white"><Equalizer playing={player.playing} /></span>{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[15px] {cur ? 'font-bold text-(--np-accent)' : 'font-medium'}">{q.Name}</span>
						<span class="block truncate text-xs text-(--np-muted)">{(q.Artists ?? []).join(', ')}</span>
					</span>
					<span class="text-[13px] text-(--np-muted) tabular-nums">{clock(ticksToSeconds(q.RunTimeTicks))}</span>
				</button>
				<ItemMenuButton item={q} context={{ queueIndex: i }} class={btn} iconClass="size-[18px]" />
			</ItemContextMenu>
		</li>
	{/each}
</ol>
