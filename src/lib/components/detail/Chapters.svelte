<script lang="ts">
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { chapterImage } from '#lib/api/images.ts';
	import { clock, duration, ticksToSeconds } from '#lib/api/format.ts';

	let { item, onplay }: { item: BaseItemDto; onplay: (seconds: number) => void } = $props();

	const chapters = $derived(
		(item.Chapters ?? []).map((c, i, all) => {
			const start = ticksToSeconds(c.StartPositionTicks);
			const end = i < all.length - 1 ? ticksToSeconds(all[i + 1].StartPositionTicks) : ticksToSeconds(item.RunTimeTicks);
			return { i, name: c.Name, start, length: Math.max(1, end - start), img: chapterImage(item.Id!, i, c.ImageTag) };
		})
	);
</script>

{#if chapters.length > 1}
	<section aria-labelledby="chapters" class="flex flex-col gap-5">
		<div class="flex flex-wrap items-baseline gap-3.5">
			<h2 id="chapters" class="text-2xl font-bold md:text-[30px]">Chapters</h2>
			<span class="text-muted-foreground text-[13px] tabular-nums">{chapters.length} chapters · {duration(item.RunTimeTicks)}</span>
		</div>
		<div aria-hidden="true" class="flex h-2 gap-[3px]">
			{#each chapters as c (c.i)}
				<span class="bg-border rounded-[3px]" style="flex: {c.length} 1 0"></span>
			{/each}
		</div>
		<ol class="grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
			{#each chapters as c (c.i)}
				<li>
					<button type="button" class="group flex w-full cursor-pointer flex-col gap-2.5 text-left" onclick={() => onplay(c.start)}>
						<span class="bg-muted block aspect-video overflow-hidden rounded-xl">
							{#if c.img}<img src={c.img} alt="" loading="lazy" class="size-full object-cover transition-transform group-hover:scale-105" />{/if}
						</span>
						<span class="flex justify-between gap-2 text-[13px]">
							<span class="truncate font-semibold group-hover:text-primary">{c.name || `Chapter ${c.i + 1}`}</span>
							<span class="text-muted-foreground tabular-nums">{clock(c.start)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ol>
	</section>
{/if}
