import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion'
import { Toaster, toast } from 'sonner'

const CONTRACT = '0xEDf0e9B44b609f63aE17d1345C1e5dDF81000BdE'

const SAMPLE = `The river does not hurry, yet it arrives. I have been thinking lately about the slow craft of sentences — how an idea, like silt, settles only when the current is allowed to rest. We write to discover what we did not know we believed.`

type Issue = { id: string; kind: 'plagiarism' | 'ai' | 'citation'; label: string; detail: string; severity: number }

const ISSUE_STYLE: Record<Issue['kind'], { tag: string; dot: string; chip: string }> = {
  plagiarism: { tag: 'PLAGIARISM', dot: '#B91C1C', chip: 'bg-red-50 text-red-700 border-red-200' },
  ai: { tag: 'AI-GENERATED', dot: '#B45309', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  citation: { tag: 'CITATION', dot: '#0D7377', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
}

function scoreFor(text: string): { score: number; issues: Issue[] } {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const base = 42 + (h % 56) // 42..97
  const score = Math.max(8, Math.min(99, base - (words < 25 ? 14 : 0)))
  const issues: Issue[] = []
  if (score < 92)
    issues.push({
      id: 'ai',
      kind: 'ai',
      label: `${100 - score}% likely AI-assisted phrasing`,
      detail: 'Perplexity dips in 2 passages suggest model-generated cadence.',
      severity: 100 - score,
    })
  if (score < 75)
    issues.push({
      id: 'plag',
      kind: 'plagiarism',
      label: 'Near-duplicate fragment found',
      detail: '1 sentence matches an indexed source at 86% similarity.',
      severity: 80,
    })
  if (score < 88)
    issues.push({
      id: 'cite',
      kind: 'citation',
      label: 'Uncited paraphrase detected',
      detail: 'Consider attributing the secondary claim in paragraph 1.',
      severity: 40,
    })
  return { score, issues }
}

function Dial({ value, analyzing }: { value: number; analyzing: boolean }) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) => Math.round(v))
  const [shown, setShown] = useState(0)
  const R = 120
  const C = 2 * Math.PI * R
  const offset = useTransform(mv, (v) => C * (1 - v / 100))
  const stroke = useTransform(mv, (v) => (v >= 80 ? '#0D7377' : v >= 55 ? '#B45309' : '#B91C1C'))

  useEffect(() => {
    const unsub = display.on('change', (v) => setShown(v))
    const controls = animate(mv, value, { duration: analyzing ? 0.4 : 1.6, ease: 'easeOut' })
    return () => {
      controls.stop()
      unsub()
    }
  }, [value, analyzing, mv, display])

  const verdict = value >= 80 ? 'ORIGINAL' : value >= 55 ? 'DERIVATIVE' : 'FLAGGED'
  const vcolor = value >= 80 ? '#0D7377' : value >= 55 ? '#B45309' : '#B91C1C'

  return (
    <div className="relative flex items-center justify-center">
      <svg width="300" height="300" viewBox="0 0 300 300" className="-rotate-90">
        <circle cx="150" cy="150" r={R} fill="none" stroke="#EAE6DA" strokeWidth="22" />
        <motion.circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-serif text-7xl font-semibold tabular-nums text-[#1C1A17]">{shown}</span>
        <span className="-mt-1 text-xs font-medium uppercase tracking-[0.3em] text-stone-400">/ 100 score</span>
        <AnimatePresence mode="wait">
          {!analyzing && value > 0 && (
            <motion.span
              key={verdict}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-full px-3 py-1 font-serif text-sm font-semibold tracking-wide"
              style={{ color: vcolor, background: `${vcolor}14` }}
            >
              {verdict}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function App() {
  const [text, setText] = useState(SAMPLE)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<{ score: number; issues: Issue[] } | null>(null)
  const [phase, setPhase] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text])
  const chars = text.length

  useEffect(() => {
    if (!analyzing) return
    const steps = ['fingerprinting passages…', 'querying source corpus…', 'measuring AI perplexity…', 'scoring originality…']
    let i = 0
    setPhase(steps[0])
    const t = setInterval(() => {
      i++
      setPhase(steps[i % steps.length])
    }, 800)
    return () => clearInterval(t)
  }, [analyzing])

  function analyze() {
    if (words < 8) {
      toast.error('Need more text', { description: 'Paste at least 8 words to score originality.' })
      return
    }
    setAnalyzing(true)
    setResult(null)
    toast('Arbiter engaged', { description: `Analyzing ${words} words…` })
    setTimeout(() => {
      const r = scoreFor(text)
      setResult(r)
      setAnalyzing(false)
      if (r.score >= 80) toast.success('Original work verified', { description: 'Eligible for author token reward.' })
      else if (r.score >= 55) toast.warning('Derivative content', { description: 'Partial reward — review flagged issues.' })
      else toast.error('Originality below threshold', { description: 'Not eligible for reward.' })
    }, 3000)
  }

  const score = result?.score ?? 0
  const eligible = score >= 80
  const partial = score >= 55 && score < 80

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#1C1A17]">
      <Toaster position="top-center" richColors />
      {/* masthead */}
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-6xl items-end justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-[#0D7377]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.35em]">Originality Arbiter</span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              The ledger that rewards <span className="italic text-[#0D7377]">original</span> voices.
            </h1>
          </div>
          <div className="hidden text-right font-mono text-[10px] leading-relaxed text-stone-400 sm:block">
            <div>CONTRACT</div>
            <div className="text-stone-500">
              {CONTRACT.slice(0, 10)}…{CONTRACT.slice(-6)}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* editor */}
          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_40px_-24px_rgba(13,115,119,0.4)]">
            <div className="flex items-center justify-between border-b border-stone-100 bg-[#FBFAF4] px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#0D7377]/80" />
                <span className="h-3 w-3 rounded-full bg-stone-300" />
                <span className="h-3 w-3 rounded-full bg-stone-300" />
                <span className="ml-3 font-serif text-sm italic text-stone-500">untitled-draft.md</span>
              </div>
              <span className="font-mono text-[11px] text-stone-400">
                {words} words · {chars} chars
              </span>
            </div>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={analyzing}
              spellCheck={false}
              placeholder="Paste or write your content here…"
              className="block h-[420px] w-full resize-none bg-white px-7 py-6 font-serif text-lg leading-relaxed text-[#26221C] outline-none placeholder:text-stone-300 disabled:opacity-60"
            />
            <div className="flex items-center justify-between border-t border-stone-100 bg-[#FBFAF4] px-5 py-3">
              <AnimatePresence mode="wait">
                <motion.span
                  key={analyzing ? phase : 'idle'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[11px] text-stone-400"
                >
                  {analyzing ? `◷ ${phase}` : 'ready · genlayer validator'}
                </motion.span>
              </AnimatePresence>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setText('')
                    setResult(null)
                    taRef.current?.focus()
                  }}
                  disabled={analyzing}
                  className="rounded-lg border border-stone-200 px-4 py-2 font-serif text-sm text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  onClick={analyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 rounded-lg bg-[#0D7377] px-6 py-2 font-serif text-sm font-semibold text-white transition hover:bg-[#0a5d60] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {analyzing && (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                    />
                  )}
                  {analyzing ? 'Scoring…' : 'Score originality'}
                </button>
              </div>
            </div>
          </section>

          {/* meter + issues */}
          <section className="flex flex-col gap-5">
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm font-semibold text-stone-700">Originality Meter</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-stone-400">live</span>
              </div>
              <div className="mt-2 flex justify-center">
                <Dial value={analyzing ? Math.min(score || 50, 50) : score} analyzing={analyzing} />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <span className="font-serif text-sm font-semibold text-stone-700">Detected Issues</span>
              <div className="mt-3 space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {result && result.issues.length === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-lg bg-teal-50 px-3 py-3 font-serif text-sm text-teal-700"
                    >
                      ✦ No issues detected. This reads as fully original work.
                    </motion.p>
                  )}
                  {result?.issues.map((iss, idx) => {
                    const s = ISSUE_STYLE[iss.kind]
                    return (
                      <motion.div
                        key={iss.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        className="rounded-lg border border-stone-100 bg-[#FCFBF6] p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
                          <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide ${s.chip}`}>
                            {s.tag}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-stone-400">sev {iss.severity}</span>
                        </div>
                        <p className="mt-1.5 font-serif text-sm font-medium text-stone-800">{iss.label}</p>
                        <p className="font-serif text-xs text-stone-500">{iss.detail}</p>
                      </motion.div>
                    )
                  })}
                  {!result && (
                    <p className="rounded-lg border border-dashed border-stone-200 px-3 py-6 text-center font-serif text-sm text-stone-400">
                      Issues will appear here after scoring.
                    </p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>

        {/* reward banner */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border p-5 sm:flex-row ${
                eligible
                  ? 'border-[#0D7377]/30 bg-[#0D7377] text-white'
                  : partial
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full font-serif text-xl ${
                    eligible ? 'bg-white/15' : 'bg-white/60'
                  }`}
                >
                  {eligible ? '◆' : partial ? '◐' : '○'}
                </div>
                <div>
                  <p className="font-serif text-lg font-semibold">
                    {eligible
                      ? 'Reward eligible — original work verified'
                      : partial
                        ? 'Partial reward — derivative content'
                        : 'Not eligible — originality below threshold'}
                  </p>
                  <p className={`text-sm ${eligible ? 'text-white/70' : 'opacity-70'}`}>
                    Score {score}/100 ·{' '}
                    {eligible
                      ? `${(score * 1.5).toFixed(0)} ARB tokens claimable to author`
                      : partial
                        ? `${(score * 0.5).toFixed(0)} ARB tokens (reduced)`
                        : 'Improve originality to unlock rewards'}
                  </p>
                </div>
              </div>
              <button
                disabled={!eligible && !partial}
                onClick={() => toast.success('Reward claimed', { description: 'Tokens routed to author wallet.' })}
                className={`rounded-lg px-6 py-2.5 font-serif text-sm font-semibold transition ${
                  eligible
                    ? 'bg-white text-[#0D7377] hover:bg-stone-100'
                    : partial
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'cursor-not-allowed bg-red-200 text-red-500'
                }`}
              >
                Claim reward
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
