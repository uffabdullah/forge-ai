import { gsap } from 'gsap'
import * as THREE from 'three'
// three 0.186 exports "./addons/*" → examples/jsm/*, and it resolves to the same
// module instance as "three/examples/jsm/*" (verified), so no duplicate THREE copy.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { computeLayeredLayout } from './layout.js'

/**
 * Imperative Three.js scene for the transaction graph.
 *
 * React never re-renders the canvas: this module owns the renderer, the meshes
 * and the render loop, and React owns only the container element and the
 * lifetime of the returned handle. Everything allocated here is released in
 * `dispose()`, so StrictMode's double-mount and HMR cannot leak a second
 * WebGL context.
 */

const NODE_RADIUS = 1.4
const EDGE_OPACITY = 0.22
const EDGE_DIM = 0.55 // how far edge colours are pulled toward the background
const DEFAULT_FRAME_PADDING = 1.18

/**
 * @param {HTMLElement} container positioned, sized element to render into
 * @param {object} options
 * @param {Array<{id: string, type: string, region?: string}>} options.nodes
 * @param {Array<{sourceIndex: number, targetIndex: number}>} options.edges
 * @param {Record<string, string>} options.palette colours read off :root
 * @returns {{domElement: HTMLCanvasElement, focusNode: (id: string) => boolean,
 *            resetView: () => void, resize: () => void, dispose: () => void,
 *            stats: {nodes: number, edges: number}}}
 */
export function createGraphScene(container, { nodes = [], edges = [], palette }) {
  if (!container) throw new Error('createGraphScene: container element is required')

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (cause) {
    throw new Error('WebGL is unavailable in this browser — the 3D graph cannot render.', { cause })
  }

  // Transparent clear so the hero's background and vignette show through.
  renderer.setClearAlpha(0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.classList.add('canvas-stage')
  container.appendChild(renderer.domElement)

  const { positions, center, radius } = computeLayeredLayout(nodes)
  const layout = { center: new THREE.Vector3(...center) }

  const scene = new THREE.Scene()

  // Seed the aspect from the container now: framing computed against the
  // camera's default aspect of 1 clips the outer layers on a portrait hero.
  const initialAspect = container.clientHeight ? container.clientWidth / container.clientHeight : 1
  const camera = new THREE.PerspectiveCamera(50, initialAspect, 0.1, radius * 40)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.8
  controls.enablePan = false // keep the graph centred; orbit + zoom is enough
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.35
  controls.minDistance = radius * 0.3
  controls.maxDistance = radius * 4

  // ---------------------------------------------------------------- nodes ---
  const nodeGeometry = new THREE.SphereGeometry(NODE_RADIUS, 14, 12)
  // MeshBasicMaterial (unlit) keeps each instance exactly the type colour from
  // the palette; depth comes from the fog and the orbit, not from shading.
  const nodeMaterial = new THREE.MeshBasicMaterial({ toneMapped: false })
  const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodes.length)
  nodeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  const typeColors = {
    manufacturer: new THREE.Color(palette.manufacturer),
    distributor: new THREE.Color(palette.distributor),
    retailer: new THREE.Color(palette.retailer),
  }
  const fallbackColor = new THREE.Color(palette.distributor)

  const matrix = new THREE.Matrix4()
  nodes.forEach((node, i) => {
    matrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    nodeMesh.setMatrixAt(i, matrix)
    nodeMesh.setColorAt(i, typeColors[node.type] ?? fallbackColor)
  })
  nodeMesh.instanceMatrix.needsUpdate = true
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true
  scene.add(nodeMesh)

  // ---------------------------------------------------------------- edges ---
  // One LineSegments holding every transaction: 2 vertices per edge, coloured
  // from source type → target type so the flow direction is readable.
  const edgeCount = edges.length
  const edgePositions = new Float32Array(edgeCount * 6)
  const edgeColors = new Float32Array(edgeCount * 6)
  const sourceColor = new THREE.Color()
  const targetColor = new THREE.Color()

  edges.forEach((edge, i) => {
    const a = edge.sourceIndex * 3
    const b = edge.targetIndex * 3
    const p = i * 6

    edgePositions[p] = positions[a]
    edgePositions[p + 1] = positions[a + 1]
    edgePositions[p + 2] = positions[a + 2]
    edgePositions[p + 3] = positions[b]
    edgePositions[p + 4] = positions[b + 1]
    edgePositions[p + 5] = positions[b + 2]

    sourceColor.copy(typeColors[nodes[edge.sourceIndex].type] ?? fallbackColor)
    targetColor.copy(typeColors[nodes[edge.targetIndex].type] ?? fallbackColor)
    sourceColor.lerp(new THREE.Color(palette.ink), EDGE_DIM)
    targetColor.lerp(new THREE.Color(palette.ink), EDGE_DIM)

    edgeColors[p] = sourceColor.r
    edgeColors[p + 1] = sourceColor.g
    edgeColors[p + 2] = sourceColor.b
    edgeColors[p + 3] = targetColor.r
    edgeColors[p + 4] = targetColor.g
    edgeColors[p + 5] = targetColor.b
  })

  const edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3))
  const edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: EDGE_OPACITY,
    depthWrite: false,
  })
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
  scene.add(edgeLines)

  // --------------------------------------------------------------- camera ---
  const viewDirection = new THREE.Vector3(0.55, 0.42, 1).normalize()

  /** Distance at which the bounding sphere fits the *narrower* of the two FOVs. */
  function fitDistance() {
    const verticalFov = (camera.fov * Math.PI) / 180
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
    return (radius * DEFAULT_FRAME_PADDING) / Math.sin(Math.min(verticalFov, horizontalFov) / 2)
  }

  let homeDistance = fitDistance()

  camera.position.copy(layout.center).addScaledVector(viewDirection, homeDistance)
  controls.target.copy(layout.center)
  controls.update()

  // Fog is the only depth cue (nodes are unlit), so it has to sit beyond the
  // home framing — scaled off the camera distance, not the bounding radius,
  // otherwise the far layer washes out to background colour.
  scene.fog = new THREE.Fog(palette.ink, homeDistance * 0.75, homeDistance * 2.6)

  const flyTweens = []
  function flyTo(targetPosition, cameraPosition) {
    killFlights()
    controls.enabled = false

    flyTweens.push(
      gsap.to(camera.position, {
        x: cameraPosition.x,
        y: cameraPosition.y,
        z: cameraPosition.z,
        duration: 0.9,
        ease: 'power2.inOut',
      }),
      gsap.to(controls.target, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 0.9,
        ease: 'power2.inOut',
        onComplete: () => {
          controls.enabled = true
        },
      }),
    )
  }

  function killFlights() {
    flyTweens.forEach((tween) => tween.kill())
    flyTweens.length = 0
  }

  const nodePosition = new THREE.Vector3()

  /** Move the camera in tight on one node. @returns whether the id was found. */
  function focusNode(id) {
    const index = nodes.findIndex((node) => node.id === id)
    if (index === -1) return false

    nodePosition.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2])
    flyTo(nodePosition, nodePosition.clone().addScaledVector(viewDirection, radius * 0.45))
    return true
  }

  /** Return to the full-network framing. */
  function resetView() {
    flyTo(layout.center, layout.center.clone().addScaledVector(viewDirection, homeDistance))
  }

  // ------------------------------------------------------------ interaction ---
  // Click a node to fly to it, click empty space to zoom back out. This is the
  // browse affordance until the model supplies risk scores to filter on.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let pointerDown = null
  let userInteracted = false

  function onPointerDown(event) {
    pointerDown = { x: event.clientX, y: event.clientY }
    controls.autoRotate = false // the user has taken over
    userInteracted = true
  }

  function onPointerUp(event) {
    if (!pointerDown) return
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
    pointerDown = null
    if (moved > 4) return // that was an orbit drag, not a click

    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hit = raycaster.intersectObject(nodeMesh, false)[0]
    if (hit && hit.instanceId != null) focusNode(nodes[hit.instanceId].id)
    else resetView()
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  // ----------------------------------------------------------------- loop ---
  // Driven by GSAP's ticker so the scene shares one rAF loop with Lenis and
  // ScrollTrigger instead of adding a competing one.
  let visible = true
  const tick = () => {
    if (!visible || document.hidden) return
    controls.update()
    renderer.render(scene, camera)
  }
  gsap.ticker.add(tick)

  // Stop rendering once the hero scrolls out of view — the page has long story
  // sections below it and an idle WebGL loop is pure battery drain.
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting
          },
          { threshold: 0 },
        )
  observer?.observe(container)

  function resize() {
    const { clientWidth: width, clientHeight: height } = container
    if (width === 0 || height === 0) return

    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    // Keep the whole network framed across viewport changes — but only until
    // the user has orbited, after which their viewpoint is theirs to keep.
    if (userInteracted) return

    homeDistance = fitDistance()
    camera.position.copy(layout.center).addScaledVector(viewDirection, homeDistance)
    scene.fog.near = homeDistance * 0.75
    scene.fog.far = homeDistance * 2.6
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  resizeObserver?.observe(container)
  resize()

  function dispose() {
    gsap.ticker.remove(tick)
    killFlights()
    observer?.disconnect()
    resizeObserver?.disconnect()
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    controls.dispose()

    nodeMesh.dispose()
    nodeGeometry.dispose()
    nodeMaterial.dispose()
    edgeGeometry.dispose()
    edgeMaterial.dispose()

    scene.remove(nodeMesh, edgeLines)
    renderer.dispose()
    renderer.domElement.remove()
  }

  return {
    domElement: renderer.domElement,
    focusNode,
    resetView,
    resize,
    dispose,
    stats: { nodes: nodes.length, edges: edgeCount },
  }
}
