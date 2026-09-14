/**
 * Deterministic 3D layout for the supply-chain graph.
 *
 * The graph is a DAG in practice (manufacturer → distributor → retailer), so a
 * force simulation would just rediscover the layers — and at 1k+ nodes it is
 * slow, non-deterministic and needs a new dependency. Instead we place the
 * three node types on fixed parallel planes along X, which makes the direction
 * of goods flow readable at a glance, and cluster each plane by region so a
 * `region_mismatch` node visibly sits in the wrong cluster later on.
 */

/** Supply-chain order; index becomes the layer position along X. */
export const LAYERS = ['manufacturer', 'distributor', 'retailer']

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // ~137.5°, even spiral packing

const DEFAULTS = {
  layerSpacing: 46, // gap between the three planes
  innerRadius: 5, // first node's distance from the layer's axis
  spacing: 5.5, // radial step between successive nodes in a region
}

/**
 * @param {Array<{id: string, type: string, region?: string}>} nodes
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{positions: Float32Array, center: [number,number,number], radius: number,
 *            layerOf: number[], layerSpacing: number, nodeSpacing: number}}
 *   `positions` is a flat xyz buffer (length = nodes.length * 3) ready for
 *   InstancedMesh matrices; `radius` is the bounding-sphere radius for camera framing.
 */
export function computeLayeredLayout(nodes, options = {}) {
  const { layerSpacing, innerRadius, spacing } = { ...DEFAULTS, ...options }

  const positions = new Float32Array(nodes.length * 3)
  const layerOf = new Array(nodes.length)

  if (nodes.length === 0) {
    return { positions, center: [0, 0, 0], radius: 1, layerOf, layerSpacing, nodeSpacing: spacing }
  }

  // Bucket by layer, and within a layer by region, so each region can own an
  // angular sector. Sorting keeps output stable across runs and reloads.
  const buckets = new Map()
  nodes.forEach((node, index) => {
    const layer = layerIndexFor(node.type)
    layerOf[index] = layer

    if (!buckets.has(layer)) buckets.set(layer, new Map())
    const regions = buckets.get(layer)
    const region = node.region || 'unknown'
    if (!regions.has(region)) regions.set(region, [])
    regions.get(region).push({ index, id: node.id })
  })

  let maxDistance = 0

  for (const [layer, regions] of buckets) {
    const x = (layer - (LAYERS.length - 1) / 2) * layerSpacing
    const regionNames = [...regions.keys()].sort()
    const sector = (Math.PI * 2) / regionNames.length

    // Nodes closest to the origin sit on the layer axis, so a region's angular
    // sector is centred on it.
    const sectorOffset = regions.size > 1 ? sector / 2 : 0

    regionNames.forEach((regionName, regionIndex) => {
      const members = regions.get(regionName).sort((a, b) => a.id.localeCompare(b.id))
      const baseAngle = regionIndex * sector - sectorOffset

      members.forEach((member, i) => {
        const angle = baseAngle + i * GOLDEN_ANGLE * (sector / (Math.PI * 2))
        const radius = innerRadius + spacing * Math.sqrt(i)
        const y = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius

        positions[member.index * 3] = x
        positions[member.index * 3 + 1] = y
        positions[member.index * 3 + 2] = z

        maxDistance = Math.max(maxDistance, Math.hypot(x, y, z))
      })
    })
  }

  return {
    positions,
    center: [0, 0, 0],
    radius: Math.max(maxDistance, 1) + spacing,
    layerOf,
    layerSpacing,
    nodeSpacing: spacing,
  }
}

/** Unknown types are pushed to their own plane behind the known ones. */
export function layerIndexFor(type) {
  const index = LAYERS.indexOf(type)
  return index === -1 ? LAYERS.length : index
}
