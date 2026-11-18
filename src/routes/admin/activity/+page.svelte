<script lang="ts">
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import Download from '@lucide/svelte/icons/download';
	import { Tabs } from 'bits-ui';
	import { adminKeys, getActivity, getLogFile, getLogFiles, logDownloadUrl } from '#lib/admin/api.ts';
	import { ago, bytes } from '#lib/api/format.ts';
	import Section from '#lib/components/admin/Section.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { input, pill, select } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	let tab = $state('activity');

	// ── Activity ───────────────────────────────────────────
	let severity = $state('');
	let usersOnly = $state(false);
	const PAGE = 50;
	const activity = createInfiniteQuery(() => ({
		queryKey: adminKeys.activity({ severity, usersOnly }),
		initialPageParam: 0,
		queryFn: ({ pageParam }) => getActivity({ start: pageParam, limit: PAGE, severity, usersOnly }),
		getNextPageParam: (last, all) => (all.length * PAGE < (last.TotalRecordCount ?? 0) ? all.length * PAGE : undefined),
		refetchInterval: 30_000
	}));
	const entries = $derived(activity.data?.pages.flatMap((p) => p.Items ?? []) ?? []);
	const sev: Record<string, string> = { Error: 'bg-destructive/15 text-destructive', Critical: 'bg-destructive/15 text-destructive', Warning: 'bg-[#E8A23A]/15 text-[#B5701A] dark:text-[#E8A23A]' };

	// ── Logs ───────────────────────────────────────────────
	const files = createQuery(() => ({ queryKey: adminKeys.logs, queryFn: getLogFiles, enabled: tab === 'logs' }));
	const sortedFiles = $derived([...(files.data ?? [])].sort((a, b) => (b.DateModified ?? '').localeCompare(a.DateModified ?? '')));
	let chosen = $state<string | null>(null);
	const current = $derived(chosen ?? sortedFiles[0]?.Name ?? null);
	const log = createQuery(() => ({ queryKey: adminKeys.log(current ?? ''), queryFn: () => getLogFile(current!), enabled: tab === 'logs' && !!current }));

	const LEVELS = [['ERR', 'Errors'], ['WRN', 'Warnings'], ['INF', 'Info'], ['DBG', 'Debug']] as const;
	let levels = $state<string[]>(['ERR', 'WRN', 'INF']);
	let search = $state('');
	let showAll = $state(false);
	const MAX = 1500;
	// Jellyfin log lines look like "[2026-11-15 10:00:00.000 +00:00] [INF] [12] Source: message".
	// Continuation lines (stack traces) inherit the level of the line above.
	const parsed = $derived.by(() => {
		const out: { text: string; level: string }[] = [];
		let level = 'INF';
		for (const line of (log.data ?? '').split('\n')) {
			const m = /^\[[^\]]+\] \[(\w{3})\]/.exec(line);
			if (m) level = m[1];
			if (line) out.push({ text: line, level });
		}
		return out;
	});
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return parsed.filter((l) => (levels.includes(l.level) || (l.level === 'FTL' && levels.includes('ERR')) || (l.level === 'VRB' && levels.includes('DBG'))) && (!q || l.text.toLowerCase().includes(q)));
	});
	const shown = $derived(showAll ? filtered : filtered.slice(-MAX));
	const tone: Record<string, string> = { ERR: 'text-destructive', FTL: 'text-destructive', WRN: 'text-[#B5701A] dark:text-[#E8A23A]', DBG: 'text-muted-foreground', VRB: 'text-muted-foreground' };

	const tabsList = 'border-border flex gap-1 border-b';
	const trigger = 'text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary -mb-px cursor-pointer border-b-2 border-transparent px-3 py-3 text-[15px] data-[state=active]:font-semibold';
	const chip = 'h-9 cursor-pointer rounded-full border border-border px-3.5 text-sm aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-semibold';
</script>

<header>
	<h1 class="text-4xl font-extrabold">Activity & logs</h1>
	<p class="text-muted-foreground mt-1 text-sm">What happened on the server, from sign-ins to errors.</p>
</header>

<Tabs.Root bind:value={tab} class="flex flex-col gap-6">
	<Tabs.List class={tabsList}>
		<Tabs.Trigger value="activity" class={trigger}>Activity</Tabs.Trigger>
		<Tabs.Trigger value="logs" class={trigger}>Server logs</Tabs.Trigger>
	</Tabs.List>

	<Tabs.Content value="activity" class="flex flex-col gap-6">
		<Section title="Activity">
			{#snippet actions()}
				<label for="sev" class="sr-only">Severity</label>
				<select id="sev" class="{select} h-10 w-auto" bind:value={severity}>
					<option value="">All severities</option><option value="Information">Information</option><option value="Warning">Warnings</option><option value="Error">Errors</option>
				</select>
			{/snippet}
			<Toggle bind:checked={usersOnly} label="Only people's activity" description="Hide automatic server events." />
			{#if activity.isPending}<Skeleton class="h-60" />{/if}
			<ol class="divide-border flex flex-col divide-y">
				{#each entries as e (e.Id)}
					<li class="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
						<time datetime={e.Date} class="text-muted-foreground w-36 shrink-0 text-xs tabular-nums" title={e.Date ? new Date(e.Date).toLocaleString() : ''}>{e.Date ? new Date(e.Date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}</time>
						<div class="min-w-0 flex-1">
							<p class="font-medium">{e.Name}{#if e.Severity && sev[e.Severity]}<span class="{pill} {sev[e.Severity]} ml-2">{e.Severity}</span>{/if}</p>
							{#if e.ShortOverview || e.Overview}<p class="text-muted-foreground text-sm break-words">{e.ShortOverview ?? e.Overview}</p>{/if}
						</div>
					</li>
				{:else}
					{#if activity.data}<li class="text-muted-foreground py-3 text-sm">Nothing matches.</li>{/if}
				{/each}
			</ol>
			{#if activity.hasNextPage}
				<Button variant="outline" class="w-fit" disabled={activity.isFetchingNextPage} onclick={() => activity.fetchNextPage()}>{activity.isFetchingNextPage ? 'Loading…' : 'Load older'}</Button>
			{/if}
		</Section>
	</Tabs.Content>

	<Tabs.Content value="logs" class="flex flex-col gap-6">
		<Section title="Server logs">
			{#snippet actions()}
				{#if current}
					<Button variant="outline" size="sm" href={logDownloadUrl(current)} download={current}><Download aria-hidden="true" />Download</Button>
				{/if}
			{/snippet}
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex min-w-60 flex-col gap-1.5">
					<label for="logfile" class="text-sm font-semibold">File</label>
					<select id="logfile" class={select} value={current ?? ''} onchange={(e) => ((chosen = e.currentTarget.value), (showAll = false))}>
						{#each sortedFiles as f (f.Name)}<option value={f.Name}>{f.Name} · {bytes(f.Size)} · {ago(f.DateModified)}</option>{/each}
					</select>
				</div>
				<div class="flex min-w-60 flex-1 flex-col gap-1.5">
					<label for="logsearch" class="text-sm font-semibold">Search</label>
					<input id="logsearch" type="search" class={input} bind:value={search} placeholder="Text in the log" />
				</div>
			</div>
			<div role="group" aria-label="Levels" class="flex flex-wrap gap-2">
				{#each LEVELS as [lv, label] (lv)}
					<button type="button" class={chip} aria-pressed={levels.includes(lv)} onclick={() => (levels = levels.includes(lv) ? levels.filter((x) => x !== lv) : [...levels, lv])}>{label}</button>
				{/each}
			</div>
			{#if log.isPending && current}
				<Skeleton class="h-96" />
			{:else if log.data != null}
				<p class="text-muted-foreground text-sm" aria-live="polite">
					{filtered.length.toLocaleString()} of {parsed.length.toLocaleString()} lines{#if !showAll && filtered.length > MAX}, showing the last {MAX.toLocaleString()} · <button type="button" class="text-primary cursor-pointer font-semibold hover:underline" onclick={() => (showAll = true)}>show all</button>{/if}
				</p>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre tabindex="0" aria-label="Log contents" class="bg-background border-border max-h-[70dvh] overflow-auto rounded-xl border p-4 font-mono text-[12px] leading-relaxed">{#each shown as l, i (i)}<span class="block whitespace-pre-wrap break-all {tone[l.level] ?? ''}">{l.text}</span>{/each}</pre>
			{/if}
		</Section>
	</Tabs.Content>
</Tabs.Root>
