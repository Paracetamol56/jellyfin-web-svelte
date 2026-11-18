import { page } from '$app/state';

/** Query string of the current hash route (#/search?q=…); page.url.searchParams doesn't see it. */
export function hashParams(): URLSearchParams {
	const hash = page.url.hash;
	const i = hash.indexOf('?');
	return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}
