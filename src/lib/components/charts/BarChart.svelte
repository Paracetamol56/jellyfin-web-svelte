<script lang="ts" generics="T extends object">
	import { format, max, scaleBand, scaleLinear, stack } from 'd3';
	import ChartTip from './ChartTip.svelte';
	import type { Series } from './types.ts';

	let {
		data,
		x,
		series,
		summary,
		height = 240,
		maxLabels = 12,
		unit = ''
	}: { data: T[]; x: keyof T & string; series: Series[]; summary: string; height?: number; maxLabels?: number; unit?: string } = $props();

	const m = { top: 12, right: 8, bottom: 30, left: 40 };
	let width = $state(640);
	let hover = $state<number | null>(null);

	const num = (d: T, k: string) => Number((d as Record<string, unknown>)[k] ?? 0);
	const innerW = $derived(Math.max(0, width - m.left - m.right));
	const innerH = $derived(height - m.top - m.bottom);
	const labels = $derived(data.map((d) => String((d as Record<string, unknown>)[x])));
	const xs = $derived(scaleBand<string>().domain(labels).range([0, innerW]).padding(0.22));
	const stacked = $derived(stack<T>().keys(series.map((s) => s.key)).value((d, k) => num(d, k))(data));
	const top = $derived(max(stacked, (s) => max(s, (d) => d[1])) ?? 0);
	const ys = $derived(scaleLinear().domain([0, Math.max(1, top)]).nice().range([innerH, 0]));
	const ticks = $derived(ys.ticks(4).filter((t) => Number.isInteger(t)));
	const every = $derived(Math.max(1, Math.ceil(labels.length / maxLabels)));
	const fmt = format(',');
	const total = $derived(data.reduce((n, d) => n + series.reduce((a, s) => a + num(d, s.key), 0), 0));
</script>

<div class="relative" bind:clientWidth={width}>
	<svg {width} {height} role="img" aria-label={summary} class="block overflow-visible">
		<g transform="translate({m.left},{m.top})">
			{#each ticks as t (t)}
				<line x1="0" x2={innerW} y1={ys(t)} y2={ys(t)} class="stroke-border" stroke-dasharray={t === 0 ? undefined : '3 4'} />
				<text x="-8" y={ys(t)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px] tabular-nums">{fmt(t)}</text>
			{/each}
			{#each stacked as s, si (s.key)}
				<g style="fill: {series[si].color}">
					{#each s as d, i (i)}
						{#if d[1] > d[0]}
							<rect
								x={xs(labels[i])}
								y={ys(d[1])}
								width={xs.bandwidth()}
								height={Math.max(0, ys(d[0]) - ys(d[1]))}
								rx="3"
								opacity={hover == null || hover === i ? 1 : 0.45}
							/>
						{/if}
					{/each}
				</g>
			{/each}
			{#each labels as l, i (i)}
				{#if i % every === 0}
					<text x={(xs(l) ?? 0) + xs.bandwidth() / 2} y={innerH + 18} text-anchor="middle" class="fill-muted-foreground text-[11px]">{l}</text>
				{/if}
				<rect
					x={xs(l)! - xs.step() * 0.11}
					y="0"
					width={xs.step()}
					height={innerH}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (hover = i)}
					onpointermove={() => (hover = i)}
					onpointerleave={() => (hover = null)}
				/>
			{/each}
		</g>
	</svg>
	{#if hover != null}
		{@const d = data[hover]}
		<ChartTip x={m.left + (xs(labels[hover]) ?? 0) + xs.bandwidth() / 2} y={m.top + 4} {width}>
			<div class="mb-1 font-semibold">{labels[hover]}</div>
			{#each series as s (s.key)}
				<div class="flex items-center gap-2">
					<span class="size-2.5 rounded-sm" style="background: {s.color}"></span>
					<span class="text-muted-foreground">{s.label}</span>
					<span class="ml-auto pl-4 font-semibold tabular-nums">{fmt(num(d, s.key))}{unit}</span>
				</div>
			{/each}
		</ChartTip>
	{/if}
	{#if series.length > 1}
		<ul class="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
			{#each series as s (s.key)}<li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background: {s.color}"></span>{s.label}</li>{/each}
		</ul>
	{/if}
	<div class="sr-only"><table>
		<caption>{summary} ({fmt(total)} in total)</caption>
		<thead><tr><th scope="col">{x}</th>{#each series as s (s.key)}<th scope="col">{s.label}</th>{/each}</tr></thead>
		<tbody>
			{#each data as d, i (i)}
				<tr><th scope="row">{labels[i]}</th>{#each series as s (s.key)}<td>{num(d, s.key)}</td>{/each}</tr>
			{/each}
		</tbody>
	</table></div>
</div>
