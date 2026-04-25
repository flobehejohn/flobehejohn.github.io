import { spawnSync } from 'child_process';

process.env.STRICT_PREVIEW_BASE = '1';
process.env.PREVIEW_BASE_PATH = '/flobehejohn/flobehejohn.github.io/preview/refactor-live/';

const specs = [
  'tests/rawgithack-preview-contract.spec.ts',
  'tests/runtime-url.contract.spec.ts',
  'tests/magic-cloud-rawgithack-contract.spec.ts',
  'tests/dotnet-demo-rawgithack-contract.spec.ts',
  'tests/contact-privacy-contract.spec.ts',
  'tests/media-permissions-contract.spec.ts',
  'tests/musicam-rawgithack-contract.spec.ts',
  'tests/synth-rawgithack-contract.spec.ts'
];

const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(runner, ['playwright', 'test', ...specs], {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);
