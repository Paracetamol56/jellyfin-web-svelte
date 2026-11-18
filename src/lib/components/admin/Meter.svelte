<script lang="ts">
	let { value, max = 100, label, tone = 'primary' }: { value: number; max?: number; label: string; tone?: 'primary' | 'warn' } = $props();
	const pct = $derived(max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} class="bg-muted h-2 w-full overflow-hidden rounded-full">
	<div class="h-full rounded-full transition-[width] duration-500 {tone === 'warn' || pct > 90 ? 'bg-[#E8A23A]' : 'bg-primary'}" style="width: {pct}%"></div>
</div>
