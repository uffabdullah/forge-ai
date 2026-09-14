import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { runInvestigate } from './api/_lib/runInvestigate.js'

function mergeEnv(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

async function handleInvestigate(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'POST only' }))
    return
  }

  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    const body = raw ? JSON.parse(raw) : {}
    const result = await runInvestigate(body, process.env)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.body))
  } catch (error) {
    const isJson = error instanceof SyntaxError
    res.statusCode = isJson ? 400 : 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: isJson ? 'Invalid JSON body' : error.message || 'Investigate failed',
      }),
    )
  }
}

function investigateApi() {
  return {
    name: 'investigate-api',
    configureServer(server) {
      server.middlewares.use('/api/investigate', handleInvestigate)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/investigate', handleInvestigate)
    },
  }
}

// Tailwind 4 is configured entirely in CSS (see src/styles/index.css) — there is
// no tailwind.config.js and no PostCSS config to maintain.
export default defineConfig(({ mode }) => {
  mergeEnv(mode)
  return {
    plugins: [react(), tailwindcss(), investigateApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@components': fileURLToPath(new URL('./components', import.meta.url)),
      },
    },
    server: {
      port: 5173,
    },
  }
})
