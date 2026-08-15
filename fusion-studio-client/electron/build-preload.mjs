import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(clientRoot, 'electron', 'preload-source.cjs')],
  outfile: path.join(clientRoot, 'electron', 'preload.cjs'),
  bundle: true,
  external: ['electron'],
  format: 'cjs',
  legalComments: 'none',
  logLevel: 'warning',
  platform: 'node',
  sourcemap: false,
  target: 'es2022',
});
