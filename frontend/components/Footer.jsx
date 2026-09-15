/**
 * Footer — credits for the team plus a quiet product line.
 */
export default function Footer() {
  return (
    <footer id="credits" className="scroll-mt-32 border-t border-white/10 px-6 py-20 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-[11px] tracking-[0.35em] text-white uppercase">
          CounterfeitTrace
        </p>
        <p className="mt-4 max-w-md text-sm text-slate-500">
          A synthetic supply-chain graph scored by a heterogeneous GraphSAGE
          classifier. Demo data, not a production screening system.
        </p>

        <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2">
          <div className="space-y-6 text-sm text-slate-300">
            <div>
              <p className="text-slate-400">Coded and Created by:</p>
              <p className="mt-1">Abdullah Asger Ali</p>
            </div>
            <div>
              <p className="text-slate-400">Ideation by:</p>
              <ul className="mt-1 space-y-1">
                <li>Apurav Ishwar</li>
                <li>Kandregula Hema Naga Kaushik</li>
                <li>Shubh Tiwari</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-slate-500 sm:text-right">
            First year VIT Vellore Computer Science Students
          </p>
        </div>
      </div>
    </footer>
  )
}
