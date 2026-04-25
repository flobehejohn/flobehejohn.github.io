import type { Page } from '@playwright/test';

export type AnalyticsState = {
  googleAnalyticsRequests: string[];
  piiLeaks: string[];
  localSignals: string[];
};

const piiPatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}\b/,
  /fingerprint/i,
  /userId/i
];

export function attachAnalyticsProbe(page: Page): AnalyticsState {
  const state: AnalyticsState = { googleAnalyticsRequests: [], piiLeaks: [], localSignals: [] };

  page.on('request', (request) => {
    const url = request.url();
    if (/google-analytics|googletagmanager|\/collect\?/i.test(url)) state.googleAnalyticsRequests.push(url);
    if (piiPatterns.some((pattern) => pattern.test(url))) state.piiLeaks.push(url);
  });

  return state;
}

export async function installLocalSignalProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globals = window as unknown as Record<string, unknown>;
    globals.__ANALYTICS_AUDIT__ = { events: [] as Array<{ name: string; payload: unknown }> };
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = function patchedDispatch(event: Event) {
      if (event.type.startsWith('usage:') || event.type.includes('analytics') || event.type.includes('ga4')) {
        const audit = globals.__ANALYTICS_AUDIT__ as { events: Array<{ name: string; payload: unknown }> };
        audit.events.push({ name: event.type, payload: 'detail' in event ? (event as CustomEvent).detail : null });
      }
      return originalDispatch(event);
    };
  });
}

export async function getLocalSignals(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const globals = window as unknown as { __ANALYTICS_AUDIT__?: { events?: Array<{ name: string }> } };
    return globals.__ANALYTICS_AUDIT__?.events?.map((event) => event.name) || [];
  });
}

export function assertNoAnalyticsLeak(state: AnalyticsState): void {
  if (state.piiLeaks.length > 0) throw new Error(`PII leaks detected:\n${state.piiLeaks.join('\n')}`);
}
