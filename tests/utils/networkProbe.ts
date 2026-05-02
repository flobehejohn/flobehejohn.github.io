import type { Page, Response } from '@playwright/test';

export type NetworkProbe = {
  localAssetFailures: string[];
  externalFailures: string[];
  abortedLocalRequests: string[];
  responses: Array<{ url: string; status: number }>;
};

function isLocalUrl(url: string): boolean {
  return /(?:\/assets\/|\/css\/|\/js\/|\/fonts\/|\/portfolio\/|\/svg-icons\/)/.test(url);
}

function isLocalAsset(response: Response): boolean {
  return isLocalUrl(response.url());
}

async function hasHtmlMimeForScript(response: Response): Promise<boolean> {
  const request = response.request();
  const resourceType = request.resourceType();
  if (resourceType !== 'script') return false;
  const contentType = (response.headers()['content-type'] || '').toLowerCase();
  return contentType.includes('text/html');
}

export function attachNetworkProbe(page: Page): NetworkProbe {
  const probe: NetworkProbe = { localAssetFailures: [], externalFailures: [], abortedLocalRequests: [], responses: [] };

  page.on('response', async (response) => {
    const status = response.status();
    const url = response.url();
    probe.responses.push({ url, status });

    if (isLocalAsset(response) && await hasHtmlMimeForScript(response)) {
      probe.localAssetFailures.push(`MIME text/html for script ${url}`);
      return;
    }

    if (status < 400) return;

    if (isLocalAsset(response)) {
      probe.localAssetFailures.push(`${status} ${url}`);
      return;
    }

    if (/r2\.dev|cloudflare|google-analytics|googletagmanager|maps\.googleapis|google\.com\/maps/i.test(url)) {
      probe.externalFailures.push(`${status} ${url}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || 'request failed';

    if (isLocalUrl(url)) {
      if (/NS_BINDING_ABORTED/i.test(failure)) {
        probe.abortedLocalRequests.push(`${failure} ${url}`);
        return;
      }
      probe.localAssetFailures.push(`${failure} ${url}`);
      return;
    }

    if (/r2\.dev|cloudflare|google-analytics|googletagmanager|maps\.googleapis|google\.com\/maps/i.test(url)) {
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
