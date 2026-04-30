import fs from 'node:fs';
import path from 'node:path';

const proofName = String(process.argv[2] || '').trim();

if (!proofName) {
  throw new Error('Usage: node scripts/ci/write-runtime-proof.mjs <proof-name>');
}

if (!/^[a-z0-9][a-z0-9-]*$/i.test(proofName)) {
  throw new Error(`Invalid proof name: ${proofName}`);
}

const outDir = path.resolve('audit/_latest');
fs.mkdirSync(outDir, { recursive: true });

const proof = {
  timestamp: new Date().toISOString(),
  verdict: 'passed',
  source: `npm run test:${proofName}`,
  proofName,
};

const outFile = path.join(outDir, `${proofName}-summary.json`);
fs.writeFileSync(outFile, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');

console.log(`[runtime-proof] OK ${path.relative(process.cwd(), outFile)}`);
