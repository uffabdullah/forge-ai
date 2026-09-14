import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AlertList from '@components/AlertList.jsx'
import Footer from '@components/Footer.jsx'
import GraphStage from '@components/GraphStage.jsx'
import Hero from '@components/Hero.jsx'
import InvestigatePanel from '@components/InvestigatePanel.jsx'
import Legend from '@components/Legend.jsx'
import NodeCard from '@components/NodeCard.jsx'
import Section from '@components/Section.jsx'
import SiteNav from '@components/SiteNav.jsx'
import StatsPanel from '@components/StatsPanel.jsx'

import { useGraphData } from '@/hooks/useGraphData.js'
import { useSmoothScroll } from '@/hooks/useSmoothScroll.js'

const number = (value) => (value == null ? '—' : value.toLocaleString('en-US'))

const SIGNATURES = [
  {
    id: 'price_undercut',
    title: 'Price undercut',
    body: 'Sells 35–55% below the category baseline — dumped or relabelled stock undercutting genuine supply.',
  },
  {
    id: 'price_inflated',
    title: 'Price inflated',
    body: 'Charges 2.6–4.0× the baseline, consistent with fake goods sold as premium originals.',
  },
  {
    id: 'region_mismatch',
    title: 'Region mismatch',
    body: 'Most downstream sales land outside the region the distributor declares. Goods are re-routed.',
  },
  {
    id: 'burst_timing',
    title: 'Burst timing',
    body: 'Volume compresses into ~10 days instead of an even yearly cadence — one undocumented batch.',
  },
  {
    id: 'mixed',
    title: 'Mixed',
    body: 'Mild undercut, partial out-of-region sales, two short bursts. No single signal dominates.',
  },
]

const MODEL_STEPS = [
  {
    n: '01',
    title: 'Heterogeneous graph',
    body: 'Manufacturers, distributors and retailers as node types. Directed transacts edges carry quantity, price and timestamp.',
  },
  {
    n: '02',
    title: 'Two-layer GraphSAGE',
    body: 'Wrapped with to_hetero so message passing stays native to HeteroData. Reverse edges send sell-side signals back onto distributors.',
  },
  {
    n: '03',
    title: 'Supervised risk head',
    body: 'Binary labels from the injected anomalies. Class-weighted BCE, 70/30 split on both classes, probability in [0, 1].',
  },
]

function signalsFor(node, edges) {
  if (!node) return []
  const outgoing = edges.filter((edge) => edge.source === node.id)
  const incoming = edges.filter((edge) => edge.target === node.id)
  const signals = []

  if (node.isFlagged) {
    signals.push('Predicted probability ≥ 0.5 — flagged as a counterfeit injection point')
  } else if (node.riskBand === 'high') {
    signals.push('Elevated risk, still below the 0.5 flag threshold')
  }

  if (outgoing.length) {
    const mean = outgoing.reduce((sum, edge) => sum + Number(edge.price || 0), 0) / outgoing.length
    signals.push(`${outgoing.length} downstream sales · mean unit price ${mean.toFixed(2)}`)
  }
  if (incoming.length) {
    signals.push(`${incoming.length} upstream shipments`)
  }
  if (node.product || node.region) {
    signals.push([node.product, node.region].filter(Boolean).join(' · '))
  }
  return signals
}

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

export default function App() {
  const lenisRef = useSmoothScroll()

  const { nodes, edges, status, error, stats } = useGraphData()
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const sceneApiRef = useRef(null)

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedSignals = useMemo(
    () => signalsFor(selectedNode, edges),
    [selectedNode, edges],
  )
  const flaggedNodes = useMemo(
    () => nodes.filter((node) => node.isFlagged),
    [nodes],
  )

  const jump = useCallback(
    (id) => {
      const lenis = lenisRef.current
      if (!lenis) return
      if (id === 'hero') lenis.scrollTo(0, { duration: 1.1 })
      else lenis.scrollTo(`#${id}`, { offset: -72, duration: 1.1 })
    },
    [lenisRef],
  )

  const selectFromScene = useCallback((id) => {
    setSelectedNodeId(id)
    if (id && isMobile()) setSheetOpen(true)
  }, [])

  const selectFromList = useCallback((id) => {
    setSelectedNodeId(id)
    sceneApiRef.current?.focusNode?.(id)
    if (isMobile()) setSheetOpen(true)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
    sceneApiRef.current?.setSelected?.(null)
    sceneApiRef.current?.resetView?.()
  }, [])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const openAlerts = useCallback(() => {
    if (isMobile()) setSheetOpen(true)
    else jump('workspace')
  }, [jump])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (sheetOpen) closeSheet()
      else clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection, closeSheet, sheetOpen])

  const heroStats = [
    { label: 'nodes', value: number(stats?.nodes) },
    { label: 'transactions', value: number(stats?.edges) },
    { label: 'flagged', value: number(stats?.flagged) },
    { label: 'regions', value: number(stats?.regions?.length) },
  ]

  const inspector = (
    <>
      <div className="pointer-events-auto absolute top-24 left-6 hidden w-72 md:block">
        <Legend />
      </div>
      {selectedNode && (
        <div className="pointer-events-auto absolute top-24 right-6 hidden w-80 md:block">
          <NodeCard node={selectedNode} signals={selectedSignals} onClose={clearSelection} />
        </div>
      )}
    </>
  )

  return (
    <main className="min-h-screen bg-ink-900">
      <SiteNav onJump={jump} onAlerts={openAlerts} flagged={stats?.flagged} />

      <Hero
        eyebrow="CounterfeitTrace"
        title="Find the counterfeit injection point."
        subtitle="A graph neural network scores every node in a medicines, seeds, fertilizer and electronics distribution network — surfacing the price, region and timing fingerprints that give a bad actor away."
        stats={heroStats}
        stage={
          <GraphStage
            nodes={nodes}
            edges={edges}
            status={status}
            error={error}
            selectedId={selectedNodeId}
            onSelect={selectFromScene}
            sceneRef={sceneApiRef}
          />
        }
        overlay={inspector}
      />

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="pointer-events-auto fixed right-4 bottom-4 z-30 rounded-full border border-risk-flagged/40 bg-ink-800/90 px-4 py-2 font-mono text-xs text-risk-flagged shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
      >
        Alerts · {number(stats?.flagged)}
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close alerts"
            className="absolute inset-0 bg-ink-950/60"
            onClick={closeSheet}
          />
          <div className="sheet-enter pointer-events-auto absolute inset-x-0 bottom-0 max-h-[78vh] space-y-3 overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900/95 p-4 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
            <AlertList
              nodes={nodes}
              selectedId={selectedNodeId}
              onSelect={selectFromList}
              listClassName="max-h-[min(50vh,24rem)]"
            />
            {selectedNode && (
              <NodeCard node={selectedNode} signals={selectedSignals} onClose={clearSelection} />
            )}
          </div>
        </div>
      )}

      <Section
        id="network"
        eyebrow="The network"
        title="A year of goods, three layers, one graph."
        kicker="Manufacturers sell to distributors, distributors sell to retailers. Regions cluster on each plane so a mismatch sits visibly outside its declared home."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              type: 'manufacturer',
              count: stats?.byType?.manufacturer,
              note: 'Source plants. Wholesale lots, even cadence.',
              tone: 'text-node-manufacturer',
            },
            {
              type: 'distributor',
              count: stats?.byType?.distributor,
              note: 'The injection layer. Where the sixteen labels live.',
              tone: 'text-node-distributor',
            },
            {
              type: 'retailer',
              count: stats?.byType?.retailer,
              note: 'Last mile. Downstream of every scored sale.',
              tone: 'text-node-retailer',
            },
          ].map((layer) => (
            <article
              key={layer.type}
              data-reveal
              className="rounded-2xl border border-white/10 bg-ink-800/40 p-5"
            >
              <p className={`font-mono text-[11px] tracking-[0.2em] uppercase ${layer.tone}`}>
                {layer.type}
              </p>
              <p className="mt-3 font-mono text-3xl text-white">{number(layer.count)}</p>
              <p className="mt-2 text-sm text-slate-500">{layer.note}</p>
            </article>
          ))}
        </div>
        <div className="mt-4" data-reveal>
          <StatsPanel nodes={stats?.nodes} edges={stats?.edges} flagged={stats?.flagged} />
        </div>
      </Section>

      <Section
        id="signatures"
        eyebrow="How counterfeits hide"
        title="Five sell-side signatures. Upstream stays clean."
        kicker="Counterfeiters still buy genuine stock. The tell is on the way out: price, territory, timing — or a quiet mix of all three."
      >
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNATURES.map((item, index) => (
            <li
              key={item.id}
              data-reveal
              className={`rounded-2xl border border-white/10 bg-ink-800/40 p-5 ${
                index === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <p className="font-mono text-[11px] text-slate-600">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-2 text-lg text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="model"
        eyebrow="The model"
        title="Hetero-SAGE, trained on the labels we planted."
        kicker="Supervised on purpose: the synthetic labels are under our control, so a binary head is more reliable for a demo than unsupervised detection."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {MODEL_STEPS.map((step) => (
            <article
              key={step.n}
              data-reveal
              className="rounded-2xl border border-white/10 bg-ink-800/40 p-5"
            >
              <p className="font-mono text-[11px] text-risk-flagged">{step.n}</p>
              <h3 className="mt-2 text-lg text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="workspace"
        eyebrow="Workspace"
        title="Ranked alerts, one node at a time."
        kicker="Pick a distributor to fly the camera and read the score. The 3D graph stays mounted in the hero — this is the desk beside it."
      >
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div data-reveal className="hidden md:block">
            <AlertList nodes={nodes} selectedId={selectedNodeId} onSelect={selectFromList} />
          </div>
          <div data-reveal className="hidden md:block">
            {selectedNode ? (
              <NodeCard node={selectedNode} signals={selectedSignals} onClose={clearSelection} />
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-ink-800/20 p-8 text-sm text-slate-500">
                Select a node in the graph or an alert on the left.
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 md:hidden" data-reveal>
            On this screen, open Alerts from the chip on the graph. The list is a
            bottom sheet so the network stays orbitable.
          </p>
        </div>
      </Section>

      <Section
        id="investigate"
        eyebrow="Investigate"
        title="Ask why this node is flagged."
        kicker="The browser posts the inspector context to /api/investigate. Gemini or Groq answers; PRISM stores the trace. Keys stay on the server."
      >
        <InvestigatePanel
          node={selectedNode}
          signals={selectedSignals}
          edges={edges}
          flagged={flaggedNodes}
          onSelect={selectFromList}
        />
      </Section>

      <Footer />
    </main>
  )
}
