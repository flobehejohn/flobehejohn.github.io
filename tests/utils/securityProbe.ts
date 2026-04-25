import type { Page } from '@playwright/test';

export type SecurityState = {
  mixedContentLinks: string[];
  unsafeBlankLinks: string[];
  suspectedSecrets: string[];
  externalScripts: string[];
};

const secretPatterns = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[0-9A-Za-z]{20,}/,
  /sk-[0-9A-Za-z]{20,}/
];

export async function getSecurityState(page: Page): Promise<SecurityState> {
  return page.evaluate((patterns) => {
    const secretRegexes = patterns.map((source) => new RegExp(source));
    const html = document.documentElement.innerHTML;
    const suspectedSecrets = secretRegexes.filter((regex) => regex.test(html)).map((regex) => regex.source);

    const mixedContentLinks = Array.from(document.querySelectorAll('[src], [href]'))
      .map((element) => (element.getAttribute('src') || element.getAttribute('href') || '').trim())
      .filter((value) => value.startsWith('http://'));

    const unsafeBlankLinks = Array.from(document.querySelectorAll('a[target="_blank"]'))
      .filter((anchor) => !/(^|\s)noopener(\s|$)/i.test(anchor.getAttribute('rel') || ''))
      .map((anchor) => anchor.getAttribute('href') || '');

    const externalScripts = Array.from(document.querySelectorAll('script[src]'))
      .map((script) => script.getAttribute('src') || '')
      .filter((src) => /^https?:\/\//.test(src));

    return { mixedContentLinks, unsafeBlankLinks, suspectedSecrets, externalScripts };
  }, secretPatterns.map((pattern) => pattern.source));
}

export function assertSecurityBaseline(state: SecurityState): void {
  if (state.mixedContentLinks.length > 0) throw new Error(`Mixed content links:\n${state.mixedContentLinks.join('\n')}`);
  if (state.unsafeBlankLinks.length > 0) throw new Error(`Unsafe target=_blank links:\n${state.unsafeBlankLinks.join('\n')}`);
  if (state.suspectedSecrets.length > 0) throw new Error(`Suspected secrets detected:\n${state.suspectedSecrets.join('\n')}`);
}
