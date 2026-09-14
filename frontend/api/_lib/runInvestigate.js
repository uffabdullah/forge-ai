/**
 * Shared /api/investigate core — used by the Vercel function and the Vite
 * dev/preview middleware. Keys stay on the server; the browser only sees the
 * answer plus a PRISM trace id.
 */

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'
const AGENT_ID = 'counterfeittrace-investigator'
const AGENT_NAME = 'CounterfeitTrace investigator'
const MAX_QUESTION = 2000

const SYSTEM_PROMPT = `You are the CounterfeitTrace investigator. You explain GraphSAGE risk scores on a synthetic medicines / seeds / fertilizer / electronics supply-chain graph.

Rules:
- Use only the node, signals, and neighbour counts in the user message. Do not invent transactions, prices, regions, or scores.
- If the node is flagged (risk ≥ 0.5), explain why it looks like a counterfeit injection point: sell-side price, region mismatch, burst timing — upstream purchases of genuine stock can still be clean.
- If it is not flagged, say so and describe residual risk without overstating.
- Be specific and concise (under 180 words). No markdown tables. No tools.`

function pickNode(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id).slice(0, 64) : ''
  if (!id) return null
  const score = Number(raw.riskScore)
  return {
    id,
    type: raw.type != null ? String(raw.type).slice(0, 32) : null,
    region: raw.region != null ? String(raw.region).slice(0, 64) : null,
    product: raw.product != null ? String(raw.product).slice(0, 64) : null,
    riskScore: Number.isFinite(score) ? score : null,
    isFlagged: Boolean(raw.isFlagged),
    riskBand: raw.riskBand != null ? String(raw.riskBand).slice(0, 24) : null,
  }
}

function neighbourCounts(raw) {
  const upstream = Number(raw?.upstream)
  const downstream = Number(raw?.downstream)
  return {
    upstream: Number.isFinite(upstream) ? Math.max(0, Math.floor(upstream)) : 0,
    downstream: Number.isFinite(downstream) ? Math.max(0, Math.floor(downstream)) : 0,
  }
}

function buildUserMessage({ question, node, signals, neighbours }) {
  const lines = [
    `Question: ${question}`,
    '',
    'Selected node:',
    node
      ? JSON.stringify(node)
      : '(none — answer at network level and ask the analyst to click a flagged distributor)',
  ]
  if (signals.length) {
    lines.push('', 'Inspector signals:', ...signals.slice(0, 12).map((s) => `- ${s}`))
  }
  if (node) {
    lines.push('', `Neighbour counts: ${neighbours.upstream} upstream, ${neighbours.downstream} downstream.`)
  }
  return lines.join('\n')
}

async function callGemini(apiKey, userMessage, env = process.env) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 512 },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.error?.message || `Gemini HTTP ${response.status}`
    throw new Error(detail)
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n')
  if (!text?.trim()) throw new Error('Gemini returned an empty reply')
  const usage = data?.usageMetadata || {}
  return {
    text: text.trim(),
    model,
    provider: 'gemini',
    tokenCountInput: usage.promptTokenCount ?? null,
    tokenCountOutput: usage.candidatesTokenCount ?? null,
  }
}

async function callGroq(apiKey, userMessage, env = process.env) {
  const model = env.GROQ_MODEL || DEFAULT_GROQ_MODEL
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_completion_tokens: 256,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.error?.message || `Groq HTTP ${response.status}`
    throw new Error(detail)
  }
  const message = data?.choices?.[0]?.message || {}
  const text = String(message.content || '').trim()
  if (!text) throw new Error('Groq returned an empty reply')
  const usage = data?.usage || {}
  return {
    text: text.trim(),
    model,
    provider: 'groq',
    tokenCountInput: usage.prompt_tokens ?? null,
    tokenCountOutput: usage.completion_tokens ?? null,
  }
}

async function postPrismTrace(env, payload) {
  const host = (env.PRISMTRACE_HOST || '').replace(/\/$/, '')
  const projectId = env.PRISMTRACE_PROJECT_ID
  const apiKey = env.PRISMTRACE_API_KEY
  if (!host || !projectId || !apiKey) {
    return {
      ok: false,
      skipped: true,
      reason: 'Set PRISMTRACE_HOST, PRISMTRACE_PROJECT_ID, and PRISMTRACE_API_KEY to record a trace.',
    }
  }

  const response = await fetch(`${host}/api/traces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PRISMtrace-Key': apiKey,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      project_id: projectId,
      model: payload.model,
      input_messages: payload.inputMessages,
      output_message: payload.outputMessage,
      latency_ms: payload.latencyMs,
      session_id: payload.sessionId,
      agent_id: AGENT_ID,
      agent_name: AGENT_NAME,
      token_count_input: payload.tokenCountInput ?? 0,
      token_count_output: payload.tokenCountOutput ?? 0,
      metadata: {
        source: 'counterfeittrace',
        node_id: payload.nodeId || null,
        provider: payload.provider,
        agent_id: AGENT_ID,
        agent_name: AGENT_NAME,
        session_id: payload.sessionId,
      },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      skipped: false,
      status: response.status,
      reason: data?.error || data?.message || `PRISM HTTP ${response.status}`,
      host,
    }
  }

  return {
    ok: true,
    id: data.id || data.trace_id || null,
    sessionId: data.session_id || payload.sessionId,
    costUsd: data.cost_usd ?? null,
    host,
  }
}

/**
 * @param {object} body
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function runInvestigate(body, env = process.env) {
  const question = String(body?.question || '').trim().slice(0, MAX_QUESTION)
  if (!question) {
    return { status: 400, body: { error: 'question is required' } }
  }

  const geminiKey = env.GEMINI_API_KEY
  const groqKey = env.GROQ_API_KEY
  if (!geminiKey && !groqKey) {
    return {
      status: 503,
      body: {
        error: 'No LLM key configured. Set GEMINI_API_KEY or GROQ_API_KEY on the server.',
      },
    }
  }

  const node = pickNode(body.node)
  const signals = Array.isArray(body.signals)
    ? body.signals.map((item) => String(item).slice(0, 240)).filter(Boolean).slice(0, 12)
    : []
  const neighbours = neighbourCounts(body.neighbours)
  const sessionId =
    String(body.sessionId || '').slice(0, 80) ||
    `ct-${node?.id || 'network'}`

  const userMessage = buildUserMessage({ question, node, signals, neighbours })
  const started = Date.now()

  let completion
  try {
    if (groqKey) {
      completion = await callGroq(groqKey, userMessage, env)
    } else {
      completion = await callGemini(geminiKey, userMessage, env)
    }
  } catch (error) {
    if (groqKey && geminiKey) {
      try {
        completion = await callGemini(geminiKey, userMessage, env)
      } catch (fallbackError) {
        return {
          status: 502,
          body: { error: fallbackError.message || error.message || 'LLM request failed' },
        }
      }
    } else {
      return {
        status: 502,
        body: { error: error.message || 'LLM request failed' },
      }
    }
  }

  const latencyMs = Date.now() - started
  const prism = await postPrismTrace(env, {
    model: completion.model,
    provider: completion.provider,
    inputMessages: [{ role: 'user', content: userMessage }],
    outputMessage: completion.text,
    latencyMs,
    sessionId,
    tokenCountInput: completion.tokenCountInput,
    tokenCountOutput: completion.tokenCountOutput,
    nodeId: node?.id,
  }).catch((error) => ({
    ok: false,
    skipped: false,
    reason: error.message || 'PRISM request failed',
  }))

  return {
    status: 200,
    body: {
      answer: completion.text,
      provider: completion.provider,
      model: completion.model,
      latencyMs,
      nodeId: node?.id || null,
      prism,
    },
  }
}
