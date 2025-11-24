import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, cpSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const exampleDir = join(root, 'examples/todo-app');
const distDir = join(exampleDir, 'dist');

async function buildExample() {
  console.log('🧹 Cleaning example dist directory...');
  try {
    rmSync(distDir, { recursive: true, force: true });
  } catch (err) {
    // Directory doesn't exist
  }
  mkdirSync(distDir, { recursive: true });

  console.log('📦 Building server...');
  await esbuild.build({
    entryPoints: [join(exampleDir, 'server.ts')],
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

  console.log('🌐 Building client...');
  await esbuild.build({
    entryPoints: [join(exampleDir, 'client.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    outfile: join(distDir, 'client.js'),
    sourcemap: true,
  });

  console.log('📄 Creating static files...');
  const clientHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WECS Todo App</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f1f5f9; }
    * { box-sizing: border-box; }
    button:hover { opacity: 0.9; }
    input:focus { outline: 2px solid #3b82f6; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="/client.js"></script>
</body>
</html>`;

  writeFileSync(join(distDir, 'index.html'), clientHtml);

  console.log('✅ Example build complete!');
  console.log('\nTo run the example:');
  console.log('  npm run example:todo');
  console.log('\nThen open http://localhost:3000');
}

buildExample().catch(err => {
  console.error('❌ Example build failed:', err);
  process.exit(1);
});
