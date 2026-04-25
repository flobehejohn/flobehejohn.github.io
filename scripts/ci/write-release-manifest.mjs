import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const latest = join(root, 'audit', '_latest');
mkdirSync(latest, { recursive: true });

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

const summaryFiles = existsSync(latest)
  ? readdirSync(latest).filter((file) => file.endsWith('.json')).sort()
  : [];

const summaries = Object.fromEntries(summaryFiles.map((file) => [file, readJsonIfExists(join(latest, file))]));
const fatalErrorsCount = JSON.stringify(summaries).match(/fatalErrors/g)?.length || 0;
const localAssetFailuresCount = JSON.stringify(summaries).match(/localAssetFailures/g)?.length || 0;

const manifest = {
  timestamp: new Date().toISOString(),
  branch: process.env.GITHUB_REF_NAME || 'local',
  commit: process.env.GITHUB_SHA || 'local',
  ci: {
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local'
  },
  preview: {
    branch: 'preview/refactor-live',
    url: 'https://raw.githack.com/flobehejohn/flobehejohn.github.io/preview/refactor-live/index.html'
  },
  summaries,
  counters: {
    summaryFiles: summaryFiles.length,
    fatalErrorsCount,
    localAssetFailuresCount
  },
  verdict: 'generated'
};

writeFileSync(join(latest, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log('[release-manifest] OK');
console.log(`[release-manifest] summaryFiles=${summaryFiles.length}`);
