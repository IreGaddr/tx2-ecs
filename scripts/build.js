import * as esbuild from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

async function build() {
  console.log('🧹 Cleaning dist directory...');
  try {
    rmSync(join(root, 'dist'), { recursive: true, force: true });
  } catch (err) {
    // Directory doesn't exist, that's fine
  }
  mkdirSync(join(root, 'dist'), { recursive: true });

  const commonOptions = {
    bundle: false,
    platform: 'neutral',
    format: 'esm',
    target: ['es2022'],
    sourcemap: true,
    minify: false,
  };

  console.log('📦 Building core (isomorphic)...');
  await esbuild.build({
    ...commonOptions,
    entryPoints: [
      'src/index.ts',
      'src/core/index.ts',
      'src/reactive/index.ts',
      'src/shared/index.ts',
    ],
    outdir: 'dist',
    outExtension: { '.js': '.js' },
  });

  console.log('📦 Building core modules...');
  await esbuild.build({
    ...commonOptions,
    entryPoints: [
      'src/core/entity.ts',
      'src/core/component.ts',
      'src/core/system.ts',
      'src/core/query.ts',
      'src/core/world.ts',
      'src/reactive/signal.ts',
      'src/shared/serialization.ts',
      'src/shared/sync.ts',
      'src/shared/hydration.ts',
    ],
    outdir: 'dist',
  });

  console.log('🌐 Building client...');
  await esbuild.build({
    ...commonOptions,
    platform: 'browser',
    entryPoints: ['src/client/index.ts', 'src/client/dom.ts', 'src/client/renderer.ts'],
    outdir: 'dist/client',
  });

  console.log('🖥️  Building server...');
  await esbuild.build({
    ...commonOptions,
    platform: 'node',
    entryPoints: ['src/server/index.ts', 'src/server/ssr.ts', 'src/server/rpc.ts'],
    outdir: 'dist/server',
  });

  console.log('📦 Building minified bundles...');

  await esbuild.build({
    ...commonOptions,
    bundle: true,
    minify: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/tx2-ecs.min.js',
  });

  await esbuild.build({
    ...commonOptions,
    bundle: true,
    minify: true,
    platform: 'browser',
    entryPoints: ['src/client/index.ts'],
    outfile: 'dist/tx2-ecs.client.min.js',
  });

  await esbuild.build({
    ...commonOptions,
    bundle: true,
    minify: true,
    platform: 'node',
    entryPoints: ['src/server/index.ts'],
    outfile: 'dist/tx2-ecs.server.min.js',
  });

  console.log('✅ Build complete!');
  console.log('\nOutput:');
  console.log('  - dist/ (ESM modules)');
  console.log('  - dist/tx2-ecs.min.js (bundled + minified core)');
  console.log('  - dist/tx2-ecs.client.min.js (bundled + minified client)');
  console.log('  - dist/tx2-ecs.server.min.js (bundled + minified server)');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
