<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models';
	import { personImage } from '#lib/api/images.ts';
	import { initials } from '#lib/api/format.ts';

	let { people }: { people: BaseItemPerson[] } = $props();
	// Actors first, then key crew; cap so the row stays scannable.
	const shown = $derived(
		[...people.filter((p) => p.Type === 'Actor' || p.Type === 'GuestStar'), ...people.filter((p) => ['Director', 'Writer', 'Producer', 'Composer'].includes(p.Type ?? ''))].slice(0, 24)
	);
	function role(p: BaseItemPerson): string {
		if (p.Type === 'Actor' || p.Type === 'GuestStar') return p.Role || 'Actor';
		return p.Type ?? '';
	}
</script>

{#if shown.length}
	<section aria-labelledby="cast" class="flex flex-col gap-5">
		<h2 id="cast" class="text-2xl font-bold md:text-[30px]">Cast &amp; crew</h2>
		<ul class="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-1.5 [scrollbar-width:thin] md:-mx-10 md:px-10">
			{#each shown as p, i (`${p.Id}-${p.Type}-${i}`)}
				{@const img = personImage(p.Id, p.PrimaryImageTag)}
				<li class="shrink-0">
					<a
						href={resolve('/item/[id]', { id: p.Id! })}
						class="bg-card border-border hover:border-ring flex items-center gap-3 rounded-full border py-2 pr-[18px] pl-2"
					>
						{#if img}
							<img src={img} alt="" loading="lazy" class="size-11 rounded-full object-cover" />
						{:else}
							<span aria-hidden="true" class="font-display bg-secondary text-muted-foreground grid size-11 place-items-center rounded-full text-[15px] font-extrabold">{initials(p.Name)}</span>
						{/if}
						<span class="flex flex-col gap-0.5">
							<span class="text-sm font-semibold whitespace-nowrap">{p.Name}</span>
							<span class="text-muted-foreground max-w-56 truncate text-xs whitespace-nowrap">{role(p)}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
