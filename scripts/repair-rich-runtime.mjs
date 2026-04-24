import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const rootPages = ['index.html', 'portfolio_florian_b.html', 'parcours.html', 'contact.html'];
const failures = [];

function beforeBody(html, snippet) {
  if (html.includes(snippet)) return html;
  return html.includes('</body>') ? html.replace('</body>', `${snippet}\n</body>`) : `${html}\n${snippet}\n`;
}

function repairPage(name, html) {
  let out = html;
  if (out.includes('id="cloud-bg"') && !out.includes('/assets/js/nuage_magique/test.js')) {
    out = beforeBody(out, '<script type="module" src="/assets/js/nuage_magique/test.js"></script>');
  }
  if (/animated-text|anim-texte|anim-word|data-animate/.test(out) && !out.includes('/assets/js/animated-text.js')) {
    out = beforeBody(out, '<script src="/assets/js/animated-text.js" defer></script>');
  }
  if (name === 'contact.html') {
    out = out.split('\n').filter((line) => !line.includes('/assets/js/pages/mac_val.js')).join('\n');
  }
  out = out.replaceAll(' crossorigin="anonymous"', '').replaceAll(" crossorigin='anonymous'", '');
  return out;
}

for (const page of rootPages) {
  const path = join(root, 'docs', page);
  if (!existsSync(path)) {
    failures.push(`missing page: ${page}`);
    continue;
  }
  const before = readFileSync(path, 'utf-8');
  const after = repairPage(page, before);
  if (after !== before) writeFileSync(path, after, 'utf-8');
  const finalHtml = readFileSync(path, 'utf-8');
  if (finalHtml.includes('id="cloud-bg"') && !finalHtml.includes('/assets/js/nuage_magique/test.js')) failures.push(`missing nuage runtime: ${page}`);
  if (/animated-text|anim-texte|anim-word|data-animate/.test(finalHtml) && !finalHtml.includes('/assets/js/animated-text.js')) failures.push(`missing animated text runtime: ${page}`);
  if (page === 'contact.html' && finalHtml.includes('/assets/js/pages/mac_val.js')) failures.push('contact still loads mac_val.js');
  if (finalHtml.includes('crossorigin="anonymous"') || finalHtml.includes("crossorigin='anonymous'")) failures.push(`anonymous cors attribute remains: ${page}`);
}

const playerPath = join(root, 'docs/assets/js/player-singleton.js');
if (existsSync(playerPath)) {
  let player = readFileSync(playerPath, 'utf-8');
  player = player.replaceAll("player.setAttribute('crossorigin','anonymous');", "player.removeAttribute('crossorigin');");
  player = player.replaceAll("player.crossOrigin = 'anonymous';", "player.crossOrigin = null;");
  writeFileSync(playerPath, player, 'utf-8');
  const finalPlayer = readFileSync(playerPath, 'utf-8');
  if (finalPlayer.includes("setAttribute('crossorigin','anonymous')") || finalPlayer.includes("crossOrigin = 'anonymous'")) failures.push('player still forces anonymous cors');
} else {
  failures.push('missing player-singleton in docs');
}

if (failures.length) {
  console.error('[repair-rich-runtime] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[repair-rich-runtime] OK');
