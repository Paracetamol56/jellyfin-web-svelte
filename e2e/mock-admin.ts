import type { Page, Route } from '@playwright/test';

/** Server-admin endpoints on top of mockJellyfin(). Register after it (later routes win). */
export interface AdminLog {
	writes: { method: string; path: string; query: string; body: unknown }[];
}

const T = 10_000_000;
/** A page in the shape real plugins ship: stock-client markup, ApiClient, Dashboard, localStorage. */
const PLUGIN_PAGE = `<div id="tmdbPage" data-role="page" class="page type-interior pluginConfigurationPage"><div class="content-primary">
<form class="cfg">
<div class="inputContainer"><label class="inputLabel" for="nm">Display name</label><input id="nm" is="emby-input"></div>
<label class="emby-checkbox-label"><input type="checkbox" id="en"><span>Enabled</span></label>
<button type="submit" class="raised button-submit"><span>Save</span></button>
</form></div>
<script>
(function () {
	var id = 'pl-tmdb';
	document.getElementById('tmdbPage').addEventListener('pageshow', function () {
		localStorage.setItem('seen', '1');
		Dashboard.showLoadingMsg();
		ApiClient.getPluginConfiguration(id).then(function (c) {
			document.getElementById('nm').value = c.Name;
			document.getElementById('en').checked = c.Enabled;
			Dashboard.hideLoadingMsg();
		});
	});
	document.querySelector('.cfg').addEventListener('submit', function (e) {
		e.preventDefault();
		ApiClient.getPluginConfiguration(id).then(function (c) {
			c.Name = document.getElementById('nm').value;
			c.Enabled = document.getElementById('en').checked;
			return ApiClient.updatePluginConfiguration(id, c);
		}).then(Dashboard.processPluginConfigurationUpdateResult);
	});
})();
</script></div>`;

// Plugin pages run in a sandboxed frame (opaque origin), so their requests are cross-origin and need CORS, as on a real server.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: CORS });

export async function mockAdmin(page: Page): Promise<AdminLog> {
	const log: AdminLog = { writes: [] };
	const users = [
		{ Id: 'u1', Name: 'Alex', HasPassword: true, LastActivityDate: new Date().toISOString(), Policy: { IsAdministrator: true, EnableAllFolders: true, EnabledFolders: [], EnableAllDevices: true, EnableMediaPlayback: true } },
		{ Id: 'u2', Name: 'Sam', HasPassword: false, LastActivityDate: null, Policy: { IsAdministrator: false, EnableAllFolders: false, EnabledFolders: ['lib-movies'], EnableAllDevices: true, EnableMediaPlayback: true, EnableVideoPlaybackTranscoding: true } }
	];
	const libraries = [
		{ Name: 'Movies', ItemId: 'lib-movies', CollectionType: 'movies', Locations: ['/media/movies'], RefreshStatus: 'Idle', LibraryOptions: { EnableRealtimeMonitor: false, EnableInternetProviders: true, PreferredMetadataLanguage: '' } },
		{ Name: 'Music', ItemId: 'lib-music', CollectionType: 'music', Locations: ['/media/music'], RefreshStatus: 'Idle', LibraryOptions: { EnableRealtimeMonitor: true } }
	];
	const tasks = [
		{ Id: 'tk-scan', Name: 'Scan media library', Category: 'Library', Description: 'Scans your library.', State: 'Idle', Triggers: [{ Type: 'IntervalTrigger', IntervalTicks: 12 * 3600 * T }], LastExecutionResult: { Status: 'Completed', StartTimeUtc: new Date(Date.now() - 3_600_000).toISOString(), EndTimeUtc: new Date(Date.now() - 3_500_000).toISOString() } },
		{ Id: 'tk-lyrics', Name: 'Download missing lyrics', Category: 'Library', Description: 'Downloads lyrics.', State: 'Running', CurrentProgressPercentage: 42, Triggers: [{ Type: 'DailyTrigger', TimeOfDayTicks: 3 * 3600 * T }] },
		{ Id: 'tk-sync', Name: 'Sync loved tracks', Category: 'ListenBrainz', Description: 'Sync favourites.', State: 'Idle', Triggers: [], LastExecutionResult: { Status: 'Failed', ErrorMessage: 'Getting user loved tracks failed', EndTimeUtc: new Date(Date.now() - 7_200_000).toISOString() } }
	];
	const logText = [
		'[2026-11-15 10:00:00.000 +00:00] [INF] [1] Main: Jellyfin version: 12.4.0',
		'[2026-11-15 10:00:01.000 +00:00] [WRN] [7] Scanner: Slow disk detected',
		'[2026-11-15 10:00:02.000 +00:00] [ERR] [9] ListenBrainz: Getting user loved tracks failed',
		'   at ListenBrainz.Sync()',
		'[2026-11-15 10:00:03.000 +00:00] [INF] [1] Main: Startup complete'
	].join('\n');
	const config = { ServerName: 'Test Server', UICulture: 'en-US', PreferredMetadataLanguage: 'en', MetadataCountryCode: 'US', QuickConnectAvailable: true, MinResumePct: 5, MaxResumePct: 90, MinResumeDurationSeconds: 300, RemoteClientBitrateLimit: 0, LogFileRetentionDays: 3, ActivityLogRetentionDays: 30 };
	const named: Record<string, object> = {
		encoding: { HardwareAccelerationType: 'none', EncoderPreset: 'auto', H264Crf: 23, H265Crf: 28, EncodingThreadCount: -1, HardwareDecodingCodecs: ['h264'], EnableThrottling: false },
		network: { BaseUrl: '', InternalHttpPort: 8096, EnableRemoteAccess: true, LocalNetworkSubnets: [], KnownProxies: [] },
		branding: { LoginDisclaimer: '', CustomCss: '', SplashscreenEnabled: false }
	};

	await page.route(
		(url) => /^\/(web\/ConfigurationPages?|System|Sessions|ScheduledTasks|Users|Localization|Devices|Auth|Library|Environment|Plugins|Packages|Repositories|Backup|Items\/Counts)/.test(url.pathname),
		async (route) => {
			const req = route.request();
			const url = new URL(req.url());
			const p = url.pathname;
			const m = req.method();
			const body = () => {
				try {
					return req.postDataJSON();
				} catch {
					return req.postData();
				}
			};
			const write = () => log.writes.push({ method: m, path: p, query: url.search, body: m === 'GET' ? null : body() });
			let x: RegExpMatchArray | null;
			if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

			if (m === 'GET') {
				if (p === '/web/ConfigurationPages')
					return json(route, [{ Name: 'tmdb', DisplayName: 'TMDb', PluginId: 'pl-tmdb', EnableInMainMenu: true }, { Name: 'tmdb.js', DisplayName: 'TMDb', PluginId: 'pl-tmdb', EnableInMainMenu: false }]);
				if (p === '/web/ConfigurationPage') return route.fulfill({ status: 200, contentType: 'text/html', body: PLUGIN_PAGE, headers: CORS });
				if (p === '/Plugins/pl-tmdb/Configuration') return json(route, { Name: 'Test', Enabled: false });
				if (p === '/System/Info') return json(route, { ServerName: 'Test Server', Version: '12.4.0', OperatingSystem: 'Linux', SystemArchitecture: 'X64', HasPendingRestart: true, HasUpdateAvailable: false });
				if (p === '/System/Info/Storage')
					return json(route, {
						ProgramDataFolder: { Path: '/config', FreeSpace: 10e9, UsedSpace: 50e9, DeviceId: 'sda' },
						CacheFolder: { Path: '/cache', FreeSpace: 10e9, UsedSpace: 50e9, DeviceId: 'sda' },
						Libraries: [{ Id: 'lib-movies', Name: 'Movies', Folders: [{ Path: '/media/movies', FreeSpace: 500e9, UsedSpace: 3000e9, DeviceId: 'sdb' }] }]
					});
				if (p === '/Items/Counts') return json(route, { MovieCount: 413, SeriesCount: 45, EpisodeCount: 1659, AlbumCount: 5224, SongCount: 19007, ItemCount: 29789 });
				if (p === '/Sessions')
					return json(route, [
						{ Id: 's1', UserName: 'Sam', DeviceName: 'Living room TV', Client: 'Jellyfin Android TV', SupportsRemoteControl: true, NowPlayingItem: { Id: 'm1', Name: 'Wolf Children', RunTimeTicks: 117 * 60 * T }, PlayState: { PositionTicks: 30 * 60 * T, IsPaused: false, PlayMethod: 'Transcode' }, TranscodingInfo: { IsVideoDirect: false, IsAudioDirect: true, VideoCodec: 'h264', HardwareAccelerationType: 'vaapi', Bitrate: 8_000_000, TranscodeReasons: ['VideoCodecNotSupported'] } },
						{ Id: 's2', UserName: 'Alex', DeviceName: 'Laptop', Client: 'Jellyfin Web', LastActivityDate: new Date().toISOString() }
					]);
				if (p === '/System/ActivityLog/Entries') {
					// A fortnight of plays and sign-ins, evenings mostly, on top of two fixed entries.
					const day = 86_400_000;
					const generated = Array.from({ length: 14 }, (_, d) => [
						{ Type: 'AudioPlayback', Name: 'Sam is playing a track', at: 20, UserId: 'u2' },
						{ Type: 'AudioPlayback', Name: 'Alex is playing a track', at: 9, UserId: 'u1' },
						...(d % 3 === 0 ? [{ Type: 'VideoPlayback', Name: 'Sam is playing a movie', at: 21, UserId: 'u2' }] : []),
						...(d % 2 === 0 ? [{ Type: 'AuthenticationSucceeded', Name: 'Sign-in succeeded (Sam)', at: 19, UserId: 'u2' }] : [])
					].map((e, i) => {
						const t = new Date(Date.now() - d * day);
						t.setHours(e.at, i, 0, 0);
						return { Id: 100 + d * 10 + i, Name: e.Name, Type: e.Type, UserId: e.UserId, Date: t.toISOString(), Severity: 'Information' };
					})).flat();
					return json(route, {
						TotalRecordCount: generated.length + 2,
						Items: [{ Id: 1, Name: 'Sam signed in', Date: new Date().toISOString(), Severity: 'Information' }, { Id: 2, Name: 'Task failed', Date: new Date().toISOString(), Severity: 'Error', ShortOverview: 'Sync loved tracks' }, ...generated]
					});
				}
				if (p === '/ScheduledTasks') return json(route, tasks);
				if (p === '/Users') return json(route, users);
				if ((x = p.match(/^\/Users\/([^/]+)$/)) && x[1] !== 'Me' && x[1] !== 'Public') {
					const u = users.find((u) => u.Id === x![1]);
					return u ? json(route, u) : route.fallback();
				}
				if (p === '/Localization/ParentalRatings') return json(route, [{ Name: 'G', Value: 0 }, { Name: 'PG', Value: 10 }, { Name: 'R', Value: 17 }]);
				if (p === '/Localization/Options') return json(route, [{ Name: 'English', Value: 'en-US' }, { Name: 'Français', Value: 'fr' }]);
				if (p === '/Localization/Cultures') return json(route, [{ DisplayName: 'English', TwoLetterISOLanguageName: 'en' }, { DisplayName: 'French', TwoLetterISOLanguageName: 'fr' }]);
				if (p === '/Localization/Countries') return json(route, [{ DisplayName: 'United States', TwoLetterISORegionName: 'US' }, { DisplayName: 'France', TwoLetterISORegionName: 'FR' }]);
				// The server keeps one record per sign-in, so the same device can be listed twice.
				if (p === '/Devices')
					return json(route, {
						Items: [
							{ Id: 'dev-tv', Name: 'Living room TV', AppName: 'Jellyfin Android TV', AppVersion: '0.18', LastUserName: 'Sam', LastUserId: 'u2', DateLastActivity: new Date().toISOString() },
							{ Id: 'dev-tv', Name: 'Living room TV', AppName: 'Jellyfin Android TV', AppVersion: '0.17', LastUserName: 'Sam', LastUserId: 'u2', DateLastActivity: new Date(Date.now() - 86_400_000).toISOString() }
						]
					});
				if (p === '/Auth/Keys') return json(route, { Items: [{ AccessToken: 'abcdef0123456789', AppName: 'Home Assistant', DateCreated: new Date().toISOString() }] });
				if (p === '/Library/VirtualFolders') return json(route, libraries);
				if (p === '/Environment/Drives') return json(route, [{ Name: '/', Path: '/', Type: 'Directory' }]);
				if (p === '/Environment/DirectoryContents') return json(route, [{ Name: 'media', Path: '/media', Type: 'Directory' }, { Name: 'srv', Path: '/srv', Type: 'Directory' }]);
				if (p === '/Environment/ParentPath') return json(route, '/');
				if (p === '/System/Configuration') return json(route, config);
				if ((x = p.match(/^\/System\/Configuration\/(\w+)$/))) return json(route, named[x[1]] ?? {});
				if (p === '/Plugins') return json(route, [{ Id: 'pl-tmdb', Name: 'TMDb', Version: '12.3.0.0', Status: 'Active', CanUninstall: false, Description: 'Movie metadata' }, { Id: 'pl-lb', Name: 'ListenBrainz', Version: '6.6.2.1', Status: 'Active', CanUninstall: true }]);
				if (p === '/Packages')
					return json(route, [
						{ name: 'TMDb', guid: 'pl-tmdb', category: 'Metadata', owner: 'jellyfin', overview: 'Movie metadata', versions: [{ version: '12.4.0.0', repositoryUrl: 'https://repo' }] },
						{ name: 'Fanart', guid: 'pl-fanart', category: 'Metadata', owner: 'jellyfin', overview: 'Artwork from fanart.tv', versions: [{ version: '12.0.0.0', repositoryUrl: 'https://repo' }] }
					]);
				if (p === '/Repositories') return json(route, [{ Name: 'Jellyfin Stable', Url: 'https://repo.jellyfin.org/manifest.json', Enabled: true }]);
				if (p === '/System/Logs') return json(route, [{ Name: 'log_20261115.log', Size: 4096, DateModified: new Date().toISOString() }]);
				if (p === '/System/Logs/Log') return route.fulfill({ status: 200, contentType: 'text/plain', body: logText });
				if (p === '/Backup') return json(route, []);
				return route.fallback();
			}
			// Writes: record, then answer like the server does. Sign-in stays with the base mock.
			if (p === '/Users/AuthenticateByName') return route.fallback();
			if (p === '/Users/New') {
				write();
				const u = { Id: 'u3', Name: (body() as { Name: string }).Name, HasPassword: false, LastActivityDate: null, Policy: { IsAdministrator: false, EnableAllFolders: true, EnabledFolders: [], EnableAllDevices: true, EnableMediaPlayback: true } };
				users.push(u as never);
				return json(route, u);
			}
			if (/^\/(System\/(Restart|Shutdown|Configuration)|Sessions\/[^/]+\/(Message|Playing)|ScheduledTasks\/Running|Users\/|Users$|Devices|Auth\/Keys|Library\/|Plugins\/|Packages\/|Repositories|Backup\/)/.test(p)) {
				write();
				return route.fulfill({ status: 204, headers: CORS });
			}
			return route.fallback();
		}
	);
	return log;
}
