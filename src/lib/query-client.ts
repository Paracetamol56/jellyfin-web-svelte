import { QueryClient } from '@tanstack/svelte-query';

/** Shared so actions outside components (menus, dialogs) can refresh data. */
export const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } }
});

/** Refetch everything that shows an item's state (favourite, watched, metadata). */
export function refreshItemViews(): void {
	queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'views' && q.queryKey[0] !== 'lyrics' && q.queryKey[0] !== 'systemInfo' });
}
