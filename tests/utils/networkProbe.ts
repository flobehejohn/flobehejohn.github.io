import type { Page, Response } from '@playwright/test';

export type NetworkProbe = {
  localAssetFailures: string[];
  externalFailures: string[];
  responses: Array<{ url: string; status: number }>;
};

function isLocalAsset(response: Response): boolean {
  const url = response.url();
  return /\/assets\//.test(url) || /\/svg-icons\//.test(url) || /\/css\//.test(url) || /\/js\//.test(url);
}

export function attachNetworkProbe(page: Page): NetworkProbe {
  const probe: NetworkProbe = { localAssetFailures: [], externalFailures: [], responses: [] };

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    probe.responses.push({ url, status });
    if (status < 400) return;

    if (isLocalAsset(response)) {
      probe.localAssetFailures.push(`${status} ${url}`);
      return;
    }

    if (/r2\.dev|cloudflare|google-analytics|googletagmanager/i.test(url)) {
      probe.externalFailures.push(`${status} ${url}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || 'request failed';
    if (/\/assets\//.test(url) || /\/svg-icons\//.test(url)) {
      probe.localAssetFailures.push(`${failure} ${url}`);
      return;
    }
    if (/r2\.dev|cloudflare|google-analytics|googletagmanager/i.test(url)) {
      probe.externalFailures.push(`${failure} ${url}`);
    }
  });

  return probe;
}

export function assertNoLocalAssetFailures(probe: NetworkProbe): void {
  if (probe.localAssetFailures.length > 0) {
    throw new Error(`Local asset failures:\n${probe.localAssetFailures.join('\n')}`);
  }
}
