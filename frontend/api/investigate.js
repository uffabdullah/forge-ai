import { runInvestigate } from './_lib/runInvestigate.js'

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {}
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  try {
    const body = await readJsonBody(req)
    const result = await runInvestigate(body, process.env)
    res.status(result.status).json(result.body)
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid JSON body' : error.message
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error: message || 'Investigate failed',
    })
  }
}
