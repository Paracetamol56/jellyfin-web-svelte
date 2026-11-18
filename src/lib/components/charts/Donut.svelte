<script lang="ts">
	import { arc, format, pie } from 'd3';

	import type { Slice } from './types.ts';
	let {
		data,
		summary,
		centerLabel = '',
		centerValue,
		size = 168,
		formatValue
	}: { data: Slice[]; summary: string; centerLabel?: string; centerValue?: string; size?: number; formatValue?: (v: number) => string } = $props();

	const fmt = format(',');
	const show = (v: number) => (formatValue ? formatValue(v) : fmt(v));
	const total = $derived(data.reduce((n, d) => n + d.value, 0));
	const slices = $derived(pie<Slice>().value((d) => d.value).sort(null).padAngle(0.02)(data.filter((d) => d.value > 0)));
	const r = $derived(size / 2);
	const path = $derived(arc<(typeof slices)[number]>().innerRadius(r * 0.62).outerRadius(r - 2).cornerRadius(3));
	let hover = $state<string | null>(null);
	const pct = (v: number) => (total ? `${v / total >= 0.1 ? Math.round((v / total) * 100) : (Math.round((v / total) * 1000) / 10).toString()}%` : '0%');
</script>

<div class="flex flex-wrap items-center gap-x-8 gap-y-4">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label={summary} class="shrink-0">
		<g transform="translate({r},{r})">
			{#each slices as s (s.data.label)}
				<path
					d={path(s) ?? ''}
					style="fill: {s.data.color}"
					opacity={hover == null || hover === s.data.label ? 1 : 0.4}
					onpointerenter={() => (hover = s.data.label)}
					onpointerleave={() => (hover = null)}
					role="presentation"
				/>
			{/each}
			<text text-anchor="middle" dy="-0.1em" class="fill-foreground font-display text-[22px] font-extrabold tabular-nums">{centerValue ?? fmt(total)}</text>
			{#if centerLabel}<text text-anchor="middle" dy="1.4em" class="fill-muted-foreground text-[11px]">{centerLabel}</text>{/if}
		</g>
	</svg>
	<ul class="flex min-w-40 flex-1 flex-col gap-1.5 text-sm" aria-label="Legend">
		{#each data as d (d.label)}
			<li
				class="flex items-center gap-2.5 rounded-lg px-1.5 py-0.5 {hover === d.label ? 'bg-accent' : ''}"
				onpointerenter={() => (hover = d.label)}
				onpointerleave={() => (hover = null)}
			>
				<span class="size-3 shrink-0 rounded-sm" style="background: {d.color}"></span>
				<span class="flex-1">{d.label}</span>
				<span class="font-semibold tabular-nums">{show(d.value)}</span>
				<span class="text-muted-foreground w-12 text-right text-xs tabular-nums">{pct(d.value)}</span>
			</li>
		{/each}
	</ul>
</div>
