import type { Page, Route } from '@playwright/test';
import * as F from './fixtures';

export interface MockLog {
	requests: string[];
	writes: { method: string; path: string; body: unknown }[];
	reports: { kind: string; body: unknown }[];
}

const PASSWORD = 'correct horse';

/** One second-ish of silence as WAV, served as every media stream. */
function wav(seconds = 30, rate = 8000): Buffer {
	const data = Buffer.alloc(seconds * rate * 2);
	const h = Buffer.alloc(44);
	h.write('RIFF', 0);
	h.writeUInt32LE(36 + data.length, 4);
	h.write('WAVEfmt ', 8);
	h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20);
	h.writeUInt16LE(1, 22);
	h.writeUInt32LE(rate, 24);
	h.writeUInt32LE(rate * 2, 28);
	h.writeUInt16LE(2, 32);
	h.writeUInt16LE(16, 34);
	h.write('data', 36);
	h.writeUInt32LE(data.length, 40);
	return Buffer.concat([h, data]);
}
const WAV = wav();

function art(id: string): string {
	const palette = ['#5A1620', '#1E3C6E', '#14341F', '#C4502A', '#41507A', '#9ED1CB'];
	let n = 0;
	for (const c of id) n += c.charCodeAt(0);
	const bg = palette[n % palette.length];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="${bg}"/><circle cx="200" cy="260" r="110" fill="#ffffff" opacity="0.18"/></svg>`;
}

const json = (route: Route, body: unknown, status = 200) =>
	route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
const page_ = (items: object[]) => ({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });

/**
 * Serves a fake Jellyfin from the app's own origin (as a real server does
 * for its web client). Static app files fall through to the preview server.
 */
export async function mockJellyfin(page: Page, opts: { admin?: boolean } = {}): Promise<MockLog> {
	const log: MockLog = { requests: [], writes: [], reports: [] };
	let qcPolls = 0;
	const user = { ...F.user, Policy: { IsAdministrator: !!opts.admin, EnableContentDeletion: !!opts.admin, EnableContentDownloading: true } };
	const api = /\/(System|Users|UserViews|UserItems|Items|Shows|Audio|Videos|Sessions|Artists|Persons|Genres|Playlists|Branding|QuickConnect)(\/|\?|$)/i;

	await page.route((url) => api.test(url.pathname), async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		const p = url.pathname;
		const q = url.searchParams;
		log.requests.push(`${req.method()} ${p}`);
		let m: RegExpMatchArray | null;

		if (p === '/System/Info/Public') return json(route, { ServerName: 'Test Server', Version: '10.11.0', Id: 's1' });
		if (p === '/Users/Public') return json(route, [{ Id: 'u1', Name: 'Alex', HasPassword: true }]);
		if (p === '/Users/AuthenticateByName') {
			const body = req.postDataJSON() as { Username: string; Pw: string };
			if (body.Username !== 'Alex' || body.Pw !== PASSWORD) return json(route, { error: 'unauthorized' }, 401);
			return json(route, { AccessToken: 'tok', ServerId: 's1', User: user, SessionInfo: {} });
		}
		if (p === '/Users/Me') return json(route, user);
		// Quick Connect: the code is approved after the first poll, as if from another device.
		if (p === '/QuickConnect/Enabled') return json(route, true);
		if (p === '/QuickConnect/Initiate') return json(route, { Secret: 'qc-secret', Code: '481516', Authenticated: false, DeviceId: 'd' });
		if (p === '/QuickConnect/Connect') {
			if (q.get('secret') !== 'qc-secret') return json(route, {}, 404);
			qcPolls++;
			return json(route, { Secret: 'qc-secret', Code: '481516', Authenticated: qcPolls > 1 });
		}
		if (p === '/Users/AuthenticateWithQuickConnect') {
			const body = req.postDataJSON() as { Secret: string };
			if (body.Secret !== 'qc-secret' || qcPolls < 2) return json(route, {}, 401);
			return json(route, { AccessToken: 'tok', ServerId: 's1', User: user, SessionInfo: {} });
		}
		if (p === '/QuickConnect/Authorize') {
			log.writes.push({ method: 'POST', path: `${p}?code=${q.get('code')}`, body: null });
			return q.get('code') === '123456' ? json(route, true) : json(route, {}, 404);
		}
		if (p === '/Playlists' && req.method() === 'POST') {
			log.writes.push({ method: 'POST', path: p, body: req.postDataJSON() });
			return json(route, { Id: 'pl-new' });
		}
		if ((m = p.match(/^\/Playlists\/([^/]+)\/Items/))) {
			log.writes.push({ method: req.method(), path: `${p}?${q}`, body: null });
			return route.fulfill({ status: 204 });
		}
		if ((m = p.match(/^\/Items\/([^/]+)$/)) && req.method() !== 'GET') {
			log.writes.push({ method: req.method(), path: p, body: req.method() === 'POST' ? req.postDataJSON() : null });
			return route.fulfill({ status: 204 });
		}
		if ((m = p.match(/^\/Items\/([^/]+)\/Refresh$/))) {
			log.writes.push({ method: req.method(), path: p, body: null });
			return route.fulfill({ status: 204 });
		}
		if (p === '/UserViews') return json(route, page_(F.views));
		if (p === '/UserItems/Resume') return json(route, page_([F.movies[0]]));
		if (p === '/Shows/NextUp') return json(route, page_([F.episodes[1]]));
		if (p === '/Items/Latest') {
			const parent = q.get('parentId');
			return json(route, parent === 'v-movies' ? F.movies : parent === 'v-shows' ? [F.series] : parent === 'v-music' ? [F.album] : []);
		}
		if ((m = p.match(/^\/Items\/([^/]+)\/Images\//))) {
			return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: art(m[1]), headers: { 'access-control-allow-origin': '*' } });
		}
		if ((m = p.match(/^\/Items\/([^/]+)\/PlaybackInfo$/))) {
			const item = F.all[m[1]] as { MediaType?: string };
			return json(route, {
				PlaySessionId: `ps-${m[1]}`,
				MediaSources: [
					{
						...(item as { MediaSources?: { MediaStreams?: { Type: string; Index: number }[] }[] }).MediaSources?.[0],
						Id: 'ms1',
						Container: 'wav',
						SupportsDirectPlay: true,
						ETag: 'e',
						// Like the real server: text subtitles are offered as external WebVTT, with a URL relative to the server.
						MediaStreams: (item as { MediaSources?: { MediaStreams?: { Type: string; Index: number }[] }[] }).MediaSources?.[0]?.MediaStreams?.map((st) =>
							st.Type === 'Subtitle'
								? { ...st, DeliveryMethod: 'External', DeliveryUrl: `/Videos/${m![1]}/ms1/Subtitles/${st.Index}/0/Stream.vtt`, IsTextSubtitleStream: true, SupportsExternalStream: true }
								: st
						)
					}
				]
			});
		}
		if ((m = p.match(/^\/Videos\/([^/]+)\/([^/]+)\/Subtitles\/(\d+)\/\d+\/Stream\.(vtt|js)$/))) {
			// As on a real server: the browser's own <track> loader is refused cross-origin, so the client asks for the JSON form.
			log.requests.push(`subtitle ${m[3]}.${m[4]}`);
			const events = [0, 1, 2, 3].map((i) => ({ StartPositionTicks: i * 10 * 10_000_000, EndPositionTicks: (i * 10 + 1) * 10_000_000, Text: i === 1 ? '<i>Subtitle line 2 (italic in the file)</i>' : `Subtitle line ${i + 1}${m![3] === '4' ? ' (jpn)' : ''}` }));
			if (m[4] === 'js') return json(route, { TrackEvents: events });
			return route.fulfill({ status: 403, body: 'blocked like a cross-origin <track>' });
		}
		if ((m = p.match(/^\/Items\/([^/]+)\/Similar$/))) return json(route, page_(F.movies.slice(1, 4)));
		if ((m = p.match(/^\/Items\/([^/]+)$/))) {
			const item = F.all[m[1]];
			return item ? json(route, item) : json(route, {}, 404);
		}
		if (p === '/Items') {
			const parent = q.get('parentId');
			const term = q.get('searchTerm')?.toLowerCase();
			const types = q.get('includeItemTypes')?.split(',') ?? [];
			// Statistics asks for whole item kinds with their creation dates.
			if (!parent && !term && types.length === 1 && ['Movie', 'Episode', 'MusicAlbum'].includes(types[0])) {
				const list = types[0] === 'Movie' ? F.movies : types[0] === 'Episode' ? F.episodes : [F.album];
				return json(route, page_(list.map((i, k) => ({ ...i, DateCreated: new Date(Date.now() - k * 40 * 86_400_000).toISOString() }))));
			}
			if (types.includes('Playlist') && !parent) return json(route, page_([F.playlist]));
			if (parent === 'v-playlists') return json(route, page_([F.playlist]));
			if (parent === 'pl1') return json(route, page_(F.tracks));
			if (term) return json(route, page_(Object.values(F.all).filter((i) => types.includes((i as { Type: string }).Type) && (i as { Name: string }).Name.toLowerCase().includes(term))));
			if (parent === 'al1') return json(route, page_(F.tracks));
			if (parent === 'al2') return json(route, page_([F.longTrack]));
			if (parent === 'al3') return json(route, page_(F.duetTracks));
			if (parent === 'v-movies') {
				const start = q.get('nameStartsWith');
				const played = q.get('isPlayed');
				return json(
					route,
					page_(F.movies.filter((m) => (!start || m.Name.startsWith(start)) && (played == null || String(m.UserData.Played) === played)))
				);
			}
			if (parent === 'v-music' && types.includes('Audio')) return json(route, page_(F.tracks));
			if (parent === 'v-shows') return json(route, page_([F.series]));
			if (parent === 'v-music') return json(route, page_([F.album]));
			return json(route, page_([]));
		}
		if (p === '/Shows/sr1/Seasons') return json(route, page_(F.seasons));
		if (p === '/Shows/sr1/Episodes') return json(route, page_(F.episodes));
		if ((m = p.match(/^\/Audio\/([^/]+)\/Lyrics$/))) return json(route, m[1] === 't1' ? F.lyrics : F.plainLyrics);
		if (/^\/(Audio|Videos)\/[^/]+\/stream/.test(p)) {
			// Byte ranges, like the real server, so the browser can seek.
			const range = /bytes=(\d+)-(\d*)/.exec(req.headers()['range'] ?? '');
			const headers = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' };
			if (!range) return route.fulfill({ status: 200, contentType: 'audio/wav', body: WAV, headers });
			const start = +range[1];
			const end = range[2] ? Math.min(+range[2], WAV.length - 1) : WAV.length - 1;
			return route.fulfill({
				status: 206,
				contentType: 'audio/wav',
				body: WAV.subarray(start, end + 1),
				headers: { ...headers, 'content-range': `bytes ${start}-${end}/${WAV.length}` }
			});
		}
		if ((m = p.match(/^\/Sessions\/Playing(\/Progress|\/Stopped)?$/))) {
			log.reports.push({ kind: m[1] ? m[1].slice(1).toLowerCase() : 'start', body: req.postDataJSON() });
			return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
		}
		if (p.startsWith('/Sessions/Logout')) return route.fulfill({ status: 204 });
		if (p === '/Artists/AlbumArtists') return json(route, page_([{ Id: 'ar1', Name: 'Paramore', Type: 'MusicArtist', ImageTags: { Primary: 'p1' } }]));
		if (p === '/Persons') return json(route, page_([]));
		if (p === '/Genres') return json(route, page_([{ Id: 'g1', Name: 'Animation', Type: 'Genre' }, { Id: 'g2', Name: 'Drama', Type: 'Genre' }]));
		return json(route, { error: `unmocked ${p}` }, 404);
	});
	return log;
}

/** Sign in through the real login form. */
export async function signIn(page: Page): Promise<void> {
	await page.goto('/');
	await page.getByText('Test Server').waitFor();
	await page.getByRole('button', { name: 'Alex' }).click();
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.getByRole('heading', { name: /Recently added in Movies/ }).waitFor();
}

export { PASSWORD };
