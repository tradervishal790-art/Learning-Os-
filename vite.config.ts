import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Writes dist/precache-manifest.json = every built file in /assets.
// The service worker (public/sw.js) downloads all of them once, so every
// page (Notes, Test, Revision...) opens offline — not just pages visited before.
function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && !f.endsWith('.map'))
        .map((f) => '/' + f)
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(files),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheManifest()],
})
