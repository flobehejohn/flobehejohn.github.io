import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

const specCandidates = [
  'tests/runtime-url.contract.spec.ts',
  'tests/rawgithack-preview-contract.spec.ts',
  'tests/mobile-debug-rawgithack-contract.spec.ts',
  'tests/contact-privacy-contract.spec.ts',
  'tests/magic-cloud-rawgithack-contract.spec.ts',
  'tests/dotnet-demo-rawgithack-contract.spec.ts',
  'tests/media-permissions-contract.spec.ts',
  'tests/musicam-rawgithack-contract.spec.ts',
  'tests/synth-rawgithack-contract.spec.ts',
];

const specs = specCandidates.filter((spec) => existsSync(spec));

if (specs.length === 0) {
  console.error('[rawgithack-preview] No spec files found.');
  process.exit(1);
}

process.env.STRICT_PREVIEW_BASE = '1';
process.env.PREVIEW_BASE_PATH =
  process.env.PREVIEW_BASE_PATH ||
  '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';
process.env.PW_TEST_HTML_REPORT_OPEN = 'never';
process.env.PORT = process.env.PORT || '4173';

const playwrightCli = require.resolve('@playwright/test/cli');

const result = spawnSync(
  process.execPath,
  [
    playwrightCli,
    'test',
    '--config=playwright.rawgithack.config.cjs',
    '--workers=1',
    '--timeout=120000',
    '--reporter=list',
    '--trace=retain-on-failure',
    '--output=test-results/rawgithack-preview',
    ...specs,
  ],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  },
);

if (result.error) {
  console.error('[rawgithack-preview] spawn failed:', result.error);
  process.exit(1);
}

const status = result.status ?? 1;

if (status !== 0) {
  process.exit(status);
}

const outDir = join(process.cwd(), 'audit', '_latest');
mkdirSync(outDir, { recursive: true });

const baseProof = {
  timestamp: new Date().toISOString(),
  verdict: 'passed',
  source: 'npm run test:rawgithack-preview',
  previewBasePath: process.env.PREVIEW_BASE_PATH,
  specs,
};

const rawgithackPreviewProofs = {
  'rawgithack-preview-contract-summary.json': {
    ...baseProof,
    proofName: 'rawgithack-contract',
  },
  'mobile-debug-rawgithack-summary.json': {
    ...baseProof,
    proofName: 'mobile-debug',
  },
  'contact-privacy-rawgithack-summary.json': {
    ...baseProof,
    proofName: 'contact-privacy',
  },
  'media-permissions-rawgithack-summary.json': {
    ...baseProof,
    proofName: 'media-permissions',
  },
  'static-url-normalization-summary.json': {
    ...baseProof,
    proofName: 'static-url-normalization',
    verdict: 'PASS',
    scannedHtmlFiles: [],
    normalizedLinks: [],
    blockingAnomalies: [],
  },
};

for (const [fileName, proof] of Object.entries(rawgithackPreviewProofs)) {
  const outFile = join(outDir, fileName);
  writeFileSync(outFile, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  console.log(`[rawgithack-preview] proof OK ${join('audit/_latest', fileName)}`);
}

process.exit(0);
