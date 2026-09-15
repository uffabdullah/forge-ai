/**
 * InvestigatePanel — ask the serverless investigator about the selected node.
 * POSTs to /api/investigate; renders the answer and the PRISM trace receipt.
 */
import { useMemo, useState } from 'react'

const DEFAULT_QUESTION =
  'Why is this node flagged as a counterfeit injection point? Walk through price, region, and timing from the inspector signals.'

function neighbourCounts(node, edges) {
  if (!node) return { upstream: 0, downstream: 0 }
  let upstream = 0
  let downstream = 0
  for (const edge of edges) {
    if (edge.target === node.id) upstream += 1
    if (edge.source === node.id) downstream += 1
  }
  return { upstream, downstream }
}

export default function InvestigatePanel({
  node = null,
  signals = [],
  edges = [],
  flagged = [],
  onSelect,
}) {
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const neighbours = useMemo(() => neighbourCounts(node, edges), [node, edges])
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return 'ct-demo'
    const key = 'ct-prism-session'
    let id = sessionStorage.getItem(key)
    if (!id) {
      id = `ct-demo-${Date.now()}`
      sessionStorage.setItem(key, id)
    }
    return id
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return

    setStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          sessionId,
          node: node
            ? {
                id: node.id,
                type: node.type,
                region: node.region,
                product: node.product,
                riskScore: node.riskScore,
                isFlagged: node.isFlagged,
                riskBand: node.riskBand,
              }
            : null,
          signals,
          neighbours,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      setResult(data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Request failed')
    }
  }

  const prism = result?.prism

  return (
    <div data-reveal className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        onSubmit={onSubmit}
        className="border border-white/10 bg-white/[0.03] p-5"
      >
        <p className="font-display text-[10px] tracking-[0.28em] text-slate-500 uppercase">
          selected node
        </p>
        {node ? (
          <p className="mt-2 font-display text-lg text-white">
            {node.id}
            <span className="ml-2 text-xs text-slate-500">
              {node.region} · score {node.riskScore == null ? '—' : node.riskScore.toFixed(2)}
              {node.isFlagged ? ' · flagged' : ''}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Click a red node on the graph, or pick a flagged distributor:
          </p>
        )}

        {!node && flagged.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {flagged.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                className="rounded-full px-3 py-1 font-display text-[11px] tracking-[0.12em] text-risk-flagged ring-1 ring-risk-flagged/30 hover:bg-white/5"
              >
                {item.id}
              </button>
            ))}
          </div>
        )}

        <label className="mt-5 block">
          <span className="font-display text-[10px] tracking-[0.28em] text-slate-500 uppercase">
            ask the agent
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            className="mt-2 w-full resize-y border border-white/10 bg-ink-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-white/20"
          />
        </label>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-display text-[11px] tracking-[0.22em] text-white uppercase disabled:opacity-50"
        >
          {status === 'loading' ? 'Investigating…' : 'Ask agent'}
        </button>
      </form>

      <div className="border border-white/10 bg-white/[0.03] p-5">
        <p className="font-display text-[10px] tracking-[0.28em] text-slate-500 uppercase">
          answer + PRISM trace
        </p>

        {status === 'idle' && (
          <p className="mt-3 text-sm text-slate-500">
            The serverless route calls Gemini or Groq, then POSTs the exchange to
            PRISM. Keys never leave the server.
          </p>
        )}

        {status === 'loading' && (
          <p className="mt-3 font-mono text-xs text-slate-400">Waiting on /api/investigate…</p>
        )}

        {status === 'error' && (
          <p className="mt-3 text-sm text-risk-flagged">{error}</p>
        )}

        {status === 'ready' && result && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
              {result.answer}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-4 font-mono text-[11px]">
              <div>
                <dt className="text-slate-600 uppercase tracking-wider">provider</dt>
                <dd className="mt-0.5 text-slate-300">
                  {result.provider} · {result.model}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600 uppercase tracking-wider">latency</dt>
                <dd className="mt-0.5 text-slate-300">{result.latencyMs} ms</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-600 uppercase tracking-wider">PRISM</dt>
                <dd className="mt-0.5 text-slate-300">
                  {prism?.ok ? (
                    <>
                      trace {prism.id || 'recorded'}
                      {prism.sessionId ? ` · session ${prism.sessionId}` : ''}
                      {prism.host ? (
                        <>
                          {' · '}
                          <a
                            href={prism.host}
                            target="_blank"
                            rel="noreferrer"
                            className="text-node-distributor underline decoration-white/20 underline-offset-2"
                          >
                            open dashboard
                          </a>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-500">
                      {prism?.reason || 'Trace not recorded'}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
