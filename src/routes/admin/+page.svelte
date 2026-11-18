<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Power from '@lucide/svelte/icons/power';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Square from '@lucide/svelte/icons/square';
	import { resolve } from '$app/paths';
	import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models';
	import {
		adminKeys,
		getActiveSessions,
		getActivity,
		getAlbumArtistCount,
		getCounts,
		getStorage,
		getSystemInfo,
		getTasks,
		restartServer,
		sendMessage,
		sendPlaystate,
		shutdownServer
	} from '#lib/admin/api.ts';
	import { ago, bytes, clock, ticksToSeconds, transcodeReason } from '#lib/api/format.ts';
	import { primaryImage } from '#lib/api/images.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { groupDisks } from '#lib/admin/storage.ts';
	import Meter from '#lib/components/admin/Meter.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const system = createQuery(() => ({ queryKey: adminKeys.system, queryFn: getSystemInfo, refetchInterval: 30_000 }));
	const sessions = createQuery(() => ({ queryKey: adminKeys.sessions, queryFn: getActiveSessions, refetchInterval: 5_000 }));
	const counts = createQuery(() => ({
		queryKey: adminKeys.counts,
		queryFn: async () => ({ ...(await getCounts()), ArtistCount: await getAlbumArtistCount().catch(() => 0) })
	}));
	const storage = createQuery(() => ({ queryKey: adminKeys.storage, queryFn: getStorage, staleTime: 300_000 }));
	const tasks = createQuery(() => ({ queryKey: adminKeys.tasks, queryFn: getTasks, refetchInterval: 5_000 }));
	const activity = createQuery(() => ({ queryKey: adminKeys.activity({ start: 0, limit: 8 }), queryFn: () => getActivity({ start: 0, limit: 8 }), refetchInterval: 30_000 }));

	const streaming = $derived((sessions.data ?? []).filter((s) => s.NowPlayingItem));
	const idle = $derived((sessions.data ?? []).filter((s) => !s.NowPlayingItem && s.UserName));
	const running = $derived((tasks.data ?? []).filter((t) => t.State !== 'Idle'));

	const COUNT_LABELS: [keyof NonNullable<typeof counts.data>, string][] = [
		['MovieCount', 'Movies'],
		['SeriesCount', 'Shows'],
		['EpisodeCount', 'Episodes'],
		['AlbumCount', 'Albums'],
		['SongCount', 'Songs'],
		['ArtistCount', 'Album artists'],
		['BookCount', 'Books'],
		['MusicVideoCount', 'Music videos']
	];

	const disks = $derived(storage.data ? groupDisks(storage.data) : []);

	async function power(kind: 'restart' | 'shutdown') {
		const ok = await confirm({
			title: kind === 'restart' ? 'Restart the server?' : 'Shut down the server?',
			body: kind === 'restart' ? 'Playback stops for everyone for a moment.' : "Playback stops for everyone and the server won't come back until someone starts it.",
			confirmLabel: kind === 'restart' ? 'Restart' : 'Shut down',
			destructive: true
		});
		if (!ok) return;
		await (kind === 'restart' ? restartServer() : shutdownServer());
		toasts.show(kind === 'restart' ? 'Restarting… the dashboard reconnects automatically.' : 'Shutting down.');
	}

	async function message(s: SessionInfoDto) {
		const text = await confirm({ title: `Message ${s.UserName ?? 'this user'}`, body: `Shown on ${s.DeviceName} (${s.Client}).`, input: { label: 'Message', multiline: true }, confirmLabel: 'Send' });
		if (typeof text !== 'string') return;
		await sendMessage(s.Id!, 'Message from the administrator', text);
		toasts.show('Message sent');
	}

	async function command(s: SessionInfoDto, c: 'PlayPause' | 'Stop') {
		await sendPlaystate(s.Id!, c);
		setTimeout(() => sessions.refetch(), 800);
	}

	const severityTone: Record<string, string> = { Error: 'bg-destructive', Critical: 'bg-destructive', Warning: 'bg-[#E8A23A]' };
	const stat = 'bg-background border-border flex flex-col gap-0.5 rounded-2xl border px-4 py-3';
</script>

<header class="flex flex-wrap items-end gap-4">
	<div class="min-w-0 flex-1">
		<h1 class="text-4xl font-extrabold">{system.data?.ServerName ?? 'Overview'}</h1>
		<p class="text-muted-foreground mt-1 text-sm">
			{#if system.data}{[`Jellyfin ${system.data.Version}`, system.data.OperatingSystemDisplayName || system.data.OperatingSystem, system.data.SystemArchitecture].filter(Boolean).join(' · ')}{:else}&nbsp;{/if}
		</p>
	</div>
	<Button variant="outline" onclick={() => power('restart')}><RotateCcw aria-hidden="true" />Restart</Button>
	<Button variant="outline" onclick={() => power('shutdown')}><Power aria-hidden="true" />Shut down</Button>
</header>

{#if system.data?.HasPendingRestart}
	<div role="status" class="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E8A23A]/50 bg-[#E8A23A]/10 px-5 py-4">
		<p class="flex-1"><strong>Restart needed.</strong> Some changes (plugins or settings) take effect after a restart.</p>
		<Button size="sm" onclick={() => power('restart')}>Restart now</Button>
	</div>
{/if}
{#if system.data?.HasUpdateAvailable}
	<div role="status" class="border-primary/40 bg-primary/10 rounded-2xl border px-5 py-4"><strong>An update is available.</strong> Update the server package or container to get it.</div>
{/if}

<div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
	<div class="flex min-w-0 flex-col gap-6">
		<Section title="Now streaming" description={sessions.data ? `${streaming.length} playing · ${idle.length} other active ${idle.length === 1 ? 'session' : 'sessions'}` : undefined}>
			{#if sessions.isPending}
				<Skeleton class="h-24" />
			{:else if !streaming.length}
				<p class="text-muted-foreground text-sm">Nobody is playing anything right now.</p>
			{:else}
				<ul class="flex flex-col gap-3">
					{#each streaming as s (s.Id)}
						{@const it = s.NowPlayingItem!}
						{@const pos = ticksToSeconds(s.PlayState?.PositionTicks)}
						{@const dur = ticksToSeconds(it.RunTimeTicks)}
						{@const tc = s.TranscodingInfo}
						{@const art = primaryImage(it, 120)}
						<li class="bg-background border-border flex flex-wrap items-center gap-4 rounded-2xl border p-3">
							<span class="bg-muted size-16 shrink-0 overflow-hidden rounded-xl">{#if art}<img src={art} alt="" class="size-full object-cover" />{/if}</span>
							<div class="min-w-0 flex-[1_1_220px]">
								<p class="truncate font-semibold">{it.SeriesName ? `${it.SeriesName} · ${it.Name}` : it.Name}</p>
								<p class="text-muted-foreground truncate text-[13px]">{s.UserName} · {s.DeviceName} · {s.Client}</p>
								<div class="mt-2 flex items-center gap-2">
									<Meter value={pos} max={dur || 1} label="Playback progress" />
									<span class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{clock(pos)} / {clock(dur)}</span>
								</div>
								<p class="mt-1.5 text-xs">
									{#if s.PlayState?.PlayMethod === 'Transcode' && tc}
										<span class="font-semibold text-[#E8A23A]">Transcoding</span>
										<span class="text-muted-foreground">
											{[tc.IsVideoDirect ? 'video copied' : tc.VideoCodec?.toUpperCase(), tc.IsAudioDirect ? 'audio copied' : tc.AudioCodec?.toUpperCase(), tc.HardwareAccelerationType && tc.HardwareAccelerationType !== 'none' ? `HW ${tc.HardwareAccelerationType}` : 'software', tc.Bitrate ? `${(tc.Bitrate / 1e6).toFixed(1)} Mbps` : null, tc.Framerate ? `${Math.round(tc.Framerate)} fps` : null].filter(Boolean).join(' · ')}
											{#if tc.TranscodeReasons?.length}— {tc.TranscodeReasons.map(transcodeReason).join(', ')}{/if}
										</span>
									{:else}
										<span class="text-primary font-semibold">{s.PlayState?.PlayMethod === 'DirectStream' ? 'Direct stream' : 'Direct play'}</span>
									{/if}
								</p>
							</div>
							<div class="flex gap-1">
								{#if s.SupportsRemoteControl}
									<Button variant="outline" size="icon" aria-label={s.PlayState?.IsPaused ? `Resume ${s.UserName}'s playback` : `Pause ${s.UserName}'s playback`} onclick={() => command(s, 'PlayPause')}>
										{#if s.PlayState?.IsPaused}<Play />{:else}<Pause />{/if}
									</Button>
									<Button variant="outline" size="icon" aria-label="Stop {s.UserName}'s playback" onclick={() => command(s, 'Stop')}><Square /></Button>
								{/if}
								<Button variant="outline" size="icon" aria-label="Send a message to {s.UserName}" onclick={() => message(s)}><MessageSquare /></Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			{#if idle.length}
				<details class="text-sm">
					<summary class="text-muted-foreground cursor-pointer">Other active sessions</summary>
					<ul class="mt-2 flex flex-col gap-1">
						{#each idle as s (s.Id)}<li class="text-muted-foreground">{s.UserName} · {s.DeviceName} · {s.Client} {s.ApplicationVersion} · {ago(s.LastActivityDate)}</li>{/each}
					</ul>
				</details>
			{/if}
		</Section>

		<Section title="Storage" description="Free space where the server keeps its data and your media.">
			{#if storage.isPending}
				<Skeleton class="h-40" />
			{:else if storage.isError}
				<p class="text-muted-foreground text-sm">This server doesn't report storage usage.</p>
			{:else}
				<ul class="flex flex-col gap-5">
					{#each disks as d, i (i)}
						{@const total = d.used + d.free}
						{@const name = d.folders.map((f) => f.label).join(', ')}
						<li class="flex flex-col gap-1.5">
							<div class="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
								<span class="font-medium">Disk {i + 1}</span>
								<span class="text-muted-foreground tabular-nums">{bytes(d.free)} free of {bytes(total)}</span>
							</div>
							<Meter value={d.used} max={total || 1} label="Disk {i + 1} usage ({name})" />
							<ul class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
								{#each d.folders as f (f.label + f.path)}<li><span class="text-foreground">{f.label}</span> <span class="font-mono">{f.path}</span></li>{/each}
							</ul>
						</li>
					{/each}
				</ul>
			{/if}
		</Section>
	</div>

	<div class="flex min-w-0 flex-col gap-6">
		<Section title="Library">
			{#if counts.data}
				<dl class="grid grid-cols-2 gap-3">
					{#each COUNT_LABELS.filter(([k]) => (counts.data?.[k] ?? 0) > 0) as [k, label] (k)}
						<div class={stat}><dt class="text-muted-foreground text-xs">{label}</dt><dd class="font-display text-2xl font-bold tabular-nums">{counts.data[k]?.toLocaleString()}</dd></div>
					{/each}
				</dl>
			{:else}<Skeleton class="h-32" />{/if}
		</Section>

		<Section title="Running tasks">
			{#snippet actions()}<a href={resolve('/admin/tasks')} class="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline">All tasks<ArrowRight class="size-4" aria-hidden="true" /></a>{/snippet}
			{#if !running.length}
				<p class="text-muted-foreground text-sm">Nothing running.</p>
			{:else}
				<ul class="flex flex-col gap-3">
					{#each running as t (t.Id)}
						<li class="flex flex-col gap-1.5">
							<div class="flex justify-between gap-3 text-sm"><span class="font-medium">{t.Name}</span><span class="text-muted-foreground tabular-nums">{t.CurrentProgressPercentage != null ? `${Math.round(t.CurrentProgressPercentage)}%` : t.State}</span></div>
							<Meter value={t.CurrentProgressPercentage ?? 0} label="{t.Name} progress" />
						</li>
					{/each}
				</ul>
			{/if}
		</Section>

		<Section title="Recent activity">
			{#snippet actions()}<a href={resolve('/admin/activity')} class="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline">See all<ArrowRight class="size-4" aria-hidden="true" /></a>{/snippet}
			{#if activity.data}
				<ol class="flex flex-col gap-3">
					{#each activity.data.Items ?? [] as e (e.Id)}
						<li class="flex gap-3 text-sm">
							<span class="mt-1.5 size-2 shrink-0 rounded-full {severityTone[e.Severity ?? ''] ?? 'bg-muted-foreground/40'}" aria-hidden="true"></span>
							<div class="min-w-0">
								<p class="font-medium">{e.Name}</p>
								<p class="text-muted-foreground text-xs">{ago(e.Date)}{e.ShortOverview ? ` · ${e.ShortOverview}` : ''}</p>
							</div>
						</li>
					{/each}
				</ol>
			{:else}<Skeleton class="h-40" />{/if}
		</Section>
	</div>
</div>
