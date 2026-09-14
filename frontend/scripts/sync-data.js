/**
 * Copies the generated dataset from /data (and model scores) into
 * frontend/public/data/ so Vite serves them as static assets.
 *
 * Runs automatically before `dev` and `build` (npm pre-hooks).
 * The destination is git-ignored — /data and /model are the source of truth.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function findRepoRoot() {
  const guesses = [join(here, '..', '..'), join(process.cwd(), '..'), process.cwd()]
  for (const root of guesses) {
    if (
      existsSync(join(root, 'data', 'nodes.csv')) &&
      existsSync(join(root, 'model', 'predictions.csv'))
    ) {
      return root
    }
  }
  return guesses[0]
}

const repoRoot = findRepoRoot()
const targetDir = join(here, '..', 'public', 'data')

const FILES = [
  { file: 'nodes.csv', from: join(repoRoot, 'data', 'nodes.csv') },
  { file: 'edges.csv', from: join(repoRoot, 'data', 'edges.csv') },
  { file: 'predictions.csv', from: join(repoRoot, 'model', 'predictions.csv') },
]

mkdirSync(targetDir, { recursive: true })

const copied = []
for (const { file, from } of FILES) {
  if (!existsSync(from)) {
    const hint =
      file === 'predictions.csv'
        ? 'run: python model/train_gnn.py'
        : 'run: python data/generate_transactions.py'
    console.warn(`[sync-data] ${file} not found — ${hint}`)
    continue
  }
  copyFileSync(from, join(targetDir, file))
  copied.push(file)
}

if (copied.length) {
  console.log(`[sync-data] copied ${copied.join(', ')} → frontend/public/data/`)
}
