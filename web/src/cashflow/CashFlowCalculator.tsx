import { useEffect, useMemo, useState } from 'react'
import { formatLocale, parseLocaleNumber } from '../tvm/format'
import { type Dec, TvmError } from '../tvm/tvm'
import { irr, mirr, npv } from './cashflow'

interface Saved {
  flows: string[]
  rate: string
  finance: string
  reinvest: string
}

const STORAGE_KEY = 'calcwright.cashflow'
const DEFAULTS: Saved = {
  flows: ['-70000', '12000', '15000', '18000', '21000', '26000'],
  rate: '8',
  finance: '10',
  reinvest: '12',
}

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null
    if (saved && Array.isArray(saved.flows) && saved.flows.length > 0) return { ...DEFAULTS, ...saved }
  } catch {
    // Unreadable saved inputs: start from the defaults.
  }
  return DEFAULTS
}

type Outcome = { text: string; note?: string } | { error: string }

// Runs one calculation, turning a TvmError into a message for that result alone.
function attempt(run: () => { text: string; note?: string }): Outcome {
  try {
    return run()
  } catch (e) {
    return { error: e instanceof TvmError ? e.message : 'No result for these cash flows.' }
  }
}

const pct = (d: Dec) => `${formatLocale(d, 6)}%`

export function CashFlowCalculator() {
  const [state, setState] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const results = useMemo(() => {
    const flows: Dec[] = []
    for (const [t, text] of state.flows.entries()) {
      const d = text.trim() === '' ? parseLocaleNumber('0') : parseLocaleNumber(text)
      if (!d) return { error: `Enter a number for CF${t}.` }
      flows.push(d)
    }
    const rate = parseLocaleNumber(state.rate)
    const finance = parseLocaleNumber(state.finance)
    const reinvest = parseLocaleNumber(state.reinvest)
    return {
      npv: rate ? attempt(() => ({ text: formatLocale(npv(rate, flows), 2) })) : { error: 'Enter a number for the discount rate.' },
      irr: attempt(() => {
        const r = irr(flows)
        const others = r.roots.length > 1 ? ` IRRs found: ${r.roots.map(pct).join(', ')}.` : ''
        return { text: pct(r.irr), note: r.warning ? r.warning + others : undefined }
      }),
      mirr:
        finance && reinvest
          ? attempt(() => ({ text: pct(mirr(flows, finance, reinvest)) }))
          : { error: 'Enter numbers for the finance and reinvestment rates.' },
    }
  }, [state])

  const setFlow = (t: number, value: string) => setState((s) => ({ ...s, flows: s.flows.map((f, k) => (k === t ? value : f)) }))
  const removeFlow = (t: number) => setState((s) => ({ ...s, flows: s.flows.filter((_, k) => k !== t) }))
  const addFlow = () => setState((s) => ({ ...s, flows: [...s.flows, ''] }))

  const field = 'w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 text-right tabular-nums text-[var(--ink)]'

  return (
    <section aria-labelledby="cf-title" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <h2 id="cf-title" className="text-lg font-semibold text-[var(--ink)]">
        NPV, IRR and MIRR
      </h2>
      <p className="text-sm text-[var(--muted)]">
        CF0 is at time 0; each later flow comes at the end of its period. Money paid out is negative, money received is positive.
      </p>

      <fieldset className="mt-4 grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-[var(--ink)]">Cash flows</legend>
        {state.flows.map((flow, t) => (
          <div key={t} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2">
            <label htmlFor={`cf-${t}`} className="text-sm text-[var(--muted)]">
              CF{t}
            </label>
            <input id={`cf-${t}`} inputMode="decimal" value={flow} onChange={(e) => setFlow(t, e.target.value)} className={field} />
            <button
              type="button"
              onClick={() => removeFlow(t)}
              disabled={state.flows.length <= 1}
              aria-label={`Remove CF${t}`}
              className="rounded-[var(--radius)] border border-[var(--line-strong)] px-3 py-2 text-[var(--ink)] disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button type="button" onClick={addFlow} className="mt-1 rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[var(--ink)]">
            Add cash flow
          </button>
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Discount rate (NPV), %
          <input inputMode="decimal" value={state.rate} onChange={(e) => setState((s) => ({ ...s, rate: e.target.value }))} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Finance rate (MIRR), %
          <input inputMode="decimal" value={state.finance} onChange={(e) => setState((s) => ({ ...s, finance: e.target.value }))} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Reinvestment rate (MIRR), %
          <input inputMode="decimal" value={state.reinvest} onChange={(e) => setState((s) => ({ ...s, reinvest: e.target.value }))} className={field} />
        </label>
      </div>

      {'error' in results ? (
        <p role="alert" className="mt-4 text-sm text-[var(--accent-deep)]">
          {results.error}
        </p>
      ) : (
        <dl aria-live="polite" className="mt-4 grid gap-3 sm:grid-cols-3">
          <Result label="NPV" outcome={results.npv} />
          <Result label="IRR" outcome={results.irr} />
          <Result label="MIRR" outcome={results.mirr} />
        </dl>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => setState(DEFAULTS)} className="rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[var(--ink)]">
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">Your inputs are saved on this device only. Results are estimates, not financial advice.</p>
    </section>
  )
}

function Result({ label, outcome }: { label: string; outcome: Outcome }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      {'error' in outcome ? (
        <dd className="text-sm text-[var(--accent-deep)]">{outcome.error}</dd>
      ) : (
        <>
          <dd className="font-semibold tabular-nums text-[var(--ink)]">{outcome.text}</dd>
          {outcome.note && (
            <dd role="note" className="mt-1 text-xs text-[var(--accent-deep)]">
              {outcome.note}
            </dd>
          )}
        </>
      )}
    </div>
  )
}
