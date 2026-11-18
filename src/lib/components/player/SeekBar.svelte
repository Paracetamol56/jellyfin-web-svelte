<script lang="ts">
    import { clock } from "#lib/api/format.ts";

    let {
        time,
        duration,
        onseek,
        size = "md",
        showTimes = true,
        remaining = false,
        class: className = "",
    }: {
        time: number;
        duration: number;
        onseek: (seconds: number) => void;
        size?: "sm" | "md" | "lg";
        showTimes?: boolean;
        remaining?: boolean;
        class?: string;
    } = $props();

    // While dragging, show the drag position instead of the media's.
    let dragging = $state<number | null>(null);
    const shown = $derived(dragging ?? time);
    const pct = $derived(duration ? Math.min(100, (shown / duration) * 100) : 0);
    const track = $derived(size === "lg" ? "h-2.5" : size === "sm" ? "h-1" : "h-1.5");
    const knob = $derived(size === "lg" ? "size-6" : size === "sm" ? "size-3" : "size-4");
</script>

<div class={className}>
    <div class="relative flex items-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-(--seek-accent) {size === 'lg' ? 'h-10' : 'h-8'}">
        <span aria-hidden="true" class="absolute inset-x-0 rounded-full bg-(--seek-line) {track}"></span>
        <span aria-hidden="true" class="absolute left-0 rounded-full bg-(--seek-accent) shadow-[0_0_18px_var(--seek-accent)] {track}" style="width: {pct}%"></span>
        <span aria-hidden="true" class="absolute -ml-[calc(var(--k)/2)] rounded-full bg-(--seek-accent) shadow-[0_0_18px_var(--seek-accent)] {knob}" style="left: {pct}%; --k: {size === 'lg' ? '24px' : size === 'sm' ? '12px' : '16px'}"></span>
        <input
            type="range"
            min="0"
            max={Math.max(1, Math.floor(duration))}
            step="1"
            value={Math.floor(shown)}
            aria-label="Seek"
            aria-valuetext="{clock(shown)} of {clock(duration)}"
            oninput={(e) => (dragging = +e.currentTarget.value)}
            onchange={(e) => {
                onseek(+e.currentTarget.value);
                dragging = null;
            }}
            class="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
        />
    </div>
    {#if showTimes}
        <div class="flex justify-between text-[13px] text-(--seek-muted) tabular-nums">
            <span>{clock(shown)}</span><span>{remaining ? `-${clock(duration - shown)}` : clock(duration)}</span>
        </div>
    {/if}
</div>
