<script lang="ts" generics="T extends { t: number }">
	import { area, bisector, curveStepAfter, extent, format, line, max, scaleLinear, scaleTime, timeFormat } from 'd3';
	import ChartTip from './ChartTip.svelte';
	import type { Series as Line } from './types.ts';

	let { data, lines, summary, height = 200, windowMs = 10 * 60_000 }: { data: T[]; lines: Line[]; summary: string; height?: number; windowMs?: number } = $props();

	const m = { top: 12, right: 8, bottom: 28, left: 32 };
	let width = $state(640);
	let hover = $state<number | null>(null);

	const innerW = $derived(Math.max(0, width - m.left - m.right));
	const innerH = $derived(height - m.top - m.bottom);
	const end = $derived(data.length ? data[data.length - 1].t : Date.now());
	const xs = $derived(scaleTime().domain([end - windowMs, end]).range([0, innerW]));
	const top = $derived(max(data, (d) => max(lines, (l) => Number((d as Record<string, unknown>)[l.key] ?? 0))) ?? 0);
	const ys = $derived(scaleLinear().domain([0, Math.max(2, top)]).nice().range([innerH, 0]));
	const yTicks = $derived(ys.ticks(4).filter((t) => Number.isInteger(t)));
	const clock = timeFormat('%H:%M');
	const val = (d: T, k: string) => Number((d as Record<string, unknown>)[k] ?? 0);
	const paths = $derived(
		lines.map((l) => ({
			l,
			line: line<T>().x((d) => xs(d.t)).y((d) => ys(val(d, l.key))).curve(curveStepAfter)(data) ?? '',
			area: area<T>().x((d) => xs(d.t)).y0(innerH).y1((d) => ys(val(d, l.key))).curve(curveStepAfter)(data) ?? ''
		}))
	);
	const bisect = bisector<T, number>((d) => d.t).center;
	const [first] = $derived(extent(data, (d) => d.t));
	const fmt = format(',');

	function onMove(e: PointerEvent) {
		const box = (e.currentTarget as SVGElement).getBoundingClientRect();
		if (!data.length) return;
		hover = bisect(data, +xs.invert(e.clientX - box.left - m.left));
	}
</script>

<div class="relative" bind:clientWidth={width}>
	<svg {width} {height} role="img" aria-label={summary} class="block overflow-visible">
		<g transform="translate({m.left},{m.top})">
			{#each yTicks as t (t)}
				<line x1="0" x2={innerW} y1={ys(t)} y2={ys(t)} class="stroke-border" stroke-dasharray={t === 0 ? undefined : '3 4'} />
				<text x="-8" y={ys(t)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px] tabular-nums">{t}</text>
			{/each}
			{#each xs.ticks(5) as t (+t)}
				<text x={xs(t)} y={innerH + 18} text-anchor="middle" class="fill-muted-foreground text-[11px] tabular-nums">{clock(t)}</text>
			{/each}
			{#each paths as p (p.l.key)}
				<path d={p.area} style="fill: {p.l.color}" opacity="0.14" />
				<path d={p.line} fill="none" style="stroke: {p.l.color}" stroke-width="2" stroke-linejoin="round" />
			{/each}
			{#if hover != null && data[hover]}
				<line x1={xs(data[hover].t)} x2={xs(data[hover].t)} y1="0" y2={innerH} class="stroke-muted-foreground" stroke-dasharray="2 3" />
				{#each lines as l (l.key)}<circle cx={xs(data[hover].t)} cy={ys(val(data[hover], l.key))} r="4" style="fill: {l.color}" class="stroke-card" stroke-width="2" />{/each}
			{/if}
			<rect width={innerW} height={innerH} fill="transparent" role="presentation" onpointermove={onMove} onpointerleave={() => (hover = null)} />
		</g>
	</svg>
	{#if hover != null && data[hover]}
		<ChartTip x={m.left + xs(data[hover].t)} y={m.top + 4} {width}>
			<div class="mb-1 font-semibold tabular-nums">{clock(new Date(data[hover].t))}</div>
			{#each lines as l (l.key)}
				<div class="flex items-center gap-2">
					<span class="size-2.5 rounded-sm" style="background: {l.color}"></span><span class="text-muted-foreground">{l.label}</span>
					<span class="ml-auto pl-4 font-semibold tabular-nums">{fmt(val(data[hover], l.key))}</span>
				</div>
			{/each}
		</ChartTip>
	{/if}
	<ul class="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
		{#each lines as l (l.key)}<li class="flex items-center gap-1.5"><span class="h-0.5 w-4 rounded" style="background: {l.color}"></span>{l.label}</li>{/each}
	</ul>
	<div class="sr-only"><table>
		<caption>{summary}{first ? `, since ${clock(new Date(first))}` : ''}</caption>
		<thead><tr><th scope="col">Time</th>{#each lines as l (l.key)}<th scope="col">{l.label}</th>{/each}</tr></thead>
		<tbody>
			{#each data.slice(-30) as d (d.t)}
				<tr><th scope="row">{clock(new Date(d.t))}</th>{#each lines as l (l.key)}<td>{val(d, l.key)}</td>{/each}</tr>
			{/each}
		</tbody>
	</table></div>
</div>
