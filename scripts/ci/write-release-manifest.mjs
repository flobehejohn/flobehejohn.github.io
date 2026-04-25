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
  ? readdirSync(latest).filter((file) => file.endsWith('.json') && file !== 'release-manifest.json').sort()
  : [];

const requiredProofs = [
  ['audio-online', /^audio-summary\.json$/],
  ['audio-r2-fallback', /^audio-r2-fallback-summary\.json$/],
  ['pjax', /^pjax-.*-summary\.json$/],
  ['magic-cloud', /^magic-cloud-summary\.json$/],
  ['musicam', /^musicam-runtime-summary\.json$/],
  ['synthesizer', /^synth-runtime-summary\.json$/],
  ['site-matrix', /^site-matrix-.*\.json$/],
  ['security', /^security-.*-summary\.json$/],
  ['visual', /^visual-summary\.json$/]
];

const missingProofs = requiredProofs
  .filter(([, pattern]) => !summaryFiles.some((file) => pattern.test(file)))
  .map(([name]) => name);

const summaries = Object.fromEntries(summaryFiles.map((file) => [file, readJsonIfExists(join(latest, file))]));
const serializedSummaries = JSON.stringify(summaries);

function collectArrayCount(key) {
  let count = 0;
  for (const summary of Object.values(summaries)) {
    if (!summary || typeof summary !== 'object') continue;
    count += countArraysByKey(summary, key);
  }
  return count;
}

function countArraysByKey(value, key) {
  if (Array.isArray(value)) return 0;
  if (!value || typeof value !== 'object') return 0;

  let count = 0;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && Array.isArray(entryValue)) count += entryValue.length;
    if (entryValue && typeof entryValue === 'object') count += countArraysByKey(entryValue, key);
  }
  return count;
}

const counters = {
  summaryFiles: summaryFiles.length,
  fatalErrorsCount: collectArrayCount('fatalErrors'),
  localAssetFailuresCount: collectArrayCount('localAssetFailures'),
  piiLeaksCount: collectArrayCount('piiLeaks'),
  googleAnalyticsRequestsCount: collectArrayCount('googleAnalyticsRequests'),
  missingProofsCount: missingProofs.length
};

const failureReasons = [];
if (missingProofs.length > 0) failureReasons.push(`missing proofs: ${missingProofs.join(', ')}`);
if (counters.fatalErrorsCount > 0) failureReasons.push(`fatalErrorsCount=${counters.fatalErrorsCount}`);
if (counters.localAssetFailuresCount > 0) failureReasons.push(`localAssetFailuresCount=${counters.localAssetFailuresCount}`);
if (counters.piiLeaksCount > 0) failureReasons.push(`piiLeaksCount=${counters.piiLeaksCount}`);
if (/"verdict"\s*:\s*"failed/i.test(serializedSummaries)) failureReasons.push('failed verdict detected in summaries');

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
  requiredProofs: requiredProofs.map(([name, pattern]) => ({
    name,
    pattern: pattern.source,
    present: !missingProofs.includes(name)
  })),
  missingProofs,
  summaries,
  counters,
  verdict: failureReasons.length === 0 ? 'certified' : 'failed',
  failureReasons
};

writeFileSync(join(latest, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

if (failureReasons.length > 0) {
  console.error('[release-manifest] FAIL');
  for (const reason of failureReasons) console.error(` - ${reason}`);
  process.exit(1);
}

console.log('[release-manifest] OK');
console.log(`[release-manifest] summaryFiles=${summaryFiles.length}`);
console.log('[release-manifest] verdict=certified');
