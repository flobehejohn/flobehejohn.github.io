const port = Number(process.env.PORT || process.env.DOCS_PORT || 4173);
const defaultPreviewBasePath = '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
const rawPreviewBasePath = process.env.PREVIEW_BASE_PATH || defaultPreviewBasePath;
const previewBasePath = `/${rawPreviewBasePath.replace(/^\/+/, '').replace(/\/?$/, '/')}`;
const baseURL = `http://127.0.0.1:${port}${previewBasePath}`;

export default {
  testDir: '.',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'node scripts/serve-docs.mjs',
    url: `${baseURL}index.html`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      STRICT_PREVIEW_BASE: '1',
      PREVIEW_BASE_PATH: previewBasePath,
      PORT: String(port),
    },
  },
};
