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
    entryPoints: [join(__dirname, 'server.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node18'],
    outfile: join(distDir, 'server.js'),
    sourcemap: true,
    external: ['fs', 'path', 'http', 'url'],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
