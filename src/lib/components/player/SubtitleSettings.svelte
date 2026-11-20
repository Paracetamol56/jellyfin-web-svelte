<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import { COLORS, OUTLINES, SIZES, subtitleStyle as st, type SubtitleColor, type SubtitleOutline, type SubtitleSize } from '#lib/player/subtitle-style.svelte.ts';

	// Opened from the Subtitles menu. A panel above the controls rather than a menu, because it holds
	// several choices at once and shows a preview.
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let panel = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (open) setTimeout(() => panel?.focus(), 0);
	});

	const group = 'flex flex-col gap-2';
	const label = 'text-xs font-bold tracking-[0.08em] text-[#D0CEDA] uppercase';
	const seg = 'flex flex-wrap gap-1 rounded-full border border-white/20 p-1';
	const segBtn = 'h-9 cursor-pointer rounded-full px-3.5 text-sm text-[#D0CEDA] hover:bg-white/10 aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-[#0B0B10]';
</script>

{#if open}
	<div
		bind:this={panel}
		role="dialog"
		aria-label="Subtitle settings"
		tabindex="-1"
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				open = false;
			}
		}}
		class="absolute right-3 bottom-28 z-[60] flex max-h-[calc(100dvh-8rem)] w-[min(360px,calc(100vw-24px))] flex-col gap-5 overflow-y-auto rounded-2xl border border-white/15 bg-[#1A1A21] p-5 text-white shadow-2xl outline-none md:right-8"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-base font-bold">Subtitle settings</h2>
			<button type="button" class="grid size-11 -mr-2 cursor-pointer place-items-center rounded-full hover:bg-white/10" aria-label="Close subtitle settings" onclick={() => (open = false)}><X class="size-5" /></button>
		</div>
		<!-- Same variables as the video, so this is how the subtitles will look. -->
			<div aria-hidden="true" class="grid h-24 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#3b3f58,#14151f_60%,#2a3b47)] px-3 text-center" style={st.vars}>
				<span
					class="leading-snug"
					style="font-size: calc(var(--sub-size) * 0.5 + 8px); color: var(--sub-color); background: var(--sub-bg); text-shadow: var(--sub-shadow); font-style: var(--sub-italic)"
				>This is how subtitles look.</span>
			</div>

			<div class={group}>
				<span id="ss-size" class={label}>Size</span>
				<div role="group" aria-labelledby="ss-size" class={seg}>
					{#each Object.entries(SIZES) as [key, s] (key)}
						<button type="button" class={segBtn} aria-pressed={st.value.size === key} onclick={() => st.set({ size: key as SubtitleSize })}>{s.label}</button>
					{/each}
				</div>
			</div>

			<div class={group}>
				<span id="ss-color" class={label}>Colour</span>
				<div role="group" aria-labelledby="ss-color" class="flex gap-2">
					{#each Object.entries(COLORS) as [key, c] (key)}
						<button
							type="button"
							class="grid size-11 cursor-pointer place-items-center rounded-full border-2 border-transparent aria-pressed:border-white"
							aria-label={c.label}
							aria-pressed={st.value.color === key}
							onclick={() => st.set({ color: key as SubtitleColor })}
						>
							<span class="size-7 rounded-full border border-white/40" style="background: {c.css}"></span>
						</button>
					{/each}
				</div>
			</div>

			<div class={group}>
				<span id="ss-outline" class={label}>Letter border</span>
				<div role="group" aria-labelledby="ss-outline" class={seg}>
					{#each Object.entries(OUTLINES) as [key, o] (key)}
						<button type="button" class={segBtn} aria-pressed={st.value.outline === key} onclick={() => st.set({ outline: key as SubtitleOutline })}>{o.label}</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-1">
				<label class="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
					<span>Black box behind text</span>
					<input type="checkbox" class="size-5 accent-[#33B7E6]" checked={st.value.box} onchange={(e) => st.set({ box: e.currentTarget.checked })} />
				</label>
				<label class="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
					<span>Italics from the subtitle file</span>
					<input type="checkbox" class="size-5 accent-[#33B7E6]" checked={st.value.italic} onchange={(e) => st.set({ italic: e.currentTarget.checked })} />
				</label>
			</div>

			<button
				type="button"
				class="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 text-sm font-semibold hover:bg-white/10 disabled:cursor-default disabled:opacity-50"
				disabled={st.isDefault}
				onclick={() => st.reset()}
			><RotateCcw class="size-4" aria-hidden="true" />Reset to defaults</button>
	</div>
{/if}
