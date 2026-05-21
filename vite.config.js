import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.API_PORT || '3001'
  const localApiTarget = `http://localhost:${apiPort}`

  return {
    logLevel: 'error',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [
      react(),
      {
        name: 'entity-import-shims',
        enforce: 'pre',
        resolveId(source) {
          if (source.startsWith('@/entities/') && source !== '@/entities/all') {
            return `\0${source}`
          }
        },
        load(id) {
          if (id.startsWith('\0@/entities/') && id !== '\0@/entities/all') {
            const name = id.replace('\0@/entities/', '')
            return `export { ${name} as default, ${name} } from '@/entities/all';\n`
          }
        },
      },
      /** Linux/Vercel: pages.config may import ./pages/Forms but file is forms.jsx */
      {
        name: 'page-case-shims',
        enforce: 'pre',
        resolveId(source, importer) {
          if (!importer?.includes('pages.config')) return null
          const map = {
            './pages/Forms': resolve(__dirname, 'src/pages/forms.jsx'),
            './pages/Reports': resolve(__dirname, 'src/pages/reports.jsx'),
          }
          if (map[source]) return map[source]
          return null
        },
      },
    ],
    server: {
      proxy: {
        '/api': { target: localApiTarget, changeOrigin: true },
        '/apps': { target: localApiTarget, changeOrigin: true },
        '/uploads': { target: localApiTarget, changeOrigin: true },
      },
    },
  }
})
