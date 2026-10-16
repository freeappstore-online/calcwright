import { useEffect, useMemo, useState } from 'react'
import { formatLocale, parseLocaleNumber } from './format'
import { LABELS, type TvmKey, type TvmMode, TvmError, solveTvm } from './tvm'

const KEYS: TvmKey[] = ['n', 'iy', 'pv', 'pmt', 'fv']
const HINTS: Record<TvmKey, string> = {
  n: 'Number of payments',
  iy: 'Nominal annual rate, %',
  pv: 'Present value',
  pmt: 'Payment each period',
  fv: 'Future value',
}
// Money to the cent; N and I/Y to 6 places.
const PLACES: Record<TvmKey, number> = { n: 6, iy: 6, pv: 2, pmt: 2, fv: 2 }

interface Saved {
  values: Record<TvmKey | 'py' | 'cy', string>
  solveFor: TvmKey
  mode: TvmMode
}

const STORAGE_KEY = 'calcwright.tvm'
const DEFAULTS: Saved = {
  values: { n: '360', iy: '6', pv: '200000', pmt: '', fv: '0', py: '12', cy: '12' },
  solveFor: 'pmt',
  mode: 'end',
}

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null
    if (saved && saved.values && KEYS.includes(saved.solveFor)) return { ...DEFAULTS, ...saved, values: { ...DEFAULTS.values, ...saved.values } }
  } catch {
    // Unreadable saved inputs: start from the defaults.
  }
  return DEFAULTS
}

export function TvmCalculator() {
  const [state, setState] = useState(load)
  const [copied, setCopied] = useState(false)
  const { values, solveFor, mode } = state

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const result = useMemo(() => {
    const parsed: Partial<Record<string, ReturnType<typeof parseLocaleNumber>>> = {}
    for (const key of [...KEYS, 'py', 'cy'] as const) {
      if (key === solveFor) continue
      const d = parseLocaleNumber(values[key])
      if (!d) return { error: `Enter a number for ${key === 'py' ? 'P/Y' : key === 'cy' ? 'C/Y' : LABELS[key]}.` }
      parsed[key] = d
    }
    try {
      const value = solveTvm(solveFor, {
        n: parsed.n ?? 0,
        iy: parsed.iy ?? 0,
        pv: parsed.pv ?? 0,
        pmt: parsed.pmt ?? 0,
        fv: parsed.fv ?? 0,
        py: parsed.py!,
        cy: parsed.cy!,
        mode,
      })
      return { value, text: formatLocale(value, PLACES[solveFor]) }
    } catch (e) {
      return { error: e instanceof TvmError ? e.message : 'These values have no solution.' }
    }
  }, [values, solveFor, mode])

  const set = (key: keyof Saved['values'], text: string) => setState((s) => ({ ...s, values: { ...s.values, [key]: text } }))

  const copy = async () => {
    if (!('value' in result) || !result.value) return
    try {
      await navigator.clipboard.writeText(result.value.toDecimalPlaces(PLACES[solveFor]).toString())
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const field = 'w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 text-right tabular-nums text-[var(--ink)]'

  return (
    <section aria-labelledby="tvm-title" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <h2 id="tvm-title" className="text-lg font-semibold text-[var(--ink)]">
        Time value of money
      </h2>
      <p className="text-sm text-[var(--muted)]">
        Pick the value to solve for and fill in the rest. Money paid out is negative, money received is positive.
      </p>

      <fieldset className="mt-4 grid gap-3">
        <legend className="sr-only">Values</legend>
        {KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
            <label className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <input
                type="radio"
                name="tvm-solve-for"
                checked={solveFor === key}
                onChange={() => setState((s) => ({ ...s, solveFor: key }))}
                aria-label={`Solve for ${LABELS[key]}`}
              />
              {LABELS[key]}
            </label>
            {solveFor === key ? (
              <output aria-live="polite" className={`${field} bg-[var(--paper-deep)] font-semibold`}>
                {'text' in result ? result.text : '—'}
              </output>
            ) : (
              <input
                inputMode="decimal"
                aria-label={`${LABELS[key]}: ${HINTS[key]}`}
                placeholder={HINTS[key]}
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                className={field}
              />
            )}
          </div>
        ))}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          P/Y
          <input inputMode="decimal" value={values.py} onChange={(e) => set('py', e.target.value)} className={`${field} w-20`} aria-label="Payments per year" />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          C/Y
          <input inputMode="decimal" value={values.cy} onChange={(e) => set('cy', e.target.value)} className={`${field} w-20`} aria-label="Compounding periods per year" />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          Payments at
          <select
            value={mode}
            onChange={(e) => setState((s) => ({ ...s, mode: e.target.value as TvmMode }))}
            className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-2 py-2 text-[var(--ink)]"
          >
            <option value="end">End of period</option>
            <option value="begin">Beginning of period</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          disabled={!('text' in result)}
          className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {copied ? 'Copied' : `Copy ${LABELS[solveFor]}`}
        </button>
        <button type="button" onClick={() => setState(DEFAULTS)} className="rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[var(--ink)]">
          Reset
        </button>
        {'error' in result && (
          <p role="alert" className="text-sm text-[var(--accent-deep)]">
            {result.error}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">Your inputs are saved on this device only. Results are estimates, not financial advice.</p>
    </section>
  )
}
