
import fs from 'node:fs';
import path from 'node:path';
import config from './architecture-owners.config.mjs';

const root = process.cwd();
const failures = [];

function readFile(file) {
  const absolute = path.join(root, file);

  if (!fs.existsSync(absolute)) {
    failures.push({
      code: 'missing-file',
      file,
      message: 'file does not exist',
    });

    return '';
  }

  return fs.readFileSync(absolute, 'utf8');
}

function pushFailure(code, file, message) {
  failures.push({ code, file, message });
}

for (const rule of config) {
  for (const file of rule.files || []) {
    const src = readFile(file);

    if (!src) continue;

    for (const marker of rule.requiredMarkers || []) {
      if (!src.includes(marker)) {
        pushFailure(
          'missing-required-marker',
          file,
          `${rule.id}: missing required marker: ${marker}`
        );
      }
    }

    for (const marker of rule.forbiddenMarkers || []) {
      if (src.includes(marker)) {
        pushFailure(
          'forbidden-legacy-marker',
          file,
          `${rule.id}: forbidden legacy marker found: ${marker}`
        );
      }
    }
  }
}

const runtime = readFile('assets/js/floating-audio-toggle.js');
const docsRuntime = readFile('docs/assets/js/floating-audio-toggle.js');
const test = readFile('tests/audio-modal-toggle-contract.spec.ts');

if (runtime && docsRuntime && runtime !== docsRuntime) {
  pushFailure(
    'runtime-docs-drift',
    'docs/assets/js/floating-audio-toggle.js',
    'docs runtime must be byte-identical to assets runtime after build/resync'
  );
}

if (runtime) {
  const requiredRuntimeTokens = [
    'window.__PR6_AUDIO_MODAL_TOGGLE__',
    'layout()',
    'rangeCount',
    'rowCount',
    'legacyReadableCount',
    'siteSoundDesignVolume',
    'pr6AudioCanonicalRows',
  ];

  for (const token of requiredRuntimeTokens) {
    if (!runtime.includes(token)) {
      pushFailure(
        'missing-runtime-contract-token',
        'assets/js/floating-audio-toggle.js',
        `missing runtime contract token: ${token}`
      );
    }
  }

  const canonicalStackCount = (runtime.match(/pr6AudioCanonicalRows/g) || []).length;

  if (canonicalStackCount < 2) {
    pushFailure(
      'weak-canonical-stack-contract',
      'assets/js/floating-audio-toggle.js',
      'pr6AudioCanonicalRows must be present in DOM construction and layout measurement'
    );
  }
}

if (test) {
  const requiredTestTokens = [
    'audio modal button toggles open then closed then open again',
    'rangeCount',
    'rowCount',
    'legacyReadableCount',
    'overflowCount',
    'V15_CANONICAL_COMPACT',
  ];

  for (const token of requiredTestTokens) {
    if (!test.includes(token)) {
      pushFailure(
        'missing-test-contract-token',
        'tests/audio-modal-toggle-contract.spec.ts',
        `missing test contract token: ${token}`
      );
    }
  }
}

if (failures.length) {
  const details = failures
    .map((failure) => `- [${failure.code}] ${failure.file}: ${failure.message}`)
    .join('\n');

  throw new Error(`Architecture owner audit failed:\n${details}`);
}

console.log('[architecture-owners] OK');
