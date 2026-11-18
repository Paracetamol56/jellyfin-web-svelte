// Everything the admin dashboard reads and writes, in one place.
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import { getBackupApi } from '@jellyfin/sdk/lib/utils/api/backup-api';
import { getDeviceApi } from '@jellyfin/sdk/lib/utils/api/device-api';
import { getEnvironmentApi } from '@jellyfin/sdk/lib/utils/api/environment-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api/library-structure-api';
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api';
import { getPluginApi } from '@jellyfin/sdk/lib/utils/api/plugin-api';
import { getScheduledTaskApi } from '@jellyfin/sdk/lib/utils/api/scheduled-task-api';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type {
	BrandingOptionsDto,
	CollectionTypeOptions,
	EncodingOptions,
	LibraryOptions,
	NetworkConfiguration,
	PlaystateCommand,
	ServerConfiguration,
	UserDto,
	UserPolicy
} from '@jellyfin/sdk/lib/generated-client/models';
import { api, session } from '#lib/api/session.svelte.ts';

export const adminKeys = {
	system: ['admin', 'system'] as const,
	storage: ['admin', 'storage'] as const,
	sessions: ['admin', 'sessions'] as const,
	counts: ['admin', 'counts'] as const,
	activity: (f: object) => ['admin', 'activity', f] as const,
	tasks: ['admin', 'tasks'] as const,
	users: ['admin', 'users'] as const,
	user: (id: string) => ['admin', 'user', id] as const,
	devices: ['admin', 'devices'] as const,
	keys: ['admin', 'keys'] as const,
	libraries: ['admin', 'libraries'] as const,
	config: ['admin', 'config'] as const,
	named: (key: string) => ['admin', 'named', key] as const,
	plugins: ['admin', 'plugins'] as const,
	packages: ['admin', 'packages'] as const,
	repos: ['admin', 'repos'] as const,
	logs: ['admin', 'logs'] as const,
	log: (name: string) => ['admin', 'log', name] as const,
	backups: ['admin', 'backups'] as const,
	localization: ['admin', 'localization'] as const
};

// ── Overview ─────────────────────────────────────────────
export const getSystemInfo = async () => (await getSystemApi(api()).getSystemInfo()).data;
export const getStorage = async () => (await getSystemApi(api()).getSystemStorage()).data;
export const getCounts = async () => (await getLibraryApi(api()).getItemCounts({ userId: session.userId })).data;
export const getActiveSessions = async () => (await getSessionApi(api()).getSessions({ activeWithinSeconds: 960 })).data;
export const restartServer = () => getSystemApi(api()).restartApplication();
export const shutdownServer = () => getSystemApi(api()).shutdownApplication();
export const sendMessage = (sessionId: string, header: string, text: string) =>
	getSessionApi(api()).sendMessageCommand({ sessionId, messageCommand: { Header: header, Text: text, TimeoutMs: 10_000 } });
export const sendPlaystate = (sessionId: string, command: PlaystateCommand) =>
	getSessionApi(api()).sendPlaystateCommand({ sessionId, command });

export async function getActivity(f: { start: number; limit: number; severity?: string; usersOnly?: boolean }) {
	const { data } = await getSystemApi(api()).getLogEntries({
		startIndex: f.start,
		limit: f.limit,
		hasUserId: f.usersOnly || undefined,
		severity: (f.severity as never) || undefined,
		sortBy: ['DateCreated' as never],
		sortOrder: ['Descending']
	});
	return data;
}

// ── Tasks ────────────────────────────────────────────────
export const getTasks = async () => (await getScheduledTaskApi(api()).getTasks({ isHidden: false })).data;
export const startTask = (taskId: string) => getScheduledTaskApi(api()).startTask({ taskId });
export const stopTask = (taskId: string) => getScheduledTaskApi(api()).stopTask({ taskId });

// ── Users ────────────────────────────────────────────────
export const getUsers = async () => (await getUserApi(api()).getUsers()).data;
export const getUser = async (userId: string) => (await getUserApi(api()).getUserById({ userId })).data;
export const createUser = async (name: string, password: string) =>
	(await getUserApi(api()).createUserByName({ createUserByName: { Name: name, Password: password || undefined } })).data;
export const updateUser = (user: UserDto) => getUserApi(api()).updateUser({ userId: user.Id!, userDto: user });
export const updatePolicy = (userId: string, userPolicy: UserPolicy) => getUserApi(api()).updateUserPolicy({ userId, userPolicy });
export const setPassword = (userId: string, newPassword: string) =>
	getUserApi(api()).updateUserPassword({ userId, updateUserPassword: { NewPw: newPassword, ResetPassword: false } });
export const resetPassword = (userId: string) =>
	getUserApi(api()).updateUserPassword({ userId, updateUserPassword: { ResetPassword: true } });
export const deleteUser = (userId: string) => getUserApi(api()).deleteUser({ userId });
export const getParentalRatings = async () => (await getLocalizationApi(api()).getParentalRatings()).data;

// ── Devices & API keys ───────────────────────────────────
/** One entry per device: the server keeps a record per sign-in, so the same device can appear several times. */
export async function getDevices() {
	const items = (await getDeviceApi(api()).getDevices()).data.Items ?? [];
	const byId = new Map<string, (typeof items)[number]>();
	for (const d of items) {
		const prev = byId.get(d.Id ?? '');
		if (!prev || (d.DateLastActivity ?? '') > (prev.DateLastActivity ?? '')) byId.set(d.Id ?? '', d);
	}
	return [...byId.values()];
}
export const deleteDevice = (id: string) => getDeviceApi(api()).deleteDevice({ id: [id] });
export const getKeys = async () => (await getAuthenticationApi(api()).getKeys()).data.Items ?? [];
export const createKey = (app: string) => getAuthenticationApi(api()).createKey({ app });
export const revokeKey = (key: string) => getAuthenticationApi(api()).revokeKey({ key });

// ── Libraries ────────────────────────────────────────────
export const getLibraries = async () => (await getLibraryStructureApi(api()).getVirtualFolders()).data;
export const scanAll = () => getLibraryApi(api()).refreshLibrary();
export const scanLibrary = (itemId: string) =>
	getLibraryApi(api()).refreshItem({ itemId, metadataRefreshMode: 'Default', imageRefreshMode: 'Default', replaceAllMetadata: false, replaceAllImages: false });
export const addLibrary = (name: string, type: CollectionTypeOptions, paths: string[], options: LibraryOptions) =>
	getLibraryStructureApi(api()).addVirtualFolder({
		name,
		collectionType: type,
		paths,
		refreshLibrary: true,
		addVirtualFolderDto: { LibraryOptions: { ...options, PathInfos: paths.map((Path) => ({ Path })) } }
	});
export const removeLibrary = (name: string) => getLibraryStructureApi(api()).removeVirtualFolder({ name, refreshLibrary: true });
export const renameLibrary = (name: string, newName: string) => getLibraryStructureApi(api()).renameVirtualFolder({ name, newName, refreshLibrary: true });
export const addLibraryPath = (name: string, path: string) =>
	getLibraryStructureApi(api()).addMediaPath({ mediaPathDto: { Name: name, Path: path }, refreshLibrary: true });
export const removeLibraryPath = (name: string, path: string) => getLibraryStructureApi(api()).removeMediaPath({ name, path, refreshLibrary: true });
export const updateLibraryOptions = (id: string, options: LibraryOptions) =>
	getLibraryStructureApi(api()).updateLibraryOptions({ updateLibraryOptionsDto: { Id: id, LibraryOptions: options } });
export async function listDirectory(path: string) {
	const env = getEnvironmentApi(api());
	if (!path) return (await env.getDrives()).data;
	return (await env.getDirectoryContents({ path, includeDirectories: true, includeFiles: false })).data;
}
export const parentPath = async (path: string) => (await getEnvironmentApi(api()).getParentPath({ path })).data as unknown as string | null;

// ── Configuration ────────────────────────────────────────
export const getConfig = async () => (await getSystemApi(api()).getConfiguration()).data;
export const saveConfig = (c: ServerConfiguration) => getSystemApi(api()).updateConfiguration({ serverConfiguration: c });
type Named = { encoding: EncodingOptions; network: NetworkConfiguration; branding: BrandingOptionsDto };
export async function getNamed<K extends keyof Named>(key: K): Promise<Named[K]> {
	const { data } = await getSystemApi(api()).getNamedConfiguration({ key });
	return (typeof data === 'string' ? JSON.parse(data) : data) as Named[K];
}
export const saveNamed = <K extends keyof Named>(key: K, body: Named[K]) => getSystemApi(api()).updateNamedConfiguration({ key, body });
export async function getLocalization() {
	const l = getLocalizationApi(api());
	const [ui, cultures, countries] = await Promise.all([l.getLocalizationOptions(), l.getCultures(), l.getCountries()]);
	return { ui: ui.data, cultures: cultures.data, countries: countries.data };
}

// ── Plugins ──────────────────────────────────────────────
export const getPlugins = async () => (await getPluginApi(api()).getPlugins()).data;
export const enablePlugin = (pluginId: string, version: string) => getPluginApi(api()).enablePlugin({ pluginId, version });
export const disablePlugin = (pluginId: string, version: string) => getPluginApi(api()).disablePlugin({ pluginId, version });
export const uninstallPlugin = (pluginId: string, version: string) => getPluginApi(api()).uninstallPluginByVersion({ pluginId, version });
export const getPackages = async () => (await getPluginApi(api()).getPackages()).data;
export const installPackage = (name: string, guid: string, version: string, repositoryUrl?: string) =>
	getPluginApi(api()).installPackage({ name, assemblyGuid: guid, version, repositoryUrl });
export const getRepositories = async () => (await getPluginApi(api()).getRepositories()).data;
export const setRepositories = (repos: { Name: string; Url: string; Enabled: boolean }[]) => getPluginApi(api()).setRepositories({ repositoryInfo: repos });
export const pluginImageUrl = (id: string, version: string) => `${session.serverUrl}/Plugins/${id}/${version}/Image`;

// ── Logs & backups ───────────────────────────────────────
export const getLogFiles = async () => (await getSystemApi(api()).getServerLogs()).data;
export async function getLogFile(name: string): Promise<string> {
	const { data } = await getSystemApi(api()).getLogFile({ name }, { responseType: 'text' });
	return data as unknown as string;
}
export const logDownloadUrl = (name: string) => `${session.serverUrl}/System/Logs/Log?name=${encodeURIComponent(name)}&api_key=${session.accessToken}`;
export const listBackups = async () => (await getBackupApi(api()).listBackups()).data;
export const createBackup = (o: { Metadata: boolean; Trickplay: boolean; Subtitles: boolean; Database: boolean }) =>
	getBackupApi(api()).createBackup({ backupOptionsDto: o });
export const restoreBackup = (archiveFileName: string) =>
	getBackupApi(api()).startRestoreBackup({ backupRestoreRequestDto: { ArchiveFileName: archiveFileName } });

/** Album artists, as the Music library counts them. (Items/Counts' ArtistCount only counts artist records with their own folder.) */
export async function getAlbumArtistCount(): Promise<number> {
	const { getArtistApi } = await import('@jellyfin/sdk/lib/utils/api/artist-api');
	const { data } = await getArtistApi(api()).getAlbumArtists({ userId: session.userId, limit: 0, enableTotalRecordCount: true });
	return data.TotalRecordCount ?? 0;
}

// ── Plugin configuration pages ───────────────────────────
export const getConfigPages = async () => (await getPluginApi(api()).getConfigurationPages()).data;
export async function getConfigPageSource(name: string): Promise<string> {
	const res = await fetch(`${session.serverUrl}/web/ConfigurationPage?name=${encodeURIComponent(name)}`, { headers: { Authorization: api().authorizationHeader } });
	if (!res.ok) throw new Error(`The server returned ${res.status} for this page.`);
	return res.text();
}
/** The page a plugin's "Settings" button opens: an HTML page (not its .js/.css), preferring one it lists in the menu. */
export function primaryConfigPage(pages: { Name?: string | null; PluginId?: string | null; EnableInMainMenu?: boolean }[], pluginId: string) {
	const own = pages.filter((p) => p.PluginId === pluginId && p.Name);
	const names = new Set(own.map((p) => p.Name!));
	const html = own.filter((p) => !/\.(js|css)$/i.test(p.Name!) && !(p.Name!.endsWith('js') && names.has(p.Name!.slice(0, -2))));
	return html.find((p) => p.EnableInMainMenu) ?? html[0] ?? null;
}

// ── Statistics ───────────────────────────────────────────
/** Activity-log entries newer than `days` days, newest first (up to `cap`; the log can hold tens of thousands). */
export async function getActivitySince(days: number, cap = 6000) {
	const minDate = new Date(Date.now() - days * 86_400_000).toISOString();
	const out: Awaited<ReturnType<typeof getActivity>>['Items'] = [];
	for (let start = 0; start < cap; start += 1000) {
		const page = await getSystemApi(api()).getLogEntries({
			startIndex: start,
			limit: Math.min(1000, cap - start),
			minDate,
			sortBy: ['DateCreated' as never],
			sortOrder: ['Descending']
		});
		const items = page.data.Items ?? [];
		out!.push(...items);
		if (items.length < 1000 || out!.length >= (page.data.TotalRecordCount ?? 0)) break;
	}
	return out ?? [];
}

/** What the library holds, from the items themselves: movies in full, plus when episodes and albums were added. */
export async function getLibraryInsights() {
	const lib = getLibraryApi(api());
	const base = {
		userId: session.userId,
		recursive: true,
		enableImages: false,
		enableUserData: false,
		sortBy: ['DateCreated' as never],
		sortOrder: ['Descending' as never],
		fields: ['DateCreated', 'Width', 'Height'] as never
	};
	const [movies, episodes, albums] = await Promise.all([
		lib.getItems({ ...base, includeItemTypes: ['Movie'], limit: 6000 }),
		lib.getItems({ ...base, includeItemTypes: ['Episode'], limit: 4000 }),
		lib.getItems({ ...base, includeItemTypes: ['MusicAlbum'], limit: 4000 })
	]);
	const m = movies.data.Items ?? [];
	return {
		movies: m,
		added: [
			...m.map((i) => ({ kind: 'movies' as const, created: i.DateCreated })),
			...(episodes.data.Items ?? []).map((i) => ({ kind: 'episodes' as const, created: i.DateCreated })),
			...(albums.data.Items ?? []).map((i) => ({ kind: 'albums' as const, created: i.DateCreated }))
		]
	};
}
