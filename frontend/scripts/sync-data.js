/**
 * Copies the generated dataset from /data into frontend/public/data/ so Vite
 * serves it as a static asset and the graph can load without a backend.
 *
 * Runs automatically before `dev` and `build` (npm pre-hooks), which keeps the
 * copies in step when the generator is re-run with a different --seed.
 * The destination is git-ignored — /data is the source of truth.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, '..', '..', 'data')
const targetDir = join(here, '..', 'public', 'data')
const FILES = ['nodes.csv', 'edges.csv']

mkdirSync(targetDir, { recursive: true })

let copied = 0
for (const file of FILES) {
  const from = join(sourceDir, file)
  if (!existsSync(from)) {
    console.warn(`[sync-data] ${file} not found in /data — run: python data/generate_transactions.py`)
    continue
  }
  copyFileSync(from, join(targetDir, file))
  copied += 1
}

if (copied === FILES.length) {
  console.log(`[sync-data] copied ${FILES.join(', ')} → frontend/public/data/`)
}
