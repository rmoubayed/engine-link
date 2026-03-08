import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  metafile: true,
};

/** @type {import('esbuild').BuildOptions} */
const mcpServerOptions = {
  entryPoints: ['src/mcp/server.ts'],
  bundle: true,
  outfile: 'dist/mcp-server.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
};

async function main() {
  if (isWatch) {
    const ctx1 = await esbuild.context(buildOptions);
    const ctx2 = await esbuild.context(mcpServerOptions);
    await Promise.all([ctx1.watch(), ctx2.watch()]);
    console.log('[EngineLink] Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(buildOptions),
      esbuild.build(mcpServerOptions),
    ]);
    console.log('[EngineLink] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
