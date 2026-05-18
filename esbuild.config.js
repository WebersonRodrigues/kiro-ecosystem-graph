const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Extension host bundle (Node.js, CommonJS)
const extensionBuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  sourcemap: true,
};

// Copy webview JS files and vendor libs to dist/
function copyWebviewFiles() {
  const mediaDir = path.join(__dirname, 'src', 'webview', 'media');
  const distDir = path.join(__dirname, 'dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const filesToCopy = ['webview.js', 'settings-panel.js', 'filter-panel.js', 'health-panel.js', 'interactions-panel.js', 'gap-detector.js', 'alternative-views.js', 'visual-modes.js', 'export-panel.js', 'cognitive-panel.js', 'shape-legend.js', 'renderer-manager.js', 'minimap.js'];

  for (const file of filesToCopy) {
    const src = path.join(mediaDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy force-graph vendor lib to dist/
  const forceGraphSrc = path.join(__dirname, 'node_modules', 'force-graph', 'dist', 'force-graph.min.js');
  const forceGraphDest = path.join(distDir, 'force-graph.min.js');
  if (fs.existsSync(forceGraphSrc)) {
    fs.copyFileSync(forceGraphSrc, forceGraphDest);
  }

  // Copy 3d-force-graph vendor lib to dist/
  const forceGraph3DSrc = path.join(__dirname, 'node_modules', '3d-force-graph', 'dist', '3d-force-graph.min.js');
  const forceGraph3DDest = path.join(distDir, '3d-force-graph.min.js');
  if (fs.existsSync(forceGraph3DSrc)) {
    fs.copyFileSync(forceGraph3DSrc, forceGraph3DDest);
  }
}

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(extensionBuildOptions);
      await ctx.watch();
      console.log('Watching for changes...');

      // Initial copy of webview files
      copyWebviewFiles();

      // Watch webview media files for changes
      const mediaDir = path.join(__dirname, 'src', 'webview', 'media');
      fs.watch(mediaDir, { recursive: false }, () => {
        copyWebviewFiles();
        console.log('Webview files copied.');
      });
    } else {
      await esbuild.build(extensionBuildOptions);
      copyWebviewFiles();
      console.log('Build complete.');
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
