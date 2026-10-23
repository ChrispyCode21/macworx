import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { NETWORK_ONLY_PATHS } from './src/networkOnly.ts'
import { isPreviewBranch } from './src/previewBuild.ts'

/** The "/*" block of public/_headers, so `vite preview` runs under the production policy. */
function productionHeaders(): Record<string, string> {
  const block =
    readFileSync('public/_headers', 'utf8')
      .split(/^\/\*\s*$/m)[1]
      ?.split(/^\S/m)[0] ?? ''
  const headers = Object.fromEntries(
    block
      .split('\n')
      .map((line) => line.trim().match(/^([\w-]+):\s*(.+)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  // HSTS on localhost would pin the browser to https for every local port.
  delete headers['Strict-Transport-Security']
  return headers
}

// https://vite.dev/config/
export default defineConfig({
  preview: { headers: productionHeaders() },
  // "1" only in a PR preview build, which shows the Pair button outside the installed app (SPEC §5.4, §6.9).
  define: {
    'import.meta.env.VITE_PREVIEW': JSON.stringify(isPreviewBranch(process.env.WORKERS_CI_BRANCH) ? '1' : ''),
  },
  plugins: [
    react(),
    // Installable + offline on the iPad (SPEC §2): a web app manifest, and a service worker that
    // precaches the built app so it opens with no connection.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'macworx',
        short_name: 'macworx',
        description: 'Extra math practice that earns Macaronis.',
        theme_color: '#f2a516',
        background_color: '#fff6dc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Never the cached app shell for these: the Worker, Cloudflare Access and its sign-in (src/networkOnly.ts).
        navigateFallbackDenylist: NETWORK_ONLY_PATHS,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
})
