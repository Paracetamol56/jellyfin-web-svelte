<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Play from '@lucide/svelte/icons/play';
	import Square from '@lucide/svelte/icons/square';
	import type { TaskInfo, TaskTriggerInfo } from '@jellyfin/sdk/lib/generated-client/models';
	import { adminKeys, getTasks, startTask, stopTask } from '#lib/admin/api.ts';
	import { ago, ticksToSeconds } from '#lib/api/format.ts';
	import { queryClient } from '#lib/query-client.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import Meter from '#lib/components/admin/Meter.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import { pill } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';
	import { input } from '#lib/components/admin/styles.ts';

	const tasks = createQuery(() => ({
		queryKey: adminKeys.tasks,
		queryFn: getTasks,
		refetchInterval: (q) => ((q.state.data ?? []).some((t) => t.State !== 'Idle') ? 2000 : 15_000)
	}));
	let search = $state('');
	const visible = $derived((tasks.data ?? []).filter((t) => !search || `${t.Name} ${t.Description} ${t.Category}`.toLowerCase().includes(search.toLowerCase())));
	const failed = $derived((tasks.data ?? []).filter((t) => t.LastExecutionResult?.Status === 'Failed' && t.State === 'Idle'));
	const groups = $derived.by(() => {
		const m = new Map<string, TaskInfo[]>();
		for (const t of visible) m.set(t.Category ?? 'Other', [...(m.get(t.Category ?? 'Other') ?? []), t]);
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	function hhmm(ticks: number | null | undefined): string {
		const s = ticksToSeconds(ticks);
		return new Date(Date.UTC(2000, 0, 1, Math.floor(s / 3600), Math.floor((s % 3600) / 60))).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
	}
	function every(ticks: number | null | undefined): string {
		const h = ticksToSeconds(ticks) / 3600;
		return h >= 24 && h % 24 === 0 ? `every ${h / 24 === 1 ? 'day' : `${h / 24} days`}` : h >= 1 ? `every ${h === 1 ? 'hour' : `${+h.toFixed(1)} hours`}` : `every ${Math.round(h * 60)} minutes`;
	}
	/** Triggers in plain words: "Daily at 3:00 AM · At startup". */
	function schedule(triggers: TaskTriggerInfo[] | null | undefined): string {
		if (!triggers?.length) return 'Manual only';
		return triggers
			.map((t) =>
				t.Type === 'DailyTrigger' ? `Daily at ${hhmm(t.TimeOfDayTicks)}`
				: t.Type === 'WeeklyTrigger' ? `${t.DayOfWeek}s at ${hhmm(t.TimeOfDayTicks)}`
				: t.Type === 'IntervalTrigger' ? every(t.IntervalTicks)[0].toUpperCase() + every(t.IntervalTicks).slice(1)
				: t.Type === 'StartupTrigger' ? 'At startup'
				: t.Type ?? ''
			)
			.join(' · ');
	}
	function took(t: TaskInfo): string {
		const r = t.LastExecutionResult;
		if (!r?.StartTimeUtc || !r.EndTimeUtc) return '';
		const s = (new Date(r.EndTimeUtc).getTime() - new Date(r.StartTimeUtc).getTime()) / 1000;
		return s < 60 ? `${Math.max(1, Math.round(s))} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
	}
	async function run(t: TaskInfo) {
		await (t.State === 'Idle' ? startTask(t.Id!) : stopTask(t.Id!));
		toasts.show(t.State === 'Idle' ? `Started “${t.Name}”` : `Stopping “${t.Name}”`);
		queryClient.invalidateQueries({ queryKey: adminKeys.tasks });
	}
	const status: Record<string, string> = { Completed: 'bg-primary/15 text-primary', Failed: 'bg-destructive/15 text-destructive', Cancelled: 'bg-secondary text-muted-foreground', Aborted: 'bg-destructive/15 text-destructive' };
</script>

<header>
	<h1 class="text-4xl font-extrabold">Scheduled tasks</h1>
	<p class="text-muted-foreground mt-1 text-sm">Maintenance the server runs on its own. Run any of them now if you need to.</p>
</header>

{#if failed.length}
	<section aria-labelledby="attention" class="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-[20px] border p-5">
		<h2 id="attention" class="text-lg font-bold">Needs attention</h2>
		<ul class="flex flex-col gap-2">
			{#each failed as t (t.Id)}
				<li class="flex flex-wrap items-center gap-3">
					<span class="min-w-0 flex-1"><strong>{t.Name}</strong> <span class="text-muted-foreground">({t.Category}) failed {ago(t.LastExecutionResult?.EndTimeUtc)}</span>{#if t.LastExecutionResult?.ErrorMessage}<span class="text-destructive block text-sm">{t.LastExecutionResult.ErrorMessage}</span>{/if}</span>
					<Button variant="outline" size="sm" onclick={() => run(t)} aria-label="Run {t.Name} again"><Play aria-hidden="true" />Run again</Button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<div>
	<label for="task-search" class="sr-only">Filter tasks</label>
	<input id="task-search" type="search" class="{input} max-w-sm" placeholder="Filter tasks" bind:value={search} />
</div>

{#if tasks.isPending}<Skeleton class="h-80" />{/if}
{#each groups as [category, list] (category)}
	<Section title={category}>
		<ul class="divide-border -my-2 flex flex-col divide-y">
			{#each list as t (t.Id)}
				{@const r = t.LastExecutionResult}
				<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
					<div class="min-w-0 flex-[1_1_320px]">
						<p class="font-semibold">{t.Name}</p>
						<p class="text-muted-foreground text-sm">{t.Description}</p>
						<p class="text-muted-foreground mt-1 text-xs">
							{schedule(t.Triggers)}{#if r?.EndTimeUtc}{` · last run ${ago(r.EndTimeUtc)}${took(t) ? ` (${took(t)})` : ''}`}{/if}
						</p>
						{#if r?.Status === 'Failed' && r.ErrorMessage}<p class="text-destructive mt-1 text-xs">{r.ErrorMessage}</p>{/if}
					</div>
					{#if t.State !== 'Idle'}
						<div class="flex w-40 items-center gap-2">
							<Meter value={t.CurrentProgressPercentage ?? 0} label="{t.Name} progress" />
							<span class="text-muted-foreground text-xs tabular-nums">{Math.round(t.CurrentProgressPercentage ?? 0)}%</span>
						</div>
					{:else if r?.Status}
						<span class="{pill} {status[r.Status] ?? 'bg-secondary'}">{r.Status}</span>
					{/if}
					<Button variant="outline" size="sm" disabled={t.State === 'Cancelling'} onclick={() => run(t)} aria-label="{t.State === 'Idle' ? 'Run' : 'Stop'} {t.Name}">
						{#if t.State === 'Idle'}<Play aria-hidden="true" />Run{:else}<Square aria-hidden="true" />Stop{/if}
					</Button>
				</li>
			{/each}
		</ul>
	</Section>
{/each}
