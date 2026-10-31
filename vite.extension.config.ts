import { build, defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    lib: { entry: `${root}extension/content.ts`, name: 'ChordsLink', formats: ['iife'], fileName: () => 'content.js' },
  },
  plugins: [{
    name: 'extension-manifest',
    async closeBundle() {
      for (const entry of ['popup', 'background']) {
        await build({
          configFile: false,
          publicDir: false,
          build: {
            outDir: `${root}dist-extension`, emptyOutDir: false,
            lib: { entry: `${root}extension/${entry}.ts`, name: `Chords${entry}`, formats: ['iife'], fileName: () => `${entry}.js` },
          },
        });
      }
      for (const file of ['manifest.json', 'README.md', 'popup.html', 'popup.css']) copyFileSync(`${root}extension/${file}`, `${root}dist-extension/${file}`);
    },
  }],
});
