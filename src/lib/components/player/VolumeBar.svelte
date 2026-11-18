<script lang="ts">
	// Knob-less volume track: a filled bar with an invisible native range on top (keyboard + screen readers).
	import { player } from '#lib/player/player.svelte.ts';

	let { id, class: className = '' }: { id: string; class?: string } = $props();
	const pct = $derived(player.muted ? 0 : Math.round(player.volume * 100));
</script>

<div class="group/vol relative flex h-8 items-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--seek-accent) {className}">
	<span aria-hidden="true" class="absolute inset-x-0 h-1.5 rounded-full bg-(--seek-line) transition-[height] group-hover/vol:h-2"></span>
	<span aria-hidden="true" class="absolute left-0 h-1.5 rounded-full bg-(--seek-accent) transition-[height] group-hover/vol:h-2" style="width: {pct}%"></span>
	<label for={id} class="sr-only">Volume</label>
	<input
		{id}
		type="range"
		min="0"
		max="100"
		value={pct}
		aria-valuetext="{pct}%"
		oninput={(e) => player.setVolume(+e.currentTarget.value / 100)}
		class="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
	/>
</div>
