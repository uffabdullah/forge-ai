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
 *
 * Selection (`setSelected`) only rewrites instance colours / edge vertex
 * colours — it never rebuilds the WebGL context.
 */

const NODE_RADIUS = 1.4
const EDGE_OPACITY = 0.22
const EDGE_DIM = 0.55 // how far edge colours are pulled toward the background
const DEFAULT_FRAME_PADDING = 1.18
const FLAG_SCALE = 1.32
const FLAG_PULSE = 0.16
const SELECT_SCALE = 1.48
const NON_NEIGHBOUR_DIM = 0.78

/**
 * @param {HTMLElement} container positioned, sized element to render into
 * @param {object} options
 * @param {Array<{id: string, type: string, region?: string, riskScore?: number|null, isFlagged?: boolean}>} options.nodes
 * @param {Array<{sourceIndex: number, targetIndex: number}>} options.edges
 * @param {Record<string, string>} options.palette colours read off :root
 * @param {(id: string|null) => void} [options.onSelect]
 * @returns {{domElement: HTMLCanvasElement, focusNode: (id: string) => boolean,
 *            resetView: () => void, setSelected: (id: string|null) => void,
 *            resize: () => void, dispose: () => void,
 *            stats: {nodes: number, edges: number}}}
 */
export function createGraphScene(container, { nodes = [], edges = [], palette, onSelect }) {
  if (!container) throw new Error('createGraphScene: container element is required')

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (cause) {
    throw new Error('WebGL is unavailable in this browser — the 3D graph cannot render.', { cause })
  }

  renderer.setClearAlpha(0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.classList.add('canvas-stage')
  container.appendChild(renderer.domElement)

  const { positions, center, radius } = computeLayeredLayout(nodes)
  const layout = { center: new THREE.Vector3(...center) }

  const scene = new THREE.Scene()

  const initialAspect = container.clientHeight ? container.clientWidth / container.clientHeight : 1
  const camera = new THREE.PerspectiveCamera(50, initialAspect, 0.1, radius * 40)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.8
  controls.enablePan = false
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.35
  controls.minDistance = radius * 0.3
  controls.maxDistance = radius * 4

  const hasScores = nodes.some((node) => node.riskScore != null)
  const flaggedIndices = []
  nodes.forEach((node, i) => {
    if (node.isFlagged) flaggedIndices.push(i)
  })

  // ---------------------------------------------------------------- nodes ---
  const nodeGeometry = new THREE.SphereGeometry(NODE_RADIUS, 14, 12)
  const nodeMaterial = new THREE.MeshBasicMaterial({ toneMapped: false })
  const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodes.length)
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const typeColors = {
    manufacturer: new THREE.Color(palette.manufacturer),
    distributor: new THREE.Color(palette.distributor),
    retailer: new THREE.Color(palette.retailer),
  }
  const fallbackColor = new THREE.Color(palette.distributor)
  const riskLow = new THREE.Color(palette.riskLow)
  const riskMedium = new THREE.Color(palette.riskMedium)
  const riskHigh = new THREE.Color(palette.riskHigh)
  const riskFlagged = new THREE.Color(palette.riskFlagged)
  const ink = new THREE.Color(palette.ink)

  function colorForNode(node) {
    const typeColor = typeColors[node.type] ?? fallbackColor
    if (!hasScores || node.riskScore == null) return typeColor.clone()
    if (node.isFlagged) return riskFlagged.clone()
    const score = node.riskScore
    if (score < 0.25) return riskLow.clone().lerp(riskMedium, score / 0.25)
    if (score < 0.5) return riskMedium.clone().lerp(riskHigh, (score - 0.25) / 0.25)
    return riskHigh.clone().lerp(riskFlagged, Math.min(1, (score - 0.5) / 0.5))
  }

  const baseNodeColors = nodes.map((node) => colorForNode(node))
  const dummy = new THREE.Object3D()
  const matrix = new THREE.Matrix4()

  nodes.forEach((node, i) => {
    matrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    nodeMesh.setMatrixAt(i, matrix)
    nodeMesh.setColorAt(i, baseNodeColors[i])
  })
  nodeMesh.instanceMatrix.needsUpdate = true
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true

  const graphGroup = new THREE.Group()
  graphGroup.add(nodeMesh)

  const neighborOf = nodes.map(() => new Set())
  edges.forEach((edge) => {
    neighborOf[edge.sourceIndex]?.add(edge.targetIndex)
    neighborOf[edge.targetIndex]?.add(edge.sourceIndex)
  })

  // ---------------------------------------------------------------- edges ---
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

    sourceColor.copy(baseNodeColors[edge.sourceIndex] ?? typeColors[nodes[edge.sourceIndex].type] ?? fallbackColor)
    targetColor.copy(baseNodeColors[edge.targetIndex] ?? typeColors[nodes[edge.targetIndex].type] ?? fallbackColor)
    sourceColor.lerp(ink, EDGE_DIM)
    targetColor.lerp(ink, EDGE_DIM)

    edgeColors[p] = sourceColor.r
    edgeColors[p + 1] = sourceColor.g
    edgeColors[p + 2] = sourceColor.b
    edgeColors[p + 3] = targetColor.r
    edgeColors[p + 4] = targetColor.g
    edgeColors[p + 5] = targetColor.b
  })

  const edgeColorsBase = edgeColors.slice()

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
  graphGroup.add(edgeLines)
  scene.add(graphGroup)

  // --------------------------------------------------------------- camera ---
  const viewDirection = new THREE.Vector3(0.55, 0.42, 1).normalize()

  function fitDistance() {
    const verticalFov = (camera.fov * Math.PI) / 180
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
    return (radius * DEFAULT_FRAME_PADDING) / Math.sin(Math.min(verticalFov, horizontalFov) / 2)
  }

  let homeDistance = fitDistance()
  const homeDirection = viewDirection.clone()
  let scrollProgress = 0
  let introScale = 0
  let introPlayed = false
  let cameraLocked = true
  const chapterDirs = [
    new THREE.Vector3(0.55, 0.42, 1).normalize(),
    new THREE.Vector3(0.82, 0.36, 0.72).normalize(),
    new THREE.Vector3(-0.12, 0.5, 1).normalize(),
    new THREE.Vector3(0.22, 0.28, 1).normalize(),
    new THREE.Vector3(0.68, 0.46, 0.35).normalize(),
  ]
  const chapterDir = new THREE.Vector3()

  camera.position.copy(layout.center).addScaledVector(homeDirection, homeDistance * 2.6)
  controls.target.copy(layout.center)
  controls.autoRotateSpeed = 0.9
  controls.update()

  scene.fog = new THREE.Fog(palette.ink, homeDistance * 0.75, homeDistance * 2.6)

  const flyTweens = []
  function flyTo(targetPosition, cameraPosition) {
    killFlights()
    controls.enabled = false
    cameraLocked = true

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
          cameraLocked = false
        },
      }),
    )
  }

  function killFlights() {
    flyTweens.forEach((tween) => tween.kill())
    flyTweens.length = 0
  }

  const nodePosition = new THREE.Vector3()
  let selectedIndex = -1
  const scratchColor = new THREE.Color()

  function applyHighlight() {
    const selected = selectedIndex
    const neighbors = selected >= 0 ? neighborOf[selected] : null

    for (let i = 0; i < nodes.length; i++) {
      scratchColor.copy(baseNodeColors[i])
      if (neighbors && i !== selected && !neighbors.has(i)) {
        scratchColor.lerp(ink, NON_NEIGHBOUR_DIM)
      }
      nodeMesh.setColorAt(i, scratchColor)
    }
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true

    const colors = edgeGeometry.attributes.color.array
    for (let e = 0; e < edges.length; e++) {
      const incident =
        selected < 0 || edges[e].sourceIndex === selected || edges[e].targetIndex === selected
      const p = e * 6
      if (selected >= 0 && !incident) {
        for (let k = 0; k < 6; k += 1) colors[p + k] = edgeColorsBase[p + k] * 0.12
      } else if (selected >= 0 && incident) {
        for (let k = 0; k < 6; k += 1) colors[p + k] = Math.min(1, edgeColorsBase[p + k] * 1.85)
      } else {
        for (let k = 0; k < 6; k += 1) colors[p + k] = edgeColorsBase[p + k]
      }
    }
    edgeGeometry.attributes.color.needsUpdate = true
  }

  /** Dim non-neighbours of `id`. Pass null to restore the full graph. */
  function setSelected(id) {
    selectedIndex = id == null ? -1 : nodes.findIndex((node) => node.id === id)
    applyHighlight()
  }

  /** Move the camera in tight on one node. @returns whether the id was found. */
  function focusNode(id) {
    const index = nodes.findIndex((node) => node.id === id)
    if (index === -1) return false

    nodePosition.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2])
    flyTo(nodePosition, nodePosition.clone().addScaledVector(viewDirection, radius * 0.45))
    return true
  }

  function resetView() {
    flyTo(layout.center, layout.center.clone().addScaledVector(homeDirection, homeDistance))
  }

  function setScrollProgress(progress) {
    scrollProgress = Math.min(1, Math.max(0, Number(progress) || 0))
  }

  function setHeroProgress(progress) {
    setScrollProgress(progress)
  }

  function cameraDirForScroll(out = chapterDir) {
    const last = chapterDirs.length - 1
    const t = scrollProgress * last
    const i = Math.min(Math.floor(t), last - 1)
    const f = t - i
    out.copy(chapterDirs[i]).lerp(chapterDirs[i + 1], f).normalize()
    return out
  }

  function applyScrollCamera() {
    const dir = cameraDirForScroll()
    const dist = homeDistance * (1.06 - scrollProgress * 0.2)
    camera.position.copy(layout.center).addScaledVector(dir, dist)
    controls.target.copy(layout.center)
    homeDirection.copy(dir)
  }

  function playIntro() {
    if (introPlayed) return
    introPlayed = true
    introScale = 0
    const scaleProxy = { v: 0 }
    camera.position.copy(layout.center).addScaledVector(homeDirection, homeDistance * 2.6)
    flyTweens.push(
      gsap.to(scaleProxy, {
        v: 1,
        duration: 1.8,
        ease: 'power3.out',
        onUpdate: () => {
          introScale = scaleProxy.v
        },
      }),
      gsap.to(camera.position, {
        x: layout.center.x + homeDirection.x * homeDistance,
        y: layout.center.y + homeDirection.y * homeDistance,
        z: layout.center.z + homeDirection.z * homeDistance,
        duration: 2.4,
        ease: 'power3.inOut',
        onComplete: () => {
          cameraLocked = false
        },
      }),
      gsap.to(controls, {
        autoRotateSpeed: 0.35,
        duration: 2.4,
        ease: 'power2.out',
      }),
    )
  }

  function setChapterView(index = 0) {
    if (userInteracted) return
    const dir = chapterDirs[index] ?? chapterDirs[0]
    homeDirection.copy(dir)
    flyTo(layout.center, layout.center.clone().addScaledVector(dir, homeDistance * 0.92))
  }

  // ------------------------------------------------------------ interaction ---
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let pointerDown = null
  let userInteracted = false
  const mouse = { x: 0, y: 0 }

  function onPointerDown(event) {
    pointerDown = { x: event.clientX, y: event.clientY }
    controls.autoRotate = false
    userInteracted = true
  }

  function onPointerUp(event) {
    if (!pointerDown) return
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
    pointerDown = null
    if (moved > 4) return

    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hit = raycaster.intersectObject(nodeMesh, false)[0]
    if (hit && hit.instanceId != null) {
      const id = nodes[hit.instanceId].id
      setSelected(id)
      focusNode(id)
      onSelect?.(id)
    } else {
      setSelected(null)
      resetView()
      onSelect?.(null)
    }
  }

  function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    mouse.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    mouse.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointermove', onPointerMove)

  // ----------------------------------------------------------------- loop ---
  let visible = true
  const tick = () => {
    if (!visible || document.hidden) return

    const t = performance.now() / 1000
    const targetYaw = mouse.x * 0.12 + scrollProgress * 0.42
    const targetPitch = mouse.y * 0.05 + Math.sin(scrollProgress * Math.PI) * 0.08
    graphGroup.rotation.y += (targetYaw - graphGroup.rotation.y) * 0.045
    graphGroup.rotation.x += (targetPitch - graphGroup.rotation.x) * 0.045

    if (!userInteracted && introPlayed && !cameraLocked) {
      applyScrollCamera()
    }

    for (let i = 0; i < nodes.length; i++) {
      let scale = introScale
      if (nodes[i].isFlagged) {
        scale *= FLAG_SCALE + Math.sin(t * 3.1 + i * 0.45) * FLAG_PULSE
      }
      if (i === selectedIndex) scale = Math.max(scale, SELECT_SCALE * introScale)
      dummy.position.set(
        positions[i * 3],
        positions[i * 3 + 1] + Math.sin(t * 0.7 + i * 0.31) * 0.35,
        positions[i * 3 + 2],
      )
      dummy.scale.setScalar(Math.max(0.001, scale))
      dummy.rotation.set(0, t * 0.15 + i * 0.01, 0)
      dummy.updateMatrix()
      nodeMesh.setMatrixAt(i, dummy.matrix)
    }
    nodeMesh.instanceMatrix.needsUpdate = true

    controls.update()
    renderer.render(scene, camera)
  }
  gsap.ticker.add(tick)

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

    if (userInteracted || !introPlayed) return

    homeDistance = fitDistance()
    if (!userInteracted && introPlayed && !cameraLocked) applyScrollCamera()
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
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    controls.dispose()

    nodeMesh.dispose()
    nodeGeometry.dispose()
    nodeMaterial.dispose()
    edgeGeometry.dispose()
    edgeMaterial.dispose()

    scene.remove(graphGroup)
    renderer.dispose()
    renderer.domElement.remove()
  }

  return {
    domElement: renderer.domElement,
    focusNode,
    resetView,
    setSelected,
    playIntro,
    setHeroProgress,
    setScrollProgress,
    setChapterView,
    resize,
    dispose,
    stats: { nodes: nodes.length, edges: edgeCount },
  }
}
