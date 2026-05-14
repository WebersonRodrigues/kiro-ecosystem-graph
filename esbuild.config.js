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

// Copy webview JS files to dist/
function copyWebviewFiles() {
  const mediaDir = path.join(__dirname, 'src', 'webview', 'media');
  const distDir = path.join(__dirname, 'dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const filesToCopy = ['webview.js', 'settings-panel.js', 'filter-panel.js', 'health-panel.js', 'interactions-panel.js', 'gap-detector.js', 'alternative-views.js', 'visual-modes.js', 'export-panel.js', 'cognitive-panel.js', 'shape-legend.js'];

  for (const file of filesToCopy) {
    const src = path.join(mediaDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
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
