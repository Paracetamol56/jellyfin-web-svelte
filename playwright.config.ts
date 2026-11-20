import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build (`vite preview`) with a mocked
// Jellyfin API on the same origin, so no server is needed.
// - PW_CHROME=/usr/bin/chromium   use a system browser instead of Playwright's
// - VISUAL=1                      also run screenshot comparisons (baselines in e2e/__screenshots__)
// - .env.test.local with JELLYFIN_URL / JELLYFIN_TEST_USER / JELLYFIN_TEST_PASSWORD enables e2e/live (read-only)
const executablePath = process.env.PW_CHROME || undefined;
const use = { ...devices['Desktop Chrome'], launchOptions: { executablePath, args: ['--autoplay-policy=no-user-gesture-required'] } };

export default defineConfig({
	testDir: 'e2e',
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
	expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure', colorScheme: 'dark' },
	webServer: {
		command: 'bun run build && bun run preview --port 4173 --strictPort',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	},
	projects: [
		{ name: 'chromium', testIgnore: [/visual\.spec/, /live\//], use },
		...(process.env.VISUAL ? [{ name: 'visual', testMatch: /visual\.spec/, use }] : []),
		{ name: 'live', testMatch: /live\/.*\.spec/, use: { ...use, baseURL: process.env.LIVE_APP_URL ?? 'http://localhost:4173' }, timeout: 240_000 }
	]
});
