import { Jellyfin, type Api } from '@jellyfin/sdk';
import type { AuthenticationResult, UserDto } from '@jellyfin/sdk/lib/generated-client/models';
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';

const STORAGE_KEY = 'jf.session';
const DEVICE_KEY = 'jf.deviceId';

function storage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function deviceId(): string {
	const s = storage();
	let id = s?.getItem(DEVICE_KEY);
	if (!id) {
		id = crypto.randomUUID();
		s?.setItem(DEVICE_KEY, id);
	}
	return id;
}

export const jellyfin = new Jellyfin({
	clientInfo: { name: 'Jellyfin Svelte Client', version: '0.1.0' },
	deviceInfo: { name: navigator.userAgent.includes('Mobile') ? 'Mobile browser' : 'Web browser', id: deviceId() }
});

/** Server the app was most likely loaded from (or the dev proxy). */
export function defaultServerUrl(): string {
	if (import.meta.env.DEV && import.meta.env.VITE_JELLYFIN_URL) {
		return `${location.origin}/jf-proxy`;
	}
	const path = location.pathname.replace(/\/web\/.*$|\/web$|\/index\.html$/, '').replace(/\/$/, '');
	return `${location.origin}${path}`;
}

interface Stored {
	serverUrl: string;
	accessToken: string;
	user: UserDto;
}

class Session {
	serverUrl = $state<string | null>(null);
	accessToken = $state<string | null>(null);
	user = $state<UserDto | null>(null);
	ready = $state(false);

	api: Api | null = $derived(
		this.serverUrl && this.accessToken ? jellyfin.createApi(this.serverUrl, this.accessToken) : null
	);

	get userId(): string {
		return this.user?.Id ?? '';
	}

	get isAdmin(): boolean {
		return !!this.user?.Policy?.IsAdministrator;
	}

	/** Restore a saved session and confirm its token still works. */
	async restore(): Promise<void> {
		try {
			const raw = storage()?.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as Stored;
			const api = jellyfin.createApi(saved.serverUrl, saved.accessToken);
			const { data } = await getUserApi(api).getCurrentUser();
			this.serverUrl = saved.serverUrl;
			this.accessToken = saved.accessToken;
			this.user = data;
		} catch {
			storage()?.removeItem(STORAGE_KEY);
		} finally {
			this.ready = true;
		}
	}

	async login(serverUrl: string, username: string, password: string): Promise<void> {
		const base = serverUrl.replace(/\/+$/, '');
		const api = jellyfin.createApi(base);
		const { data } = await api.authenticateUserByName(username, password);
		this.#adopt(base, data);
	}

	/** Finish a Quick Connect sign-in once another device has approved the code. */
	async loginWithQuickConnect(serverUrl: string, secret: string): Promise<void> {
		const base = serverUrl.replace(/\/+$/, '');
		const { data } = await getAuthenticationApi(jellyfin.createApi(base)).authenticateWithQuickConnect({ quickConnectDto: { Secret: secret } });
		this.#adopt(base, data);
	}

	#adopt(base: string, data: AuthenticationResult) {
		if (!data.AccessToken || !data.User) throw new Error('The server did not return a session.');
		this.serverUrl = base;
		this.accessToken = data.AccessToken;
		this.user = data.User;
		storage()?.setItem(
			STORAGE_KEY,
			JSON.stringify({ serverUrl: base, accessToken: data.AccessToken, user: data.User } satisfies Stored)
		);
	}

	async logout(): Promise<void> {
		try {
			await this.api?.logout();
		} catch {
			// Token may already be invalid; sign out locally regardless.
		}
		this.accessToken = null;
		this.user = null;
		storage()?.removeItem(STORAGE_KEY);
	}
}

export const session = new Session();

/** The authenticated API; only call from views that render after login. */
export function api(): Api {
	if (!session.api) throw new Error('Not signed in');
	return session.api;
}
