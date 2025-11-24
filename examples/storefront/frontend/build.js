import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, 'dist');

function clean() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

async function build() {
  clean();
  await esbuild.build({
    entryPoints: [join(__dirname, 'main.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    outfile: join(distDir, 'client.js'),
    sourcemap: true,
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
