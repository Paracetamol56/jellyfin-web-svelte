<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import {
		adminKeys,
		getActivitySince,
		getAlbumArtistCount,
		getCounts,
		getLibraryInsights,
		getStorage
	} from '#lib/admin/api.ts';
	import { live } from '#lib/admin/live.svelte.ts';
	import { activityByDay, addedByMonth, decadeCounts, distinctUsers, playHeatmap, resolutionCounts } from '#lib/admin/stats.ts';
	import { groupDisks } from '#lib/admin/storage.ts';
	import { bytes } from '#lib/api/format.ts';
	import { session } from '#lib/api/session.svelte.ts';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Donut from '#lib/components/charts/Donut.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const C = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

	let range = $state<7 | 14 | 30>(14);
	const RANGES = [7, 14, 30] as const;
	const since = $derived(new Date(Date.now() - range * 86_400_000));

	const activity = createQuery(() => ({ queryKey: ['admin', 'stats', 'activity'], queryFn: () => getActivitySince(30), staleTime: 120_000 }));
	const insights = createQuery(() => ({ queryKey: ['admin', 'stats', 'library'], queryFn: getLibraryInsights, staleTime: 300_000 }));
	const counts = createQuery(() => ({
		queryKey: adminKeys.counts,
		queryFn: async () => ({ ...(await getCounts()), ArtistCount: await getAlbumArtistCount().catch(() => 0) })
	}));
	const storage = createQuery(() => ({ queryKey: adminKeys.storage, queryFn: getStorage, staleTime: 300_000 }));

	const entries = $derived(activity.data ?? []);
	const days = $derived(activityByDay(entries, range));
	const heat = $derived(playHeatmap(entries, since));
	const plays = $derived(days.reduce((n, d) => n + d.video + d.music, 0));
	const signins = $derived(days.reduce((n, d) => n + d.signin, 0));
	const people = $derived(distinctUsers(entries, since));
	const capped = $derived(entries.length >= 6000);

	const latest = $derived(live.samples[live.samples.length - 1]);
	const adds = $derived(addedByMonth(insights.data?.added ?? [], 12));
	const decades = $derived(decadeCounts((insights.data?.movies ?? []).map((m) => m.ProductionYear)));
	const resolutions = $derived(resolutionCounts(insights.data?.movies ?? []));
	const disks = $derived(storage.data ? groupDisks(storage.data) : []);
	const fmt = new Intl.NumberFormat();
	const n = (k: string) => (counts.data as Record<string, number> | undefined)?.[k] ?? 0;

	const tile = 'bg-card border-border flex flex-col gap-0.5 rounded-2xl border px-5 py-4';
	const chip = 'h-9 cursor-pointer rounded-full border border-border px-4 text-sm aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground';
</script>

<header class="flex flex-wrap items-end gap-4">
	<div class="min-w-0 flex-1">
		<h1 class="text-4xl font-extrabold">Statistics</h1>
		<p class="text-muted-foreground mt-1 text-sm">How the server is used and what it holds.</p>
	</div>
	<div role="group" aria-label="Time range" class="flex gap-1.5">
		{#each RANGES as r (r)}
			<button type="button" class={chip} aria-pressed={range === r} onclick={() => (range = r)}>{r} days</button>
		{/each}
	</div>
</header>

<dl class="grid grid-cols-2 gap-3 lg:grid-cols-5">
	<div class={tile}><dt class="text-muted-foreground text-xs">Streaming now</dt><dd class="font-display text-3xl font-extrabold tabular-nums">{latest?.streams ?? '–'}</dd></div>
	<div class={tile}><dt class="text-muted-foreground text-xs">Transcoding now</dt><dd class="font-display text-3xl font-extrabold tabular-nums">{latest?.transcodes ?? '–'}</dd></div>
	<div class={tile}><dt class="text-muted-foreground text-xs">Plays, last {range} days</dt><dd class="font-display text-3xl font-extrabold tabular-nums">{activity.data ? fmt.format(plays) : '–'}</dd></div>
	<div class={tile}><dt class="text-muted-foreground text-xs">Active people</dt><dd class="font-display text-3xl font-extrabold tabular-nums">{activity.data ? people : '–'}</dd></div>
	<div class={tile}><dt class="text-muted-foreground text-xs">Items in library</dt><dd class="font-display text-3xl font-extrabold tabular-nums">{counts.data ? fmt.format(n('ItemCount')) : '–'}</dd></div>
</dl>

<Section title="Live activity" description="Streams running right now, sampled every few seconds while a dashboard page is open. The last 10 minutes.">
	{#if live.samples.length < 2}
		<p class="text-muted-foreground text-sm" role="status">Collecting data… the chart appears after a few seconds.</p>
	{:else}
		<LineChart
			data={live.samples}
			lines={[
				{ key: 'streams', label: 'Streams', color: C[0] },
				{ key: 'transcodes', label: 'Transcoding', color: C[2] }
			]}
			summary="Streams and transcodes over the last 10 minutes. Now: {latest?.streams ?? 0} streaming, {latest?.transcodes ?? 0} transcoding."
		/>
	{/if}
</Section>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
	<Section title="Plays per day" description="Video and music plays, and sign-ins, for the last {range} days.">
		{#if activity.isPending}
			<Skeleton class="h-60" />
		{:else}
			<BarChart
				data={days}
				x="label"
				series={[
					{ key: 'video', label: 'Video plays', color: C[0] },
					{ key: 'music', label: 'Music plays', color: C[1] },
					{ key: 'signin', label: 'Sign-ins', color: C[2] }
				]}
				maxLabels={range === 30 ? 10 : 7}
				summary="Plays and sign-ins per day over the last {range} days: {plays} plays and {signins} sign-ins in total."
			/>
			{#if capped}<p class="text-muted-foreground text-xs">Based on the most recent 6,000 events; older days may be incomplete.</p>{/if}
		{/if}
	</Section>

	<Section title="When people listen and watch" description="Plays by weekday and hour of the day (your local time), last {range} days.">
		{#if activity.isPending}
			<Skeleton class="h-60" />
		{:else}
			<Heatmap cells={heat} summary="Plays by weekday and hour over the last {range} days." />
		{/if}
	</Section>
</div>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
	<Section title="Video library">
		{#if counts.isPending}
			<Skeleton class="h-44" />
		{:else}
			<Donut
				centerLabel="titles"
				centerValue={fmt.format(n('MovieCount') + n('SeriesCount'))}
				summary="Video library: {n('MovieCount')} movies, {n('SeriesCount')} shows, {n('EpisodeCount')} episodes."
				data={[
					{ label: 'Movies', value: n('MovieCount'), color: C[0] },
					{ label: 'Shows', value: n('SeriesCount'), color: C[1] },
					{ label: 'Episodes', value: n('EpisodeCount'), color: C[2] }
				]}
			/>
		{/if}
	</Section>
	<Section title="Music library">
		{#if counts.isPending}
			<Skeleton class="h-44" />
		{:else}
			<Donut
				centerLabel="albums"
				centerValue={fmt.format(n('AlbumCount'))}
				summary="Music library: {n('AlbumCount')} albums, {n('SongCount')} songs, {n('ArtistCount')} album artists."
				data={[
					{ label: 'Albums', value: n('AlbumCount'), color: C[3] },
					{ label: 'Songs', value: n('SongCount'), color: C[1] },
					{ label: 'Album artists', value: n('ArtistCount'), color: C[4] }
				]}
			/>
		{/if}
	</Section>
</div>

<Section title="Added to the library" description="New movies, episodes and albums per month, over the last year.">
	{#if insights.isPending}
		<Skeleton class="h-60" />
	{:else}
		<BarChart
			data={adds}
			x="label"
			series={[
				{ key: 'movies', label: 'Movies', color: C[0] },
				{ key: 'episodes', label: 'Episodes', color: C[2] },
				{ key: 'albums', label: 'Albums', color: C[3] }
			]}
			summary="Items added per month over the last 12 months: {adds.reduce((a, r) => a + r.movies + r.episodes + r.albums, 0)} in total."
		/>
	{/if}
</Section>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
	<Section title="Movies by decade" description="By release year.">
		{#if insights.isPending}
			<Skeleton class="h-60" />
		{:else if !decades.length}
			<p class="text-muted-foreground text-sm">No release years to chart.</p>
		{:else}
			<BarChart data={decades} x="label" series={[{ key: 'count', label: 'Movies', color: C[0] }]} summary="Movies per decade of release." maxLabels={14} />
		{/if}
	</Section>
	<Section title="Movie quality" description="Resolution of your movie files.">
		{#if insights.isPending}
			<Skeleton class="h-44" />
		{:else}
			<Donut
				centerLabel="movies"
				summary="Movies by resolution: {resolutions.map((r) => `${r.count} at ${r.label}`).join(', ')}."
				data={resolutions.map((r, i) => ({ label: r.label === 'SD' ? 'SD' : r.label.toLowerCase().replace(/^(\d+)p$/, '$1p').replace('4k', '4K'), value: r.count, color: C[i % C.length] }))}
			/>
		{/if}
	</Section>
</div>

<Section title="Storage" description="Used and free space on each disk the server uses.">
	{#if storage.isPending}
		<Skeleton class="h-44" />
	{:else if storage.isError}
		<p class="text-muted-foreground text-sm">This server doesn't report storage usage.</p>
	{:else}
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
			{#each disks as d, i (i)}
				<div class="flex flex-col gap-2">
					<Donut
						size={140}
						centerLabel="used"
						centerValue="{Math.round((d.used / Math.max(1, d.used + d.free)) * 100)}%"
						formatValue={bytes}
						summary="Disk {i + 1}: {bytes(d.used)} used, {bytes(d.free)} free."
						data={[
							{ label: 'Used', value: d.used, color: C[i % 2 === 0 ? 0 : 2] },
							{ label: 'Free', value: d.free, color: 'var(--border)' }
						]}
					/>
					<p class="text-muted-foreground text-xs"><span class="text-foreground font-semibold">Disk {i + 1}</span> · {d.folders.map((f) => f.label).join(', ')}</p>
				</div>
			{/each}
		</div>
	{/if}
</Section>
