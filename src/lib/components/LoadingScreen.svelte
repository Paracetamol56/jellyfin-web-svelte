<script lang="ts">
	// Splash from the design canvas ("Loading screen"): the Jellyfin mark fills like a liquid, with two
	// waves running along the surface, over a soft halo. The fill is the progress bar. Dark and light.
	import { onMount } from 'svelte';

	/** 0–100 for real progress; leave out to loop rise → hold → drain while waiting. */
	let { progress, label = 'Loading Jellyfin' }: { progress?: number; label?: string } = $props();
	const uid = $props.id();

	let auto = $state(18);
	let reduced = $state(false);

	onMount(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (progress !== undefined || reduced) return;
		// The design's own cadence: climb 1.4% per 100 ms, hold a beat when full, then drain fast.
		let phase: 'rise' | 'hold' | 'drain' = 'rise';
		let hold = 0;
		const timer = setInterval(() => {
			if (phase === 'rise') {
				auto = Math.min(100, auto + 1.4);
				if (auto >= 100) (phase = 'hold'), (hold = 0);
			} else if (phase === 'hold') {
				if (hold++ >= 10) phase = 'drain';
			} else {
				auto = Math.max(0, auto - 9);
				if (auto <= 0) phase = 'rise';
			}
		}, 100);
		return () => clearInterval(timer);
	});

	// The fill eases toward the target, so a jump in progress reads as liquid rising, not a step.
	const target = $derived(Math.max(0, Math.min(100, progress ?? (reduced ? 62 : auto))));
	let level = $state(0);
	$effect(() => {
		const goal = target;
		if (reduced) return void (level = goal);
		let frame = 0;
		const step = () => {
			const gap = goal - level;
			level = Math.abs(gap) < 0.1 ? goal : level + gap * 0.12;
			if (level !== goal) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
	const fillY = $derived(500 - level * 5.4);
</script>

<div
	class="loading"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={progress === undefined ? undefined : Math.round(level)}
	aria-busy="true"
>
	<div class="halo" aria-hidden="true"></div>

	<div class="mark" aria-hidden="true">
		<svg width="210" height="210" viewBox="0 0 512 512" fill-rule="evenodd" clip-rule="evenodd" style="overflow: visible">
			<defs>
				<linearGradient id="{uid}-fill" gradientUnits="userSpaceOnUse" x1="40" y1="20" x2="470" y2="480">
					<stop offset="0" stop-color="#AA5CC3" />
					<stop offset="1" stop-color="#00A4DC" />
				</linearGradient>
				<clipPath id="{uid}-clip">
					<path d="M24.711 49.158c-1.552-3.116 8.626-21.57 11.788-21.57 3.167.002 13.323 18.488 11.788 21.57-1.535 3.081-22.025 3.115-23.577 0h.001z" transform="matrix(6.94432 0 0 6.94432 2.538 6.006)" />
					<path clip-rule="evenodd" d="M.98 64.996C-3.695 55.606 26.977.001 36.5.001c9.533 0 40.153 55.713 35.527 64.995-4.626 9.282-66.368 9.391-71.045 0m12.255-8.148c3.065 6.152 43.518 6.084 46.548 0 3.03-6.086-17.033-42.587-23.275-42.587-6.242 0-26.34 36.434-23.276 42.587h.003z" transform="matrix(6.94432 0 0 6.94432 2.538 6.006)" />
				</clipPath>
				<mask id="{uid}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
					<g style="transform: translateY({fillY}px); transition: transform 0.1s linear">
						<path class="wave w2" fill="#FFFFFF" fill-opacity="0.45" d="M0 30 q64 -26 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 V700 H0 Z" />
						<path class="wave w1" fill="#FFFFFF" d="M0 44 q64 26 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 V700 H0 Z" />
					</g>
				</mask>
			</defs>
			<g clip-path="url(#{uid}-clip)">
				<rect width="512" height="512" fill="var(--logo-empty)" />
				<rect width="512" height="512" fill="url(#{uid}-fill)" mask="url(#{uid}-mask)" />
			</g>
			<g transform="matrix(6.94432 0 0 6.94432 2.538 6.006)" fill="none" stroke="url(#{uid}-fill)" stroke-width="0.7" stroke-opacity="0.55">
				<path d="M24.711 49.158c-1.552-3.116 8.626-21.57 11.788-21.57 3.167.002 13.323 18.488 11.788 21.57-1.535 3.081-22.025 3.115-23.577 0h.001z" />
				<path d="M.98 64.996C-3.695 55.606 26.977.001 36.5.001c9.533 0 40.153 55.713 35.527 64.995-4.626 9.282-66.368 9.391-71.045 0m12.255-8.148c3.065 6.152 43.518 6.084 46.548 0 3.03-6.086-17.033-42.587-23.275-42.587-6.242 0-26.34 36.434-23.276 42.587h.003z" />
			</g>
		</svg>
	</div>

	<div class="wordmark" aria-hidden="true">Jellyfin</div>
</div>

<style>
	.loading {
		--halo: #00a4dc22;
		--logo-empty: #0000000c;
		position: relative;
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: var(--background);
		color: var(--foreground);
	}
	:global(.dark) .loading {
		--halo: #aa5cc333;
		--logo-empty: #ffffff0f;
	}
	.halo {
		position: absolute;
		left: 50%;
		top: 46%;
		width: min(760px, 160vw);
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 999px;
		background: radial-gradient(closest-side, var(--halo), transparent);
		pointer-events: none;
	}
	.mark {
		position: relative;
		width: 210px;
		height: 210px;
	}
	.wordmark {
		position: relative;
		margin-top: 18px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 52px;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.wave {
		will-change: transform;
	}
	.w1 {
		animation: wave1 3.2s linear infinite;
	}
	.w2 {
		animation: wave2 4.6s linear infinite;
	}
	@keyframes wave1 {
		from { transform: translateX(0); }
		to { transform: translateX(-256px); }
	}
	@keyframes wave2 {
		from { transform: translateX(-256px); }
		to { transform: translateX(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.w1, .w2 { animation: none !important; }
	}
</style>
