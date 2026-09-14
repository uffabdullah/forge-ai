import { useEffect, useRef, useState } from 'react'

import { createGraphScene } from '@/three/graph3d.js'
import { readPalette } from '@/three/palette.js'

/**
 * Mounts the imperative Three.js scene against a container ref.
 *
 * This is the ref + useEffect + dispose pattern from frontend/README.md: React
 * owns the container element and the lifetime, the scene module owns everything
 * inside it. The effect re-runs only when the data identity changes, so
 * selecting a node or reading status from state never rebuilds the WebGL
 * context.
 *
 * @param {{nodes: Array, edges: Array, onSelect?: (id: string|null) => void}} data
 * @returns {{mountRef: React.RefObject<HTMLDivElement>, sceneRef: React.RefObject,
 *            ready: boolean, error: Error|null}}
 */
export function useGraphScene({ nodes, edges, onSelect }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return

    let scene
    try {
      scene = createGraphScene(mountRef.current, {
        nodes,
        edges,
        palette: readPalette(),
        onSelect: (id) => onSelectRef.current?.(id),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)))
      return
    }

    sceneRef.current = scene
    setReady(true)
    setError(null)

    return () => {
      sceneRef.current = null
      setReady(false)
      scene.dispose()
    }
  }, [nodes, edges])

  return { mountRef, sceneRef, ready, error }
}
