import * as pw from '@playwright/test';

type PlaywrightRuntime = typeof import('@playwright/test');
const playwrightRuntime = ((pw as unknown as { default?: PlaywrightRuntime }).default ?? pw) as PlaywrightRuntime;
const { test, expect } = playwrightRuntime;

test.setTimeout(120_000);

type UsageSignal = {
  ts: string;
  type: string;
  path: string;
  title: string;
  details?: Record<string, unknown>;
};

test('usage signals stay local, bounded and PJAX-aware without GA4 certification', async ({ page }) => {
  const externalAnalyticsCalls: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (/google-analytics|googletagmanager|\/g\/collect|\/collect/i.test(url)) {
      externalAnalyticsCalls.push(url);
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean((window as unknown as { SiteUsageSignals?: unknown }).SiteUsageSignals), null, {
    timeout: 30_000,
  });

  const initial = await page.evaluate(() => {
    const api = (window as unknown as {
      SiteUsageSignals: {
        clear: () => void;
        pageView: (reason: string) => void;
        push: (type: string, details?: Record<string, unknown>) => void;
        readQueue: () => UsageSignal[];
      };
    }).SiteUsageSignals;

    api.clear();
    api.pageView('contract-start');
    api.push('portfolio_contract_event', { component: 'usage-signals-runtime', value: 1 });

    return api.readQueue();
  });

  expect(initial.map((entry) => entry.type)).toEqual(['page_view', 'portfolio_contract_event']);
  expect(initial.every((entry) => entry.path === '/')).toBe(true);

  await page.evaluate(() => {
    const maybePjax = (window as unknown as { PJAX?: { navigate?: (url: string, push?: boolean) => Promise<void> } }).PJAX;
    if (!maybePjax?.navigate) throw new Error('PJAX.navigate unavailable');
    return maybePjax.navigate('/portfolio_florian_b.html', true);
  });

  await page.waitForURL((url) => url.pathname.endsWith('/portfolio_florian_b.html'), { timeout: 30_000 });
  await page.waitForTimeout(1_500);

  const afterPjax = await page.evaluate(() => {
    const api = (window as unknown as {
      SiteUsageSignals: {
        push: (type: string, details?: Record<string, unknown>) => void;
        readQueue: () => UsageSignal[];
      };
    }).SiteUsageSignals;

    api.push('after_pjax_contract_event', { component: 'usage-signals-runtime', value: 2 });
    return api.readQueue();
  });

  expect(afterPjax.some((entry) => entry.type === 'page_view' && entry.details?.reason === 'pjax:ready')).toBe(true);
  expect(afterPjax.some((entry) => entry.type === 'after_pjax_contract_event' && entry.path.endsWith('/portfolio_florian_b.html'))).toBe(true);

  const bounded = await page.evaluate(() => {
    const api = (window as unknown as {
      SiteUsageSignals: {
        push: (type: string, details?: Record<string, unknown>) => void;
        readQueue: () => UsageSignal[];
      };
    }).SiteUsageSignals;

    for (let index = 0; index < 220; index += 1) {
      api.push('bounded_contract_event', { index });
    }

    return api.readQueue();
  });

  expect(bounded.length).toBeLessThanOrEqual(200);
  expect(externalAnalyticsCalls, `Unexpected external analytics calls:\n${externalAnalyticsCalls.join('\n')}`).toEqual([]);
});
