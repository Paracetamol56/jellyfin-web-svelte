<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Search from '@lucide/svelte/icons/search';
	import Sun from '@lucide/svelte/icons/sun';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { mode, toggleMode } from 'mode-watcher';
	import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
	import { Button } from '#lib/components/ui/button/index.ts';
	import Logo from './Logo.svelte';
	import UserMenu from './UserMenu.svelte';

	let { views }: { views: BaseItemDto[] } = $props();

	let query = $state('');
	let searchEl = $state<HTMLInputElement | null>(null);

	const isDark = $derived(mode.current === 'dark');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		goto(resolve('/search') + (q ? `?q=${encodeURIComponent(q)}` : ''));
	}

	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			searchEl?.focus();
		}
	}

	const pill = 'rounded-full px-4 py-2.5 text-sm transition-colors';
</script>

<svelte:window onkeydown={onKey} />

<header class="border-border flex flex-wrap items-center gap-x-7 gap-y-3 border-b px-4 py-3 md:px-10 md:py-[18px]">
	<a href={resolve('/')} class="font-display flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight">
		<Logo />
		<span class="max-md:hidden">Jellyfin</span>
	</a>

	<nav aria-label="Main" class="flex flex-wrap gap-1 max-md:hidden">
		<a
			href={resolve('/')}
			aria-current={page.route.id === '/' ? 'page' : undefined}
			class="{pill} aria-[current=page]:bg-secondary aria-[current=page]:font-semibold text-muted-foreground aria-[current=page]:text-foreground hover:text-foreground"
			>Home</a
		>
		{#each views as v (v.Id)}
			<a
				href={resolve('/library/[id]', { id: v.Id! })}
				aria-current={page.params.id === v.Id ? 'page' : undefined}
				class="{pill} aria-[current=page]:bg-secondary aria-[current=page]:font-semibold text-muted-foreground aria-[current=page]:text-foreground hover:text-foreground"
				>{v.Name}</a
			>
		{/each}
	</nav>

	<div class="flex-1"></div>

	<form
		role="search"
		onsubmit={submit}
		class="bg-card border-border text-muted-foreground flex h-11 min-w-0 flex-[0_1_340px] items-center gap-2.5 rounded-xl border px-3 focus-within:border-ring max-md:hidden"
	>
		<Search class="size-[18px]" aria-hidden="true" />
		<label for="global-search" class="sr-only">Search</label>
		<input
			id="global-search"
			bind:this={searchEl}
			bind:value={query}
			type="search"
			placeholder="Search movies, shows, music"
			class="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
		/>
		<kbd class="border-border rounded-md border px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd>
	</form>

	<Button variant="outline" size="icon" href={resolve('/search')} class="rounded-full md:hidden" aria-label="Search">
		<Search />
	</Button>

	<Button
		variant="outline"
		size="icon"
		class="rounded-xl max-md:hidden"
		onclick={toggleMode}
		aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
	>
		{#if isDark}<Sun />{:else}<Moon />{/if}
	</Button>

	<UserMenu class="max-md:hidden" />
</header>
