// @ts-nocheck -- plain browser script injected into the plugin iframe, not part of the app bundle
// Runs inside the sandboxed iframe that hosts a plugin configuration page.
// Recreates the parts of the stock web client that plugin pages rely on:
// ApiClient, Dashboard, LibraryMenu, a tiny jQuery-alike, emby-* control labels,
// and the pageshow/viewshow lifecycle (inline scripts and data-controller modules).
(function () {
	'use strict';
	var C = window.__JF;

	// The sandbox has an opaque origin, so real web storage throws. Plugins use it for small
	// UI preferences; an in-memory stand-in keeps them working for the life of the page.
	function memoryStorage() {
		var data = {};
		var api = {
			getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
			setItem: function (k, v) { data[k] = String(v); },
			removeItem: function (k) { delete data[k]; },
			clear: function () { data = {}; },
			key: function (i) { return Object.keys(data)[i] || null; }
		};
		Object.defineProperty(api, 'length', { get: function () { return Object.keys(data).length; } });
		return api;
	}
	['localStorage', 'sessionStorage'].forEach(function (name) {
		try {
			void window[name];
		} catch (e) {
			Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
		}
	});
	var base = C.server.replace(/\/+$/, '');

	// ── Messaging with the dashboard ─────────────────────────
	function post(msg, transfer) {
		msg.__jfPlugin = true;
		parent.postMessage(msg, '*', transfer || []);
	}
	var seq = 0;
	var pending = {};
	window.addEventListener('message', function (e) {
		if (e.source !== parent || !e.data) return;
		var d = e.data;
		if (d.__jfReply != null && pending[d.__jfReply]) {
			pending[d.__jfReply](d.value);
			delete pending[d.__jfReply];
		} else if (d.__jfTheme) {
			applyTheme(d.__jfTheme);
		}
	});
	function ask(msg, transfer) {
		return new Promise(function (resolve) {
			var id = ++seq;
			pending[id] = resolve;
			msg.id = id;
			post(msg, transfer);
		});
	}
	function applyTheme(t) {
		var root = document.documentElement;
		root.classList.toggle('dark', !!t.dark);
		Object.keys(t.vars).forEach(function (k) {
			root.style.setProperty(k, t.vars[k]);
		});
	}
	applyTheme(C.theme);

	// ── ApiClient ────────────────────────────────────────────
	function getUrl(name, params) {
		var url = /^https?:/i.test(name) ? name : base + '/' + String(name || '').replace(/^\/+/, '');
		if (params) {
			var q = new URLSearchParams();
			Object.keys(params).forEach(function (k) {
				if (params[k] !== undefined && params[k] !== null) q.append(k, params[k]);
			});
			var s = q.toString();
			if (s) url += (url.indexOf('?') === -1 ? '?' : '&') + s;
		}
		return url;
	}
	// The frame's origin is opaque, so direct calls to the server would depend on its CORS settings.
	// Requests to the server are made by the dashboard instead (same origin, authorised), and the answer is handed back.
	function proxied(url, method, headers, body) {
		var prep;
		if (body == null) prep = Promise.resolve({ buf: null });
		else if (typeof body === 'string') prep = Promise.resolve({ buf: new TextEncoder().encode(body).buffer });
		else {
			var rq = new Request(url, { method: 'POST', body: body });
			prep = rq.arrayBuffer().then(function (b) { return { buf: b, ct: rq.headers.get('content-type') }; });
		}
		return prep.then(function (p) {
			if (p.ct && !headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = p.ct;
			return ask({ type: 'fetch', url: url, method: method, headers: headers, body: p.buf }, p.buf ? [p.buf] : []);
		}).then(function (r) {
			if (!r || r.error) return Promise.reject(new TypeError('Failed to fetch'));
			var empty = r.status === 204 || r.status === 205 || r.status === 304;
			return new Response(empty ? null : r.body, { status: r.status, statusText: r.statusText, headers: r.headers });
		});
	}
	function request(req, includeAuthorization) {
		req = req || {};
		var headers = Object.assign({}, req.headers || {});
		if (includeAuthorization !== false) headers.Authorization = C.authorization;
		var body = req.data;
		if (req.contentType) headers['Content-Type'] = req.contentType;
		if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof URLSearchParams)) {
			if (/json/i.test(req.contentType || '')) body = JSON.stringify(body);
			else body = new URLSearchParams(body);
		}
		var method = String(req.type || req.method || 'GET').toUpperCase();
		var sameServer = req.url === base || req.url.indexOf(base + '/') === 0;
		var sent = sameServer ? proxied(req.url, method, headers, body) : fetch(req.url, { method: method, headers: headers, body: body });
		return sent.then(function (res) {
			if (!res.ok) return Promise.reject(res);
			var wantsJson = req.dataType === 'json' || /json/i.test(headers.accept || headers.Accept || '');
			if (wantsJson) return res.status === 204 ? null : res.text().then(function (t) { return t ? JSON.parse(t) : null; });
			if (req.dataType === 'text') return res.text();
			return res;
		});
	}
	function json(path, params) {
		return request({ url: getUrl(path, params), dataType: 'json' });
	}
	function send(method, path, data, params) {
		return request({ type: method, url: getUrl(path, params), data: data == null ? undefined : JSON.stringify(data), contentType: 'application/json' });
	}
	var api = {
		serverAddress: function () { return base; },
		serverVersion: function () { return C.version; },
		serverId: function () { return C.serverId; },
		accessToken: function () { return C.token; },
		getCurrentUserId: function () { return C.userId; },
		deviceId: function () { return C.deviceId; },
		deviceName: function () { return C.deviceName; },
		appName: function () { return C.appName; },
		appVersion: function () { return C.appVersion; },
		getUrl: getUrl,
		fetch: request,
		ajax: request,
		getJSON: function (url) { return request({ url: url, dataType: 'json' }); },
		getPluginConfiguration: function (id) { return json('Plugins/' + id + '/Configuration'); },
		updatePluginConfiguration: function (id, cfg) { return send('POST', 'Plugins/' + id + '/Configuration', cfg); },
		getInstalledPlugins: function () { return json('Plugins'); },
		getPackages: function () { return json('Packages'); },
		getUsers: function (q) { return json('Users', q); },
		getUser: function (id) { return json('Users/' + id); },
		getCurrentUser: function () { return json('Users/' + C.userId); },
		getVirtualFolders: function () { return json('Library/VirtualFolders'); },
		getUserViews: function (o, userId) { return json('UserViews', Object.assign({}, o || {}, { userId: userId || C.userId })); },
		getItems: function (userId, o) { return json('Items', Object.assign({}, o || {}, { userId: userId || C.userId })); },
		getItem: function (userId, id) { return json('Items/' + id, { userId: userId || C.userId }); },
		getSystemInfo: function () { return json('System/Info'); },
		getPublicSystemInfo: function () { return json('System/Info/Public'); },
		getServerConfiguration: function () { return json('System/Configuration'); },
		updateServerConfiguration: function (c) { return send('POST', 'System/Configuration', c); },
		getNamedConfiguration: function (n) { return json('System/Configuration/' + n); },
		updateNamedConfiguration: function (n, c) { return send('POST', 'System/Configuration/' + n, c); },
		getCultures: function () { return json('Localization/Cultures'); },
		getCountries: function () { return json('Localization/Countries'); },
		getParentalRatings: function () { return json('Localization/ParentalRatings'); },
		getScheduledTasks: function (o) { return json('ScheduledTasks', o); },
		getScheduledTask: function (id) { return json('ScheduledTasks/' + id); },
		startScheduledTask: function (id) { return send('POST', 'ScheduledTasks/Running/' + id); },
		stopScheduledTask: function (id) { return send('DELETE', 'ScheduledTasks/Running/' + id); },
		getDevices: function () { return json('Devices'); }
	};
	// Fallbacks some plugins expect; a plugin assigning its own version wins.
	api.savePluginConfiguration = api.updatePluginConfiguration;
	api.getLibraries = api.getVirtualFolders;
	window.ApiClient = api;
	window.ServerConnections = { currentApiClient: function () { return api; }, getApiClient: function () { return api; } };

	// ── Dashboard ────────────────────────────────────────────
	function setLoading(on) {
		document.documentElement.classList.toggle('jf-loading', on);
	}
	function errorText(r) {
		if (!r) return 'Something went wrong.';
		if (typeof r === 'string') return r;
		if (r.status) return 'The server returned an error (' + r.status + (r.statusText ? ' ' + r.statusText : '') + ').';
		return String(r.message || r);
	}
	window.Dashboard = {
		showLoadingMsg: function () { setLoading(true); },
		hideLoadingMsg: function () { setLoading(false); },
		alert: function (o) {
			var m = typeof o === 'string' ? { message: o } : o || {};
			post({ type: 'toast', message: [m.title, m.message || m.text].filter(Boolean).join(': ') });
			if (typeof m.callback === 'function') setTimeout(m.callback);
			return Promise.resolve();
		},
		confirm: function (message, title, callback) {
			return ask({ type: 'confirm', message: String(message || ''), title: title ? String(title) : '' }).then(function (ok) {
				if (typeof callback === 'function') callback(!!ok);
				return !!ok;
			});
		},
		processPluginConfigurationUpdateResult: function () {
			setLoading(false);
			post({ type: 'toast', message: 'Settings saved.' });
		},
		processServerConfigurationUpdateResult: function () {
			setLoading(false);
			post({ type: 'toast', message: 'Settings saved.' });
		},
		processErrorResponse: function (r) {
			setLoading(false);
			post({ type: 'toast', tone: 'error', message: errorText(r) });
		},
		navigate: function (url) {
			post({ type: 'navigate', url: String(url || '') });
			return Promise.resolve();
		},
		getConfigurationPageUrl: function (name) {
			return '#/configurationpage?name=' + encodeURIComponent(name);
		},
		DirectoryBrowser: function () {
			this.show = function (o) {
				o = o || {};
				ask({ type: 'directory', header: o.header || '', path: o.path || '' }).then(function (p) {
					if (p && typeof o.callback === 'function') o.callback(p);
				});
			};
			this.close = function () {};
		},
		capabilities: function () { return {}; }
	};

	// ── LibraryMenu (plugin tab bars) ────────────────────────
	window.LibraryMenu = {
		setTabs: function (_name, index, getTabs) {
			var tabs = typeof getTabs === 'function' ? getTabs() : [];
			var bar = document.getElementById('jf-tabs');
			if (!bar) return;
			bar.innerHTML = '';
			(tabs || []).forEach(function (t, i) {
				var a = document.createElement('a');
				a.href = t.href;
				a.textContent = t.name;
				if (i === index) a.setAttribute('aria-current', 'page');
				bar.appendChild(a);
			});
			bar.hidden = !tabs || !tabs.length;
		},
		setTitle: function () {}
	};

	// ── Links and forms stay inside the dashboard ───────────
	document.addEventListener('click', function (e) {
		var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		if (!a || e.defaultPrevented) return;
		var href = a.getAttribute('href') || '';
		if (/configurationpage\?name=/i.test(href) || href.charAt(0) === '#') {
			e.preventDefault();
			if (href !== '#') post({ type: 'navigate', url: href });
		} else if (/^https?:/i.test(href) && href.indexOf(base) !== 0) {
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
		} else if (!/^(javascript:|blob:|data:)/i.test(href) && !a.hasAttribute('download')) {
			e.preventDefault();
		}
	});
	// Plugins cancel their own submits; this only stops an unhandled one from unloading the page.
	window.addEventListener('submit', function (e) { e.preventDefault(); });

	// ── Minimal jQuery-alike (a few plugins still use $) ─────
	var proto = {};
	function wrap(els) {
		var w = Object.create(proto);
		w.els = els;
		w.length = els.length;
		for (var i = 0; i < els.length; i++) w[i] = els[i];
		return w;
	}
	function $(sel, ctx) {
		if (typeof sel === 'function') {
			if (document.readyState !== 'loading') sel($);
			else document.addEventListener('DOMContentLoaded', function () { sel($); });
			return;
		}
		if (!sel) return wrap([]);
		if (sel.els) return sel;
		if (typeof sel === 'string') {
			if (/^\s*</.test(sel)) {
				var t = document.createElement('template');
				t.innerHTML = sel.trim();
				return wrap(Array.prototype.slice.call(t.content.childNodes));
			}
			var root = ctx ? (ctx.els ? ctx.els[0] : ctx) : document;
			return wrap(Array.prototype.slice.call(root.querySelectorAll(sel)));
		}
		if (sel.length !== undefined && typeof sel !== 'string' && sel !== window) return wrap(Array.prototype.slice.call(sel));
		return wrap([sel]);
	}
	function eachEl(w, fn) {
		w.els.forEach(fn);
		return w;
	}
	proto.each = function (fn) { return eachEl(this, function (e, i) { fn.call(e, i, e); }); };
	proto.on = function (types, a, b) {
		var delegate = typeof a === 'string' ? a : null;
		var handler = delegate ? b : a;
		var self = this;
		String(types).split(/\s+/).forEach(function (full) {
			var ev = full.split('.')[0];
			self.els.forEach(function (el) {
				var h = function (e) {
					var target = el;
					if (delegate) {
						target = e.target && e.target.closest ? e.target.closest(delegate) : null;
						if (!target || !el.contains(target)) return;
					}
					if (handler.call(target, e, e.detail) === false) {
						e.preventDefault();
						e.stopPropagation();
					}
				};
				(el.__jq = el.__jq || []).push({ full: full, ev: ev, h: h });
				el.addEventListener(ev, h);
			});
		});
		return this;
	};
	proto.off = function (types) {
		var wanted = types ? String(types).split(/\s+/) : null;
		return eachEl(this, function (el) {
			el.__jq = (el.__jq || []).filter(function (r) {
				var hit = !wanted || wanted.some(function (w) { return w === r.full || w === r.ev || (w.charAt(0) === '.' && r.full.slice(r.ev.length) === w); });
				if (hit) el.removeEventListener(r.ev, r.h);
				return !hit;
			});
		});
	};
	proto.trigger = function (type) {
		return eachEl(this, function (el) {
			if (type === 'click' && el.click) el.click();
			else el.dispatchEvent(new CustomEvent(String(type).split('.')[0], { bubbles: true }));
		});
	};
	['click', 'change', 'submit', 'input'].forEach(function (n) {
		proto[n] = function (fn) { return fn ? this.on(n, fn) : this.trigger(n); };
	});
	proto.find = function (s) { return wrap(this.els.reduce(function (acc, e) { return acc.concat(Array.prototype.slice.call(e.querySelectorAll(s))); }, [])); };
	proto.closest = function (s) { return wrap(this.els.map(function (e) { return e.closest(s); }).filter(Boolean)); };
	proto.parent = function () { return wrap(this.els.map(function (e) { return e.parentElement; }).filter(Boolean)); };
	proto.first = function () { return wrap(this.els.slice(0, 1)); };
	proto.eq = function (i) { return wrap(this.els.slice(i, i + 1)); };
	proto.get = function (i) { return i === undefined ? this.els.slice() : this.els[i]; };
	proto.val = function (v) { if (v === undefined) return this.els[0] ? this.els[0].value : undefined; return eachEl(this, function (e) { e.value = v; }); };
	proto.prop = function (n, v) { if (v === undefined) return this.els[0] ? this.els[0][n] : undefined; return eachEl(this, function (e) { e[n] = v; }); };
	proto.attr = function (n, v) { if (v === undefined) return this.els[0] ? this.els[0].getAttribute(n) : undefined; return eachEl(this, function (e) { e.setAttribute(n, v); }); };
	proto.removeAttr = function (n) { return eachEl(this, function (e) { e.removeAttribute(n); }); };
	proto.data = function (n) { return this.els[0] ? this.els[0].dataset[n] : undefined; };
	proto.html = function (v) { if (v === undefined) return this.els[0] ? this.els[0].innerHTML : ''; return eachEl(this, function (e) { e.innerHTML = v; }); };
	proto.text = function (v) { if (v === undefined) return this.els[0] ? this.els[0].textContent : ''; return eachEl(this, function (e) { e.textContent = v; }); };
	proto.append = function (c) { return eachEl(this, function (e) { if (typeof c === 'string') e.insertAdjacentHTML('beforeend', c); else $(c).els.forEach(function (n) { e.appendChild(n); }); }); };
	proto.empty = function () { return this.html(''); };
	proto.remove = function () { return eachEl(this, function (e) { e.remove(); }); };
	proto.show = function () { return eachEl(this, function (e) { e.style.display = ''; e.classList.remove('hide'); }); };
	proto.hide = function () { return eachEl(this, function (e) { e.style.display = 'none'; }); };
	proto.css = function (n, v) { if (v === undefined && typeof n === 'string') return this.els[0] ? getComputedStyle(this.els[0])[n] : undefined; return eachEl(this, function (e) { if (typeof n === 'object') Object.assign(e.style, n); else e.style[n] = v; }); };
	proto.addClass = function (c) { return eachEl(this, function (e) { e.classList.add.apply(e.classList, String(c).split(/\s+/).filter(Boolean)); }); };
	proto.removeClass = function (c) { return eachEl(this, function (e) { e.classList.remove.apply(e.classList, String(c).split(/\s+/).filter(Boolean)); }); };
	proto.toggleClass = function (c, on) { return eachEl(this, function (e) { e.classList.toggle(c, on); }); };
	proto.hasClass = function (c) { return this.els.some(function (e) { return e.classList.contains(c); }); };
	$.ajax = function (o) { return request({ url: o.url, type: o.type || o.method, data: o.data, contentType: o.contentType, dataType: o.dataType, headers: o.headers }); };
	$.getJSON = function (url) { return request({ url: url, dataType: 'json' }); };
	window.$ = window.jQuery = $;

	// emby-* controls render their label from a `label` attribute.
	function polyfillLabels(root) {
		root.querySelectorAll('[is^="emby-"][label]').forEach(function (el) {
			if (el.__jfLabelled) return;
			el.__jfLabelled = true;
			if (!el.id) el.id = 'jf-' + Math.random().toString(36).slice(2);
			if (root.querySelector('label[for="' + el.id + '"]')) return;
			var l = document.createElement('label');
			l.className = el.tagName === 'SELECT' ? 'selectLabel' : 'inputLabel';
			l.htmlFor = el.id;
			l.textContent = el.getAttribute('label');
			el.parentNode.insertBefore(l, el);
		});
	}

	// ── Lifecycle ────────────────────────────────────────────
	window.__JF_BOOT = function () {
		polyfillLabels(document);
		new MutationObserver(function () { polyfillLabels(document); }).observe(document.body, { childList: true, subtree: true });
		var page = document.querySelector('[data-role="page"]') || document.querySelector('.jf-host > *') || document.body;
		var params = Object.fromEntries(new URLSearchParams(C.query));
		function fire(name) {
			page.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { params: params, isRestored: false } }));
		}
		fire('pageinit');
		fire('pagebeforeshow');
		fire('viewbeforeshow');
		var ctrl = page.getAttribute('data-controller') || '';
		var ready = Promise.resolve();
		if (ctrl.indexOf('__plugin/') === 0) {
			// Newer pages: an ES module whose default export receives the page element.
			ready = request({ url: getUrl('web/ConfigurationPage', { name: ctrl.slice(9) }) })
				.then(function (r) { return r.text(); })
				.then(function (src) {
					return import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
				})
				.then(function (mod) {
					var F = mod && mod.default;
					if (typeof F === 'function') {
						try {
							new F(page, params);
						} catch (err) {
							F(page, params);
						}
					}
				})
				.catch(function (err) {
					post({ type: 'toast', tone: 'error', message: 'This plugin page failed to start: ' + (err && err.message ? err.message : err) });
				});
		}
		ready.then(function () {
			fire('pageshow');
			fire('viewshow');
			var report = function () { post({ type: 'height', value: Math.ceil(document.documentElement.scrollHeight) }); };
			new ResizeObserver(report).observe(document.body);
			report();
			post({ type: 'ready' });
		});
	};
	window.addEventListener('error', function (e) {
		post({ type: 'log', message: String(e.message || e) });
	});
})();
