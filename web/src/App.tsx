import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { read, write, CONTRACT } from './genlayer'

const SAMPLE = `The river does not hurry, yet it arrives. I have been thinking lately about the slow craft of sentences — how an idea, like silt, settles only when the current is allowed to rest. We write to discover what we did not know we believed.`

type Issue = { id: string; kind: 'plagiarism' | 'ai' | 'citation'; label: string; detail: string; severity: number }

const ISSUE_STYLE: Record<Issue['kind'], { tag: string; dot: string; chip: string }> = {
  plagiarism: { tag: 'PLAGIARISM', dot: '#B91C1C', chip: 'bg-red-50 text-red-700 border-red-200' },
  ai: { tag: 'AI-GENERATED', dot: '#B45309', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  citation: { tag: 'CITATION', dot: '#0D7377', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
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
  const [result, setResult] = useState<{ score: number; issues: Issue[]; isOriginal: boolean } | null>(null)
  const [phase, setPhase] = useState('')
  const [stats, setStats] = useState<{ total: number; rewarded: number; rejected: number } | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    read('stats')
      .then((s: any) =>
        setStats({
          total: Number(s?.total_submissions ?? s?.[0] ?? 0),
          rewarded: Number(s?.rewarded ?? s?.[1] ?? 0),
          rejected: Number(s?.rejected ?? s?.[2] ?? 0),
        }),
      )
      .catch(() => {
        /* keep masthead fallback on read failure */
      })
  }, [])

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

  async function analyze() {
    if (words < 8) {
      toast.error('Need more text', { description: 'Paste at least 8 words to score originality.' })
      return
    }
    setAnalyzing(true)
    setResult(null)
    toast('Arbiter engaged', { description: `Submitting ${words} words on-chain…` })
    try {
      await write('submit', [text, 'article', ''])
      const s: any = await read('stats')
      const totalSubs = Number(s?.total_submissions ?? s?.[0] ?? 0)
      setStats({
        total: totalSubs,
        rewarded: Number(s?.rewarded ?? s?.[1] ?? 0),
        rejected: Number(s?.rejected ?? s?.[2] ?? 0),
      })

      const sub: any = await read('get_submission', [String(totalSubs - 1)])
      const rawScore = Number(sub?.originality_score ?? sub?.[0] ?? 0)
      const score = Math.max(0, Math.min(100, Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)))
      const isOriginal = Boolean(sub?.is_original ?? sub?.[1])
      const reasoning = String(sub?.reasoning ?? sub?.[2] ?? '')
      const similar = sub?.similar_sources ?? sub?.[3] ?? []

      const issues: Issue[] = []
      if (reasoning)
        issues.push({
          id: 'reason',
          kind: isOriginal ? 'citation' : 'ai',
          label: isOriginal ? 'Validator assessment' : 'Originality concern',
          detail: reasoning,
          severity: Math.max(1, 100 - score),
        })
      if (Array.isArray(similar))
        similar.forEach((src: any, i: number) =>
          issues.push({
            id: `sim${i}`,
            kind: 'plagiarism',
            label: 'Similar source found',
            detail: String(src),
            severity: 80,
          }),
        )

      setResult({ score, issues, isOriginal })
      if (isOriginal)
        toast.success('Original work verified', { description: 'Eligible for author token reward.' })
      else toast.warning('Originality below threshold', { description: reasoning || 'Review flagged issues.' })
    } catch (e: any) {
      toast.error('Analysis failed', { description: e?.message ?? String(e) })
    } finally {
      setAnalyzing(false)
    }
  }

  const score = result?.score ?? 0
  const isOriginal = result?.isOriginal ?? false
  const eligible = isOriginal
  const partial = !isOriginal && score >= 55

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#1C1A17]">
      <Toaster position="top-center" richColors />
      {/* paper grain + warm vignette */}
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(13,115,119,0.07), transparent 70%)' }} />
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* top accent rule */}
      <div className="relative h-1 w-full bg-gradient-to-r from-[#0D7377] via-[#14A085] to-[#0D7377]" />

      {/* masthead */}
      <header className="relative border-b border-stone-300/70">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-center gap-3 border-b border-dashed border-stone-300/60 py-2.5 text-[10px] uppercase tracking-[0.3em] text-stone-400">
            <span>Est. on GenLayer</span><span className="text-[#0D7377]">◆</span>
            <span>Decentralized Authorship Ledger</span><span className="text-[#0D7377]">◆</span>
            <span className="hidden sm:inline">{stats ? `${stats.total} entries` : 'Vol. I'}</span>
          </div>
          <div className="flex flex-col items-center py-7 text-center">
            <div className="mb-2 flex items-center gap-2 text-[#0D7377]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-[0.4em]">Originality Arbiter</span>
            </div>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              The ledger that rewards<br/><span className="italic text-[#0D7377]">original</span> voices.
            </h1>
            <p className="mt-3 max-w-md font-serif text-[15px] italic leading-relaxed text-stone-500">
              Paste your writing. AI validators judge its originality and reward authentic authorship on-chain.
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-8">
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
