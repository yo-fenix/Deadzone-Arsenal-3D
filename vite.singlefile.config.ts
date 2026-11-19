import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      viteSingleFile({ removeViteModuleLoader: true }),
      {
        name: 'emit-standalone-chrome-html',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const outDir = path.resolve(__dirname, 'dist-singlefile');
          const indexHtml = path.join(outDir, 'index.html');
          const namedHtml = path.join(outDir, 'Deadzone-Arsenal-3D.html');
          if (fs.existsSync(indexHtml)) {
            let html = fs.readFileSync(indexHtml, 'utf8');
            // Clean crossorigin attribute from inlined script tags for cleaner local file:// opening in Chrome
            html = html.replace(/<script type="module" crossorigin>/g, '<script type="module">');
            fs.writeFileSync(indexHtml, html, 'utf8');
            fs.copyFileSync(indexHtml, namedHtml);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist-singlefile',
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
});
