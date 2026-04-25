import type { Page } from '@playwright/test';

export type ConsoleProbe = {
  fatalErrors: string[];
  warnings: string[];
};

const fatalPatterns = [
  /ReferenceError/i,
  /TypeError/i,
  /jQuery is not defined/i,
  /NotSupportedError/i,
  /Failed to fetch dynamically imported module/i
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

export function assertNoFatalConsole(probe: ConsoleProbe): void {
  if (probe.fatalErrors.length > 0) {
    throw new Error(`Fatal console errors:\n${probe.fatalErrors.join('\n')}`);
  }
}
