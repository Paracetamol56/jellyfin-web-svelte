<script lang="ts">
	import { format, max, scaleBand, scaleSqrt } from 'd3';
	import type { HeatCell } from '#lib/admin/stats.ts';
	import ChartTip from './ChartTip.svelte';

	let { cells, summary, color = 'var(--chart-1)' }: { cells: HeatCell[]; summary: string; color?: string } = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const m = { top: 4, right: 4, bottom: 24, left: 36 };
	const cellH = 26;
	let width = $state(640);
	let hover = $state<HeatCell | null>(null);

	const innerW = $derived(Math.max(0, width - m.left - m.right));
	const height = $derived(m.top + m.bottom + cellH * 7);
	const xs = $derived(scaleBand<number>().domain([...Array(24).keys()]).range([0, innerW]).padding(0.12));
	const ys = $derived(scaleBand<number>().domain([...Array(7).keys()]).range([0, cellH * 7]).padding(0.12));
	const peak = $derived(max(cells, (c) => c.count) ?? 0);
	const opacity = $derived(scaleSqrt().domain([0, Math.max(1, peak)]).range([0.16, 1]));
	const fmt = format(',');
	const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
	const busiest = $derived(cells.reduce((b, c) => (c.count > b.count ? c : b), cells[0] ?? { weekday: 0, hour: 0, count: 0 }));
</script>

<div class="relative" bind:clientWidth={width}>
	<svg {width} {height} role="img" aria-label="{summary}{peak ? ` Busiest: ${FULL[busiest.weekday]} around ${hourLabel(busiest.hour)}.` : ''}" class="block overflow-visible">
		<g transform="translate({m.left},{m.top})">
			{#each DAYS as d, i (d)}
				<text x="-8" y={(ys(i) ?? 0) + ys.bandwidth() / 2} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px]">{d}</text>
			{/each}
			{#each [0, 3, 6, 9, 12, 15, 18, 21] as h (h)}
				<text x={(xs(h) ?? 0) + xs.bandwidth() / 2} y={cellH * 7 + 16} text-anchor="middle" class="fill-muted-foreground text-[11px] tabular-nums">{String(h).padStart(2, '0')}</text>
			{/each}
			{#each cells as c (c.weekday * 24 + c.hour)}
				<rect
					x={xs(c.hour)}
					y={ys(c.weekday)}
					width={xs.bandwidth()}
					height={ys.bandwidth()}
					rx="4"
					style="fill: {c.count ? color : 'var(--muted)'}"
					opacity={c.count ? opacity(c.count) : 1}
					stroke={hover === c ? 'var(--foreground)' : 'none'}
					role="presentation"
					onpointerenter={() => (hover = c)}
					onpointerleave={() => (hover = null)}
				/>
			{/each}
		</g>
	</svg>
	{#if hover}
		<ChartTip x={m.left + (xs(hover.hour) ?? 0) + xs.bandwidth() / 2} y={m.top + (ys(hover.weekday) ?? 0)} {width}>
			<div class="font-semibold">{FULL[hover.weekday]}, {hourLabel(hover.hour)}</div>
			<div class="text-muted-foreground"><span class="text-foreground font-semibold tabular-nums">{fmt(hover.count)}</span> {hover.count === 1 ? 'play' : 'plays'}</div>
		</ChartTip>
	{/if}
	<div class="text-muted-foreground mt-2 flex items-center gap-2 text-xs" aria-hidden="true">
		Fewer
		{#each [0.16, 0.4, 0.65, 1] as o (o)}<span class="size-3.5 rounded-[4px]" style="background: {color}; opacity: {o}"></span>{/each}
		More
	</div>
	<div class="sr-only"><table>
		<caption>{summary}</caption>
		<thead><tr><th scope="col">Day</th>{#each [...Array(24).keys()] as h (h)}<th scope="col">{hourLabel(h)}</th>{/each}</tr></thead>
		<tbody>
			{#each FULL as d, i (d)}
				<tr><th scope="row">{d}</th>{#each cells.filter((c) => c.weekday === i) as c (c.hour)}<td>{c.count}</td>{/each}</tr>
			{/each}
		</tbody>
	</table></div>
</div>
