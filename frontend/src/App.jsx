import GraphStage from '@components/GraphStage.jsx'
import Hero from '@components/Hero.jsx'

import { useGraphData } from '@/hooks/useGraphData.js'
import { useSmoothScroll } from '@/hooks/useSmoothScroll.js'

const STACK = [
  ['three', 'InstancedMesh nodes + LineSegments edges, mounted imperatively'],
  ['gsap', 'drives the render loop ticker; ScrollTrigger timelines for reveals'],
  ['lenis', 'smooth scrolling, happy sharing the ticker with the scene'],
  ['papaparse', 'parses the transaction CSVs into the scene shape'],
  ['rive', 'vector accents — risk pulse, counterfeit stamp (next)'],
  ['skiper / unlumen', 'React + Tailwind components in frontend/components'],
]

const number = (value) => (value == null ? '—' : value.toLocaleString('en-US'))

export default function App() {
  // Lenis + ScrollTrigger own the page scroll; components stay declarative.
  useSmoothScroll()

  // The graph is fetched here so the hero can show real counts and the stage
  // component stays a thin bridge to the imperative scene.
  const { nodes, edges, status, error, stats } = useGraphData()

  const heroStats = [
    { label: 'nodes', value: number(stats?.nodes) },
    { label: 'transactions', value: number(stats?.edges) },
    { label: 'regions', value: number(stats?.regions?.length) },
    { label: 'node types', value: number(stats ? Object.keys(stats.byType).length : null) },
  ]

  return (
    <main className="min-h-screen bg-ink-900">
      <Hero
        eyebrow="CounterfeitTrace"
        title="Find the counterfeit injection point."
        subtitle="A graph neural network scores every node in a medicines, seeds, fertilizer and electronics distribution network — surfacing the price, region and timing fingerprints that give a bad actor away."
        stats={heroStats}
        stage={<GraphStage nodes={nodes} edges={edges} status={status} error={error} />}
      />

      <section className="mx-auto max-w-3xl px-6 pb-32">
        <h2 className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
          Stack wiring
        </h2>

        <ul className="mt-6 divide-y divide-ink-700 border-y border-ink-700">
          {STACK.map(([name, note]) => (
            <li key={name} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-40 shrink-0 font-mono text-sm text-node-manufacturer">{name}</span>
              <span className="text-sm text-slate-400">{note}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-slate-500">
          Risk highlighting and the alert list land once the model produces scores — see{' '}
          <code className="font-mono text-slate-400">frontend/README.md</code> for the file map.
        </p>
      </section>
    </main>
  )
}
