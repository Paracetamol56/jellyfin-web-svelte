<script lang="ts">
	// Hosts a plugin's own configuration page in a sandboxed iframe (scripts run, but with an
	// opaque origin: the page can't touch this app, its storage or its session beyond the API token).
	import { mode } from 'mode-watcher';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api, jellyfin, session } from '#lib/api/session.svelte.ts';
	import { getConfigPageSource } from '#lib/admin/api.ts';
	import { buildDocument, iconFontDataUrl, themeVars } from '#lib/admin/plugin-host/build.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import { Skeleton } from '#lib/components/ui/skeleton/index.ts';
	import FolderPicker from './FolderPicker.svelte';

	let { name, title, serverVersion }: { name: string; title: string; serverVersion?: string } = $props();

	let iframe = $state<HTMLIFrameElement | null>(null);
	let srcdoc = $state('');
	let height = $state(480);
	let ready = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		load(name);
	});

	async function load(page: string) {
		ready = false;
		error = null;
		srcdoc = '';
		try {
			const [html, font] = await Promise.all([getConfigPageSource(page), iconFontDataUrl()]);
			srcdoc = buildDocument(
				html,
				{
					server: session.serverUrl!,
					token: session.accessToken!,
					authorization: api().authorizationHeader,
					userId: session.userId,
					serverId: session.user?.ServerId ?? undefined,
					version: serverVersion ?? '',
					deviceId: jellyfin.deviceInfo.id,
					deviceName: jellyfin.deviceInfo.name,
					appName: jellyfin.clientInfo.name,
					appVersion: jellyfin.clientInfo.version,
					query: `name=${encodeURIComponent(page)}`,
					theme: { dark: mode.current === 'dark', vars: themeVars() }
				},
				font
			);
		} catch (e) {
			error = e instanceof Error ? e.message : "This page couldn't be loaded.";
		}
	}

	// Follow the app's theme without reloading the page (and losing unsaved plugin form edits).
	$effect(() => {
		const dark = mode.current === 'dark';
		if (!ready) return;
		requestAnimationFrame(() => iframe?.contentWindow?.postMessage({ __jfTheme: { dark, vars: themeVars() } }, '*'));
	});

	function reply(id: number, value: unknown, transfer: Transferable[] = []) {
		iframe?.contentWindow?.postMessage({ __jfReply: id, value }, '*', transfer);
	}

	/** Server requests made by the plugin page: done here, same-origin and authorised, so CORS settings don't matter. */
	function proxyFetch(d: { id?: number; url?: unknown; method?: unknown; headers?: unknown; body?: unknown }) {
		const id = d.id!;
		const base = session.serverUrl!.replace(/\/+$/, '');
		const url = String(d.url ?? '');
		if (url !== base && !url.startsWith(base + '/')) return reply(id, { error: 'blocked' });
		const headers = new Headers((d.headers as Record<string, string>) ?? {});
		headers.set('Authorization', api().authorizationHeader);
		fetch(url, { method: String(d.method ?? 'GET'), headers, body: (d.body as ArrayBuffer | null) ?? undefined })
			.then(async (res) => {
				const body = await res.arrayBuffer();
				reply(id, { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], body }, [body]);
			})
			.catch(() => reply(id, { error: 'network' }));
	}

	let picking = $state(false);
	let pickerTitle = $state('Choose a folder');
	let pickerId: number | null = null;
	let picked: string | null = null;
	$effect(() => {
		if (picking || pickerId == null) return;
		reply(pickerId, picked);
		pickerId = null;
		picked = null;
	});

	function navigate(url: string) {
		const m = /configurationpage\?name=([^&#]+)/i.exec(url);
		if (m) {
			goto(resolve('/admin/plugins/page') + `?name=${encodeURIComponent(decodeURIComponent(m[1]))}`);
		} else if (/dashboard|plugins/i.test(url)) {
			goto(resolve('/admin/plugins'));
		} else {
			toasts.show("The plugin tried to open a page this dashboard doesn't have.");
		}
	}

	function onMessage(e: MessageEvent) {
		// Only messages from our own frame, in our own envelope.
		if (!iframe || e.source !== iframe.contentWindow) return;
		const d = e.data as { __jfPlugin?: boolean; type?: string; id?: number; [k: string]: unknown };
		if (!d?.__jfPlugin) return;
		switch (d.type) {
			case 'height':
				height = Math.max(160, Number(d.value) || 0);
				break;
			case 'ready':
				ready = true;
				break;
			case 'toast':
				if (d.tone === 'error') toasts.error(String(d.message ?? ''));
				else if (d.message) toasts.show(String(d.message));
				break;
			case 'confirm':
				confirm({ title: String(d.title || 'Are you sure?'), body: String(d.message ?? ''), confirmLabel: 'OK' }).then((ok) => reply(d.id!, ok === true));
				break;
			case 'directory':
				pickerId = d.id!;
				pickerTitle = String(d.header || 'Choose a folder');
				picking = true;
				break;
			case 'fetch':
				proxyFetch(d);
				break;
			case 'navigate':
				navigate(String(d.url ?? ''));
				break;
			case 'log':
				console.warn(`[plugin page ${name}]`, d.message);
				break;
		}
	}
</script>

<svelte:window onmessage={onMessage} />

{#if error}
	<p role="alert" class="text-destructive">{error}</p>
{:else}
	{#if !ready}<Skeleton class="h-64 rounded-2xl" />{/if}
	{#if srcdoc}
		<iframe
			bind:this={iframe}
			title="{title} settings"
			{srcdoc}
			sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
			class="w-full border-0 {ready ? '' : 'pointer-events-none absolute h-0 opacity-0'}"
			style={ready ? `height: ${height}px` : undefined}
		></iframe>
	{/if}
{/if}

<FolderPicker bind:open={picking} title={pickerTitle} onpick={(p) => (picked = p)} />
