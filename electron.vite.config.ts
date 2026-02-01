/**
 * Electron-Vite Configuration
 *
 * Builds main process, preload script, and renderer (React app).
 * Preserves path aliases from original vite.config.ts.
 */

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Main process configuration
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main.ts'),
        },
        // Externalize native modules
        external: ['sherpa-onnx-node', 'speaker'],
      },
    },
    resolve: {
      alias: {
        '@electron': path.resolve(__dirname, './electron'),
      },
    },
  },

  // Preload script configuration
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload.ts'),
        },
      },
    },
  },

  // Renderer process configuration (React app)
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@core': path.resolve(__dirname, './src/core'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@store': path.resolve(__dirname, './src/store'),
        '@theme': path.resolve(__dirname, './src/theme'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@data': path.resolve(__dirname, './src/data'),
      },
    },
    server: {
      port: 5173,
    },
  },
});
