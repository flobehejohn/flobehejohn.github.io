import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function writeAuditJson(relativePath: string, payload: JsonValue): void {
  const outputPath = join(process.cwd(), relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function nowIso(): string {
  return new Date().toISOString();
}
