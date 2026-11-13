import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { defineConfig, Plugin } from 'vite';

/**
 * Pre-compresses build assets into Gzip (.gz) and Brotli (.br)
 * Enables efficient delivery on Iranian hosts, ArvanCloud, Nginx, or GitHub Pages
 */
function compressionPlugin(): Plugin {
  return {
    name: 'compression-plugin',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      const processFile = (filePath: string) => {
        const ext = path.extname(filePath).toLowerCase();
        // Compress text-based assets only
        if (!['.js', '.css', '.html', '.svg', '.json'].includes(ext)) return;

        try {
          const content = fs.readFileSync(filePath);
          // Only compress files larger than 512 bytes
          if (content.length < 512) return;

          // 1. Gzip compression (maximum compression level 9)
          const gzipped = zlib.gzipSync(content, { level: 9 });
          fs.writeFileSync(`${filePath}.gz`, gzipped);

          // 2. Brotli compression (maximum quality 11)
          const brotli = zlib.brotliCompressSync(content, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            },
          });
          fs.writeFileSync(`${filePath}.br`, brotli);
        } catch (err) {
          console.warn(`[compression] Failed on ${filePath}:`, err);
        }
      };

      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            processFile(fullPath);
          }
        }
      };

      walkDir(distDir);
    },
  };
}

export default defineConfig(() => {
  return {
    // Configurable base URL: supports Iranian host deployment, GitHub Pages, or subpath
    base: process.env.VITE_BASE_URL || './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-sw-build-version',
        closeBundle() {
          const swPath = path.resolve(__dirname, 'dist/sw.js');
          if (fs.existsSync(swPath)) {
            const buildTimestamp = Date.now().toString();
            let content = fs.readFileSync(swPath, 'utf-8');
            content = content.replace(/__BUILD_TIMESTAMP__/g, buildTimestamp);
            fs.writeFileSync(swPath, content, 'utf-8');
          }
        },
      },
      compressionPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('vite/preload-helper')) {
              return 'preload-helper';
            }
            if (!id.includes('node_modules')) return;
            // PDF tools: on-demand dynamic import only
              if (id.includes('/jspdf/') || id.includes('/html2canvas/') || id.includes('@types/html2canvas')) {
                return 'vendor-pdf';
              }
              // Map tools: on-demand dynamic import only
              if (id.includes('/leaflet/') || id.includes('@types/leaflet')) {
                return 'vendor-map';
              }
              // Excel tools: on-demand dynamic import only
              if (id.includes('/xlsx/')) {
                return 'vendor-xlsx';
              }
              // Supabase backend client
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              // UI Icons
              if (id.includes('/lucide-react/')) {
                return 'vendor-icons';
              }
              // Core React runtime: split react-dom from react core
              if (id.includes('/react-dom/')) {
                return 'vendor-react-dom';
              }
              if (
                id.includes('/react/') ||
                id.includes('/scheduler/')
              ) {
                return 'vendor-react-core';
              }
          },
        },
      },
    },
  };
});
