import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Writes the Angular production environment from build-time env vars.
 * Accepts API_URL as either the API origin or a full .../api/v1 URL.
 */
const raw = (process.env.API_URL || 'http://localhost:5000').trim().replace(/\/$/, '');
const apiUrl = raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
const target = resolve(process.cwd(), 'src/environments/environment.production.ts');

writeFileSync(
  target,
  `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
};
`,
  'utf8',
);

console.log(`Production apiUrl set to ${apiUrl}`);
