import { useGraphScene } from '@/hooks/useGraphScene.js'

/**
 * Container for the WebGL graph. Owns the mount element, hands the parsed data
 * to the imperative scene, and reports failure inline instead of leaving an
 * empty black hero. Data comes in as props (see `useGraphData` in App) so this
 * component stays a thin bridge between React state and the scene module.
 */
export default function GraphStage({ nodes, edges, status, error }) {
  const { mountRef, ready, error: sceneError } = useGraphScene({ nodes, edges })

  const failure = error || sceneError
  const pending = !failure && (status === 'loading' || !ready)

  return (
    <div className="relative h-full w-full">
      {/* The scene appends its own <canvas class="canvas-stage"> here. */}
      <div ref={mountRef} className="absolute inset-0" />

      {pending && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-xs tracking-widest text-slate-500 uppercase">
          loading transaction graph…
        </p>
      )}

      {failure && (
        <div className="absolute inset-x-0 top-1/2 mx-auto max-w-md -translate-y-1/2 text-center">
          <p className="font-mono text-xs tracking-widest text-risk-high uppercase">
            graph unavailable
          </p>
          <p className="mt-2 text-sm text-slate-400">{failure.message}</p>
        </div>
      )}
    </div>
  )
}
