import { useEffect, useMemo, useState } from 'react'
import { formatLocale, parseLocaleNumber } from '../tvm/format'
import { TvmError } from '../tvm/tvm'
import { amortise, toCsv } from './loan'

type TermUnit = 'years' | 'months'

interface Saved {
  amount: string
  rate: string
  term: string
  unit: TermUnit
  extra: string
}

const STORAGE_KEY = 'calcwright.loan'
const DEFAULTS: Saved = { amount: '200000', rate: '6', term: '30', unit: 'years', extra: '0' }

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null
    if (saved && typeof saved === 'object') return { ...DEFAULTS, ...saved }
  } catch {
    // Unreadable saved inputs: start from the defaults.
  }
  return DEFAULTS
}

const money = (d: Parameters<typeof formatLocale>[0]) => formatLocale(d, 2)

export function LoanCalculator() {
  const [state, setState] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const result = useMemo(() => {
    const amount = parseLocaleNumber(state.amount)
    const rate = parseLocaleNumber(state.rate)
    const term = parseLocaleNumber(state.term)
    const extra = state.extra.trim() === '' ? parseLocaleNumber('0') : parseLocaleNumber(state.extra)
    if (!amount) return { error: 'Enter a number for the loan amount.' }
    if (!rate) return { error: 'Enter a number for the interest rate.' }
    if (!term) return { error: 'Enter a number for the term.' }
    if (!extra) return { error: 'Enter a number for the extra payment.' }
    const months = state.unit === 'years' ? term.times(12) : term
    if (!months.isInteger()) return { error: 'The term must come to a whole number of months.' }
    try {
      return { loan: amortise({ amount, rate, months: months.toNumber(), extra }) }
    } catch (e) {
      return { error: e instanceof TvmError ? e.message : 'These values have no solution.' }
    }
  }, [state])

  const set = (key: keyof Saved, value: string) => setState((s) => ({ ...s, [key]: value }))

  const download = () => {
    if (!('loan' in result) || !result.loan) return
    const url = URL.createObjectURL(new Blob([toCsv(result.loan.rows)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'amortisation-schedule.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const field = 'w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 text-right tabular-nums text-[var(--ink)]'
  const loan = 'loan' in result ? result.loan : undefined

  return (
    <section aria-labelledby="loan-title" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <h2 id="loan-title" className="text-lg font-semibold text-[var(--ink)]">
        Loan and amortisation
      </h2>
      <p className="text-sm text-[var(--muted)]">Monthly payments, monthly compounding. An extra payment goes straight to principal each month.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Loan amount
          <input inputMode="decimal" value={state.amount} onChange={(e) => set('amount', e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Annual interest rate, %
          <input inputMode="decimal" value={state.rate} onChange={(e) => set('rate', e.target.value)} className={field} />
        </label>
        <div className="grid gap-1 text-sm text-[var(--ink)]">
          <label htmlFor="loan-term">Term</label>
          <div className="flex gap-2">
            <input id="loan-term" inputMode="decimal" value={state.term} onChange={(e) => set('term', e.target.value)} className={field} />
            <select
              aria-label="Term unit"
              value={state.unit}
              onChange={(e) => set('unit', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] px-2 py-2 text-[var(--ink)]"
            >
              <option value="years">years</option>
              <option value="months">months</option>
            </select>
          </div>
        </div>
        <label className="grid gap-1 text-sm text-[var(--ink)]">
          Extra payment each month
          <input inputMode="decimal" value={state.extra} onChange={(e) => set('extra', e.target.value)} className={field} />
        </label>
      </div>

      {'error' in result && (
        <p role="alert" className="mt-4 text-sm text-[var(--accent-deep)]">
          {result.error}
        </p>
      )}

      {loan && (
        <>
          <dl aria-live="polite" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Monthly payment" value={money(loan.payment)} />
            <Stat label="Total interest" value={money(loan.totalInterest)} />
            <Stat label="Total paid" value={money(loan.totalPaid)} />
            <Stat label="Interest saved" value={money(loan.interestSaved)} />
            <Stat label="Payments saved" value={loan.paymentsSaved.toLocaleString()} />
            <Stat label="Payments" value={loan.rows.length.toLocaleString()} />
          </dl>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={download} className="rounded-[var(--radius)] bg-[var(--accent-deep)] px-4 py-2 font-semibold text-[var(--paper)]">
              Download CSV
            </button>
            <button type="button" onClick={() => setState(DEFAULTS)} className="rounded-[var(--radius)] border border-[var(--line-strong)] px-4 py-2 text-[var(--ink)]">
              Reset
            </button>
          </div>

          <div className="mt-4 max-h-[32rem] overflow-auto rounded-[var(--radius)] border border-[var(--line)]" tabIndex={0} aria-label="Amortisation schedule">
            <table className="w-full text-right text-sm tabular-nums text-[var(--ink)]">
              <caption className="sr-only">Amortisation schedule</caption>
              <thead className="sticky top-0 bg-[var(--paper-deep)]">
                <tr>
                  {['#', 'Payment', 'Principal', 'Interest', 'Extra', 'Balance'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loan.rows.map((r) => (
                  <tr key={r.period} className="border-t border-[var(--line)]">
                    <th scope="row" className="px-3 py-1 font-normal text-[var(--muted)]">
                      {r.period}
                    </th>
                    <td className="px-3 py-1">{money(r.payment)}</td>
                    <td className="px-3 py-1">{money(r.principal)}</td>
                    <td className="px-3 py-1">{money(r.interest)}</td>
                    <td className="px-3 py-1">{money(r.extra)}</td>
                    <td className="px-3 py-1">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">Your inputs are saved on this device only.</p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[var(--ink)]">{value}</dd>
    </div>
  )
}
