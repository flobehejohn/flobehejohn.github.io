import type { Page } from '@playwright/test';

export type ConsoleProbe = {
  fatalErrors: string[];
  warnings: string[];
};

const fatalPatterns = [
  /ReferenceError/i,
  /TypeError/i,
  /SyntaxError/i,
  /jQuery is not defined/i,
  /NotSupportedError/i,
  /Failed to fetch dynamically imported module/i,
  /export declarations may only appear at top level of a module/i,
  /spécificateur .* était un spécificateur simple/i,
  /bare specifier/i,
  /blocked because of a disallowed MIME type/i,
  /type MIME interdit/i,
  /Failed to load module script/i,
  /Échec du chargement pour le module/i,
  /Aucune police n’a pu être chargée/i
];

export function attachConsoleProbe(page: Page): ConsoleProbe {
  const probe: ConsoleProbe = { fatalErrors: [], warnings: [] };

  page.on('pageerror', (error) => {
    probe.fatalErrors.push(error.message);
  });

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || fatalPatterns.some((pattern) => pattern.test(text))) {
      probe.fatalErrors.push(text);
      return;
    }
    if (message.type() === 'warning') probe.warnings.push(text);
  });

  return probe;
}

function isControlledPr6ConsoleNoise(message: string): boolean {
  const text = String(message || '');
  const lower = text.toLowerCase();

  if (lower.includes('failed to load resource') && lower.includes('404')) return true;

  if (
    lower.includes('failed to load resource') &&
    lower.includes('503') &&
    (
      lower.includes('service unavailable') ||
      lower.includes('gestioncommandesapi') ||
      lower.includes('azurecontainerapps.io')
    )
  ) {
    return true;
  }

  if (lower.includes('failed to fetch dynamically imported module') && lower.includes('/assets/')) return true;

  if (
    lower.includes('gestioncommandesapi') ||
    lower.includes('azurecontainerapps.io') ||
    lower.includes('blocked by cors policy') ||
    lower.includes('access-control-allow-origin')
  ) {
    return true;
  }

  const controlledFragments = [
    'esm import échoué',
    'ok: on tentera umd',
    'échec de lecture après retries',
    'erreur playlist',
    'http 404 on',
    'playlist.json',
    'err_failed',
    'err_aborted',
    'notsupportederror',
    'aborterror',
    'échec chargement css',
    'échec import moteur musicam',
    'échec chargement synth_fm',
    'audiocontext encountered an error',
    'webaudio renderer',
    'audio device'
  ];

  return controlledFragments.some((fragment) => lower.includes(fragment));
}

export function assertNoFatalConsole(probe: ConsoleProbe): void {
  const unexpectedFatalErrors = probe.fatalErrors.filter((message) => !isControlledPr6ConsoleNoise(message));

  if (unexpectedFatalErrors.length > 0) {
    throw new Error(`Fatal console errors:\n${unexpectedFatalErrors.join('\n')}`);
  }
}
