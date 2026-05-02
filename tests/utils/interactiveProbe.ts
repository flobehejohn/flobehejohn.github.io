import type { Page } from '@playwright/test';

export type InteractiveModuleState = {
  name: string;
  url: string;
  found: boolean;
  visibleElements: number;
  canvasCount: number;
  audioContextMentioned: boolean;
  fatalErrorsCount: number;
};

export async function probeInteractiveModule(page: Page, name: string, url: string): Promise<InteractiveModuleState> {
  const fatalErrors: string[] = [];
  page.on('pageerror', (error) => fatalErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') fatalErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);

  return page.evaluate(({ moduleName, moduleUrl, fatalCount }) => {
    const visibleElements = Array.from(document.querySelectorAll('canvas, svg, button, input, select, [data-module], main, body, #app, #canvas, #video, #camera, #startButton, #toggleBtn, #openAudioPlayer')).slice(0, 160).slice(0, 160)
      .filter((element) => {
        const html = element as HTMLElement;
        const rect = html.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;

    const text = document.documentElement.textContent || '';
    const html = document.documentElement.innerHTML || '';

    return {
      name: moduleName,
      url: moduleUrl,
      found: text.toLowerCase().includes(moduleName.toLowerCase()) || html.toLowerCase().includes(moduleName.toLowerCase()),
      visibleElements,
      canvasCount: document.querySelectorAll('canvas').length,
      audioContextMentioned: /AudioContext|webkitAudioContext/i.test(html),
      fatalErrorsCount: fatalCount
    };
  }, { moduleName: name, moduleUrl: url, fatalCount: fatalErrors.length });
}

export function assertInteractiveModule(state: InteractiveModuleState): void {
  if (!state.found) throw new Error(`${state.name} module not discoverable at ${state.url}`);
  if (state.visibleElements <= 0 && state.canvasCount <= 0) throw new Error(`${state.name} has no visible interactive surface`);
  if (state.fatalErrorsCount > 0) throw new Error(`${state.name} produced ${state.fatalErrorsCount} fatal errors`);
}
