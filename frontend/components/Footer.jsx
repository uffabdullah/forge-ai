/**
 * Footer — closing strip for the landing page.
 *
 * Skiper UI / Unlumen-style: no logo lockup, just type on ink.
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-slate-500 uppercase">
            CounterfeitTrace
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            A synthetic supply-chain graph scored by a heterogeneous GraphSAGE
            classifier. Demo data, not a production screening system.
          </p>
        </div>
        <p className="font-mono text-[11px] text-slate-600">© 2026</p>
      </div>
    </footer>
  )
}
