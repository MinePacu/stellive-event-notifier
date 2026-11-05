import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import fs from 'fs'

// The Tauri CLI sets TAURI_ENV_PLATFORM when it runs `beforeDevCommand` /
// `beforeBuildCommand`. The desktop app is served from the webview root, while
// the web build is served by the backend under `/admin/`.
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM)

// Backend dev server (see backend/stellive-hub-api). Proxying keeps API calls
// same-origin in `pnpm dev`, so the admin session cookie works.
const backendDevOrigin =
  process.env.ADMIN_DEV_BACKEND_ORIGIN ?? 'http://localhost:4000'

// pnpm may be configured (via a machine-local .npmrc `virtual-store-dir`) to
// keep its virtual store outside the project directory. Vite resolves the
// symlinks to real paths, so allow the dev server to serve from that store.
function resolveExternalVirtualStore(): string[] {
  try {
    const real = fs.realpathSync(path.resolve(__dirname, 'node_modules/vite'))
    const marker = `${path.sep}.pnpm${path.sep}`
    const index = real.indexOf(marker)
    if (index === -1) return []
    const store = real.slice(0, index + marker.length - 1)
    return store.startsWith(__dirname) ? [] : [store]
  } catch {
    return []
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: isTauri ? '/' : '/admin/',
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Resolve these from the project root. Needed when pnpm's virtual store
    // lives outside the project (packages such as @hookform/resolvers import
    // `zod/v4/core` without declaring zod as a peer dependency).
    dedupe: ['react', 'react-dom', 'zod'],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [__dirname, ...resolveExternalVirtualStore()],
    },
    proxy: {
      '/v1': {
        target: backendDevOrigin,
        changeOrigin: false,
      },
    },
  },
})
