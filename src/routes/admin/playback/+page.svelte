<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import type { EncodingOptions, ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models';
	import { adminKeys, getConfig, getNamed, saveConfig, saveNamed } from '#lib/admin/api.ts';
	import { Draft } from '#lib/admin/draft.svelte.ts';
	import Field from '#lib/components/admin/Field.svelte';
	import FolderPicker from '#lib/components/admin/FolderPicker.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import Section from '#lib/components/admin/Section.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { input, select } from '#lib/components/admin/styles.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';

	const encodingQ = createQuery(() => ({ queryKey: adminKeys.named('encoding'), queryFn: () => getNamed('encoding') }));
	const configQ = createQuery(() => ({ queryKey: adminKeys.config, queryFn: getConfig }));
	const enc = new Draft<EncodingOptions>();
	const cfg = new Draft<ServerConfiguration>();
	$effect(() => {
		if (encodingQ.data && !enc.value) enc.load(encodingQ.data);
	});
	$effect(() => {
		if (configQ.data && !cfg.value) cfg.load(configQ.data);
	});
	const e = $derived(enc.value);
	const c = $derived(cfg.value);

	const HW: [string, string, string][] = [
		['none', 'None (software)', 'Works everywhere; uses the CPU.'],
		['qsv', 'Intel Quick Sync (QSV)', 'Intel iGPU/Arc.'],
		['vaapi', 'VA-API', 'Intel or AMD on Linux.'],
		['nvenc', 'NVIDIA NVENC', 'NVIDIA GPUs.'],
		['amf', 'AMD AMF', 'AMD GPUs on Windows.'],
		['videotoolbox', 'Apple VideoToolbox', 'macOS.'],
		['v4l2m2m', 'Video4Linux2', 'Raspberry Pi and similar.'],
		['rkmpp', 'Rockchip MPP', 'Rockchip boards.']
	];
	const CODECS: [string, string][] = [['h264', 'H.264'], ['hevc', 'HEVC'], ['av1', 'AV1'], ['vp9', 'VP9'], ['vp8', 'VP8'], ['mpeg2video', 'MPEG-2'], ['vc1', 'VC-1']];
	const hwDescription = $derived(HW.find(([v]) => v === e?.HardwareAccelerationType)?.[2]);

	function toggleCodec(codec: string, on: boolean) {
		if (!e) return;
		const set = new Set(e.HardwareDecodingCodecs ?? []);
		if (on) set.add(codec);
		else set.delete(codec);
		e.HardwareDecodingCodecs = [...set];
	}

	let picking = $state(false);
	async function save() {
		await Promise.all([enc.dirty && enc.commit((v) => saveNamed('encoding', v)), cfg.dirty && cfg.commit((v) => saveConfig(v))]);
	}
	const list = 'divide-border flex flex-col divide-y';
	const grid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
</script>

<header>
	<h1 class="text-4xl font-extrabold">Playback & transcoding</h1>
	<p class="text-muted-foreground mt-1 text-sm">How the server converts media that a device can't play directly.</p>
</header>

{#if !e || !c}
	<Skeleton class="h-80" />
{:else}
	<Section title="Hardware acceleration" description="Offload transcoding to a GPU. Far faster and cheaper than software, if the server has one.">
		<div class={grid}>
			<Field label="Acceleration" hint={hwDescription}>
				{#snippet children(id, hint)}
					<select {id} aria-describedby={hint} class={select} bind:value={e.HardwareAccelerationType}>
						{#each HW as [v, l] (v)}<option value={v}>{l}</option>{/each}
					</select>
				{/snippet}
			</Field>
			{#if e.HardwareAccelerationType === 'vaapi'}
				<Field label="VA-API device">{#snippet children(id)}<input {id} class="{input} font-mono text-sm" bind:value={e.VaapiDevice} placeholder="/dev/dri/renderD128" />{/snippet}</Field>
			{:else if e.HardwareAccelerationType === 'qsv'}
				<Field label="QSV device">{#snippet children(id)}<input {id} class="{input} font-mono text-sm" bind:value={e.QsvDevice} placeholder="/dev/dri/renderD128" />{/snippet}</Field>
			{/if}
		</div>
		{#if e.HardwareAccelerationType !== 'none'}
			<fieldset>
				<legend class="mb-2 text-sm font-semibold">Decode in hardware</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2">
					{#each CODECS as [v, l] (v)}
						<label class="flex cursor-pointer items-center gap-2 text-sm">
							<input type="checkbox" class="accent-primary size-5" checked={e.HardwareDecodingCodecs?.includes(v)} onchange={(ev) => toggleCodec(v, ev.currentTarget.checked)} />{l}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class={list}>
				<Toggle bind:checked={e.EnableHardwareEncoding} label="Encode in hardware" />
				<Toggle bind:checked={e.EnableDecodingColorDepth10Hevc} label="10-bit HEVC decoding" />
				<Toggle bind:checked={e.EnableDecodingColorDepth10Vp9} label="10-bit VP9 decoding" />
				<Toggle bind:checked={e.PreferSystemNativeHwDecoder} label="Prefer the OS's native decoder" />
			</div>
		{/if}
		<div class={list}>
			<Toggle bind:checked={e.AllowHevcEncoding} label="Allow HEVC output" description="Smaller streams for devices that support HEVC." />
			<Toggle bind:checked={e.AllowAv1Encoding} label="Allow AV1 output" />
		</div>
	</Section>

	<Section title="HDR" description="Convert HDR to SDR for screens that can't show HDR, so colours don't look washed out.">
		<Toggle bind:checked={e.EnableTonemapping} label="Tone-map HDR to SDR" />
		{#if e.EnableTonemapping}
			<div class={grid}>
				<Field label="Algorithm" hint="BT.2390 is a good default.">
					{#snippet children(id, hint)}
						<select {id} aria-describedby={hint} class={select} bind:value={e.TonemappingAlgorithm}>
							{#each ['bt2390', 'hable', 'reinhard', 'mobius', 'linear', 'gamma', 'clip', 'none'] as a (a)}<option value={a}>{a === 'bt2390' ? 'BT.2390' : a[0].toUpperCase() + a.slice(1)}</option>{/each}
						</select>
					{/snippet}
				</Field>
			</div>
		{/if}
	</Section>

	<Section title="Quality" description="Trade-offs between picture quality, speed and server load.">
		<div class={grid}>
			<Field label="Encoder preset" hint="Faster presets use less CPU but give larger or worse-looking streams.">
				{#snippet children(id, hint)}
					<select {id} aria-describedby={hint} class={select} bind:value={e.EncoderPreset}>
						{#each ['auto', 'veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast'] as p (p)}<option value={p}>{p === 'auto' ? 'Automatic' : p}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="H.264 quality (CRF)" hint="Lower is better quality, 23 is the default.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" max="51" class={input} bind:value={e.H264Crf} />{/snippet}
			</Field>
			<Field label="HEVC quality (CRF)" hint="28 is the default.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" max="51" class={input} bind:value={e.H265Crf} />{/snippet}
			</Field>
			<Field label="Encoding threads" hint="-1 lets the encoder decide.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="-1" class={input} bind:value={e.EncodingThreadCount} />{/snippet}
			</Field>
			<Field label="Deinterlacing">
				{#snippet children(id)}
					<select {id} class={select} bind:value={e.DeinterlaceMethod}><option value="yadif">YADIF</option><option value="bwdif">BWDIF</option></select>
				{/snippet}
			</Field>
			<Field label="Downmix volume boost" hint="Makes stereo downmixes of surround audio louder.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" step="0.1" min="0.5" max="3" class={input} bind:value={e.DownMixAudioBoost} />{/snippet}
			</Field>
		</div>
		<Toggle bind:checked={e.EnableAudioVbr} label="Variable bitrate audio" />
	</Section>

	<Section title="Server load" description="Keep transcoding from eating more CPU and disk than it needs.">
		<div class={list}>
			<Toggle bind:checked={e.EnableThrottling} label="Throttle transcodes" description="Pause encoding once it's far enough ahead of the viewer." />
			<Toggle bind:checked={e.EnableSegmentDeletion} label="Delete watched segments" description="Frees temp disk space during long streams." />
			<Toggle bind:checked={e.EnableSubtitleExtraction} label="Extract embedded subtitles ahead of time" />
		</div>
		<Field label="Transcoding temp folder" hint="Fast local storage (SSD or RAM disk) helps.">
			{#snippet children(id, hint)}
				<div class="flex gap-2">
					<input {id} aria-describedby={hint} class="{input} font-mono text-sm" bind:value={e.TranscodingTempPath} placeholder="Default" />
					<Button variant="outline" size="icon" aria-label="Browse for a folder" onclick={() => (picking = true)}><FolderOpen /></Button>
				</div>
			{/snippet}
		</Field>
	</Section>

	<Section title="Streaming & resume">
		<div class={grid}>
			<Field label="Remote bitrate limit (Mbps)" hint="For all users outside your network. Empty for none.">
				{#snippet children(id, hint)}
					<input {id} aria-describedby={hint} inputmode="decimal" class={input} value={c.RemoteClientBitrateLimit ? c.RemoteClientBitrateLimit / 1e6 : ''} oninput={(ev) => (c.RemoteClientBitrateLimit = ev.currentTarget.value ? Math.round(+ev.currentTarget.value * 1e6) : 0)} />
				{/snippet}
			</Field>
			<Field label="Resume after (% watched)" hint="Less than this restarts from the beginning.">
				{#snippet children(id, hint)}<input {id} aria-describedby={hint} type="number" min="0" max="100" class={input} bind:value={c.MinResumePct} />{/snippet}
			</Field>
			<Field label="Mark watched after (% watched)">
				{#snippet children(id)}<input {id} type="number" min="0" max="100" class={input} bind:value={c.MaxResumePct} />{/snippet}
			</Field>
			<Field label="Shortest resumable item (seconds)">
				{#snippet children(id)}<input {id} type="number" min="0" class={input} bind:value={c.MinResumeDurationSeconds} />{/snippet}
			</Field>
		</div>
	</Section>

	<SaveBar drafts={[enc, cfg] as never} onsave={save} />
	<FolderPicker bind:open={picking} title="Transcoding temp folder" onpick={(p) => (e.TranscodingTempPath = p)} />
{/if}
