import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';

const root = process.cwd();
const outDir = join(root, 'docs');
const auditDir = join(root, 'audit', '_latest');
const htmlAnalyticsSnippet = '\n<script src="/assets/js/analytics.js" defer data-analytics-mode="queue-only"></script>';
const buildStamp = '<meta name="x-build-origin" content="scripts/build-docs.mjs">';
const nuageBootstrap = '<script type="module" src="/assets/js/nuage_magique/test.js"></script>';
const animatedTextScript = '<script src="/assets/js/animated-text.js" defer></script>';

function ensureDir(path) { mkdirSync(path, { recursive: true }); }
function cleanOutDir() { rmSync(outDir, { recursive: true, force: true }); ensureDir(outDir); }
function copyTreeIfExists(src, dst = src) {
  const fullSrc = join(root, src);
  if (!existsSync(fullSrc)) return;
  const fullDst = join(outDir, dst);
  ensureDir(dirname(fullDst));
  cpSync(fullSrc, fullDst, { recursive: true, force: true });
}
function copyFileIfExists(src, dst = src) {
  const fullSrc = join(root, src);
  if (!existsSync(fullSrc)) return;
  const fullDst = join(outDir, dst);
  ensureDir(dirname(fullDst));
  cpSync(fullSrc, fullDst, { force: true });
}
function beforeBody(html, snippet) {
  if (html.includes(snippet)) return html;
  return html.includes('</body>') ? html.replace(/\s*<\/body>/i, `\n${snippet}\n</body>`) : `${html}\n${snippet}\n`;
}
function ensureRobotsMeta(html) {
  return /name="robots"/i.test(html) ? html : html.replace(/\s*<\/head>/i, '  <meta name="robots" content="index,follow">\n</head>');
}
function ensureBuildStamp(html) {
  return /name="x-build-origin"/i.test(html) ? html : html.replace(/\s*<\/head>/i, `  ${buildStamp}\n</head>`);
}
function ensureAnalyticsHook(html) {
  return /src="\/assets\/js\/analytics\.js"/i.test(html) ? html : html.replace(/\s*<\/body>/i, `${htmlAnalyticsSnippet}\n</body>`);
}
function stripPlaceholderLinkedIn(html) {
  return html.replace(/\s*"https:\/\/www\.linkedin\.com\/in\/tonprofil",?\s*/g, '').replace(/,\s*\]/g, ']');
}
function injectStyleGuard(html) {
  const guard = `\n<script>(function(){try{var isDotnet=(document.body&&document.body.getAttribute('data-page')==='dotnet_demo');if(!isDotnet){document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/dotnet.css"]').forEach(function(l){l.parentNode&&l.parentNode.removeChild(l);});document.body&&document.body.classList&&document.body.classList.remove('preload');}}catch(e){/* ignore */}})();</script>`;
  return html.replace(/\s*<\/body>/i, `${guard}\n</body>`);
}
function preserveRichRuntime(srcPath, html) {
  let next = html;
  if (next.includes('id="cloud-bg"') && !next.includes('/assets/js/nuage_magique/test.js')) next = beforeBody(next, nuageBootstrap);
  if (/animated-text|anim-texte|anim-word|data-animate/.test(next) && !next.includes('/assets/js/animated-text.js')) next = beforeBody(next, animatedTextScript);
  if (srcPath === 'contact.html') next = next.split('\n').filter((line) => !line.includes('/assets/js/pages/mac_val.js')).join('\n');
  next = next.replaceAll(' crossorigin="anonymous"', '').replaceAll(" crossorigin='anonymous'", '');
  return next;
}
function transformHtml(srcPath) {
  const full = join(root, srcPath);
  let html = readFileSync(full, 'utf-8');
  html = stripPlaceholderLinkedIn(html);
  html = ensureRobotsMeta(html);
  html = ensureBuildStamp(html);
  html = ensureAnalyticsHook(html);
  html = injectStyleGuard(html);
  html = preserveRichRuntime(srcPath, html);
  const dst = join(outDir, srcPath);
  ensureDir(dirname(dst));
  writeFileSync(dst, html, 'utf-8');
}
function repairCopiedPlayer() {
  const playerPath = join(outDir, 'assets/js/player-singleton.js');
  if (!existsSync(playerPath)) return;
  let player = readFileSync(playerPath, 'utf-8');
  player = player.replaceAll("player.setAttribute('crossorigin','anonymous');", "player.removeAttribute('crossorigin');");
  player = player.replaceAll("player.crossOrigin = 'anonymous';", "player.crossOrigin = null;");
  writeFileSync(playerPath, player, 'utf-8');
}
function walkHtmlFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkHtmlFiles(full, acc);
    else if (entry.toLowerCase().endsWith('.html')) acc.push(full);
  }
  return acc;
}
function relativePrefixForHtml(file) {
  const relDir = dirname(relative(outDir, file)).replace(/\\/g, '/');
  if (relDir === '.') return '';
  return `${relDir.split('/').map(() => '..').join('/')}/`;
}
function isExternalOrSpecial(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:|data:|blob:|javascript:)/i.test(value || '');
}
function normalizeLocalUrl(value, prefix, summary, fileRel) {
  if (!value || isExternalOrSpecial(value) || value.includes('{{')) return value;
  const [rawPath, suffix = ''] = String(value).split(/([?#].*)/, 2);
  let path = rawPath.replace(/^\/+/, '').replace(/^\.\//, '');

  if (/^(?:index|portfolio_florian_b|parcours|contact)\.html$/i.test(path)) {
    summary.normalizedLinks.push({ file: fileRel, from: value, to: `${prefix}${path}${suffix}` });
    return `${prefix}${path}${suffix}`;
  }

  if (/^(?:assets|svg-icons)\//.test(path)) {
    const to = `${prefix}${path}${suffix}`;
    if (to !== value) summary.normalizedLinks.push({ file: fileRel, from: value, to });
    return to;
  }

  path = path
    .replace(/^.*?(assets\/)/, '$1')
    .replace(/^.*?(svg-icons\/)/, '$1')
    .replace(/^assets\/portfolio\/([^/]+)\/assets\//, 'assets/')
    .replace(/^assets\/portfolio\/([^/]+)\/(portfolio_florian_b|parcours|contact|index)\.html$/, '$2.html');

  if (/^(?:assets|svg-icons)\//.test(path) || /^(?:index|portfolio_florian_b|parcours|contact)\.html$/i.test(path)) {
    const to = `${prefix}${path}${suffix}`;
    if (to !== value) summary.normalizedLinks.push({ file: fileRel, from: value, to });
    return to;
  }

  return value;
}
function injectRuntimeUrl(html, prefix, summary, fileRel) {
  if (/assets\/js\/runtime-url\.js/.test(html)) return html;
  const tag = `<script src="${prefix}assets/js/runtime-url.js" defer></script>`;
  summary.normalizedLinks.push({ file: fileRel, from: '(missing runtime-url)', to: tag });
  const runtimeAnchors = [
    /<script[^>]+src=["'][^"']*assets\/js\/pjax-router\.js[^>]*><\/script>/i,
    /<script[^>]+src=["'][^"']*assets\/js\/page-hub\.js[^>]*><\/script>/i,
    /<script[^>]+src=["'][^"']*assets\/js\/player-singleton\.js[^>]*><\/script>/i
  ];
  for (const anchor of runtimeAnchors) {
    if (anchor.test(html)) return html.replace(anchor, `${tag}\n$&`);
  }
  return html.replace(/\s*<\/head>/i, `  ${tag}\n</head>`);
}
function normalizeCopiedHtmlFiles() {
  const summary = {
    scannedHtmlFiles: [],
    normalizedLinks: [],
    externalLinksIgnored: [],
    blockingAnomalies: [],
    verdict: 'PASS'
  };

  for (const file of walkHtmlFiles(outDir)) {
    const fileRel = relative(outDir, file).replace(/\\/g, '/');
    const prefix = relativePrefixForHtml(file);
    summary.scannedHtmlFiles.push(fileRel);
    let html = readFileSync(file, 'utf-8');

    html = injectRuntimeUrl(html, prefix, summary, fileRel);
    html = html.replace(/\b(src|href)=(["'])([^"']+)\2/g, (match, attr, quote, value) => {
      if (isExternalOrSpecial(value)) {
        summary.externalLinksIgnored.push({ file: fileRel, value });
        return match;
      }
      return `${attr}=${quote}${normalizeLocalUrl(value, prefix, summary, fileRel)}${quote}`;
    });

    const badPatterns = [
      /\/assets\/portfolio\/nuage_magique\/assets\//,
      /\/assets\/portfolio\/Projet_dotnet\/assets\//,
      /https:\/\/raw\.githack\.com\/assets\//,
      /(?:src|href)=["']\/assets\//
    ];
    for (const pattern of badPatterns) {
      if (pattern.test(html)) summary.blockingAnomalies.push({ file: fileRel, pattern: String(pattern) });
    }

    writeFileSync(file, html, 'utf-8');
  }

  if (summary.blockingAnomalies.length > 0) summary.verdict = 'FAIL';
  ensureDir(auditDir);
  writeFileSync(join(auditDir, 'static-url-normalization-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  if (summary.verdict !== 'PASS') {
    throw new Error(`Static URL normalization failed: ${JSON.stringify(summary.blockingAnomalies, null, 2)}`);
  }
}
function build() {
  cleanOutDir();
  copyTreeIfExists('assets');
  copyTreeIfExists('svg-icons');
  transformHtml('index.html');
  transformHtml('portfolio_florian_b.html');
  transformHtml('parcours.html');
  transformHtml('contact.html');
  repairCopiedPlayer();
  normalizeCopiedHtmlFiles();
  copyFileIfExists('robots.txt');
  copyFileIfExists('sitemap.xml');
  copyFileIfExists('.nojekyll');
  console.log('[build-docs] Bundle conservateur généré dans ./docs');
}
build();
