<script lang="ts">
	let { playing }: { playing: boolean } = $props();
</script>

<span class="flex h-4 items-end gap-[2px]" aria-hidden="true">
	{#each [0, -0.35, -0.7] as delay (delay)}
		<span
			class="block h-full w-[3px] origin-bottom animate-[eq_1s_ease-in-out_infinite] rounded-[2px] bg-current motion-reduce:animate-none"
			style="animation-delay: {delay}s; animation-play-state: {playing ? 'running' : 'paused'}"
		></span>
	{/each}
</span>
