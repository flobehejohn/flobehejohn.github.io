import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const publicRoots = ['assets', 'docs', 'index.html', 'portfolio_florian_b.html', 'parcours.html', 'contact.html'];
const failures = [];
const warnings = [];

const secretPatterns = [
  ['google-api-key', /AIza[0-9A-Za-z_-]{20,}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['github-token', /ghp_[0-9A-Za-z]{20,}/],
  ['openai-like-token', /sk-[0-9A-Za-z]{20,}/]
];

function walk(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
}

const files = publicRoots.flatMap((relative) => walk(join(root, relative)))
  .filter((file) => /\.(html|js|mjs|json|css|txt|xml|md)$/i.test(file));

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const [name, pattern] of secretPatterns) {
    if (pattern.test(content)) failures.push(`${name}: ${file}`);
  }
  if (/http:\/\//i.test(content)) warnings.push(`mixed-content-candidate: ${file}`);
  if (/target=["']_blank["']/i.test(content) && !/rel=["'][^"']*noopener/i.test(content)) {
    failures.push(`unsafe target=_blank without noopener: ${file}`);
  }
}

if (failures.length) {
  console.error('[security-audit] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[security-audit] OK');
console.log(`[security-audit] scannedFiles=${files.length}`);
if (warnings.length) {
  console.log('[security-audit] warnings');
  for (const warning of warnings.slice(0, 20)) console.log(` - ${warning}`);
}
