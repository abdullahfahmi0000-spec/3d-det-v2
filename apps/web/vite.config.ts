import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Linked workspace packages are served as-is in development and are not pre-bundled.
    // @3ddet/contracts emits CommonJS (it is shared with the Node applications), so it must be
    // pre-bundled or its named exports are not visible to the browser. Add any other CommonJS
    // workspace package the web application imports here. After rebuilding one, restart the
    // dev server with --force so the pre-bundled copy is refreshed.
    include: ['@3ddet/contracts'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep the rendering engine in its own chunk so the 2D application never pays for it.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
